const {
    database: { mongo: { core: {
        ReadPreference,
        Cursor: BasicCursor,
        MongoError,
        Server,
        ReplSetState,
        auth: { MongoCR, X509, Plain, ScramSHA1 },
        helper
    } } },
    std: { events: EventEmitter },
    is, util
} = adone;

//
// States
const DISCONNECTED = "disconnected";
const CONNECTING = "connecting";
const CONNECTED = "connected";
const UNREFERENCED = "unreferenced";
const DESTROYED = "destroyed";

const stateTransition = (self, newState) => {
    const legalTransitions = {
        disconnected: [CONNECTING, DESTROYED, DISCONNECTED],
        connecting: [CONNECTING, DESTROYED, CONNECTED, DISCONNECTED],
        connected: [CONNECTED, DISCONNECTED, DESTROYED, UNREFERENCED],
        unreferenced: [UNREFERENCED, DESTROYED],
        destroyed: [DESTROYED]
    };

    // Get current state
    const legalStates = legalTransitions[self.state];
    if (legalStates && legalStates.includes(newState)) {
        self.state = newState;
    }
};

//
// ReplSet instance id
let id = 1;
const handlers = ["connect", "close", "error", "timeout", "parseError"];

const rexecuteOperations = (self) => {
    // If we have a primary and a disconnect handler, execute
    // buffered operations
    if (self.s.replicaSetState.hasPrimaryAndSecondary() && self.s.disconnectHandler) {
        self.s.disconnectHandler.execute();
    } else if (self.s.replicaSetState.hasPrimary() && self.s.disconnectHandler) {
        self.s.disconnectHandler.execute({ executePrimary: true });
    } else if (self.s.replicaSetState.hasSecondary() && self.s.disconnectHandler) {
        self.s.disconnectHandler.execute({ executeSecondary: true });
    }
};

const pingServer = (self, server, cb) => {
    // Measure running time
    const start = new Date().getTime();

    // Emit the server heartbeat start
    helper.emitSDAMEvent(self, "serverHeartbeatStarted", { connectionId: server.name });

    // Execute ismaster
    // Set the socketTimeout for a monitoring message to a low number
    // Ensuring ismaster calls are timed out quickly
    server.command("admin.$cmd", {
        ismaster: true
    }, {
        monitoring: true,
        socketTimeout: self.s.options.connectionTimeout || 2000
    }, (err, r) => {
        if (self.state === DESTROYED || self.state === UNREFERENCED) {
            server.destroy();
            return cb(err, r);
        }

        // Calculate latency
        const latencyMS = new Date().getTime() - start;
        // Set the last updatedTime
        const hrTime = process.hrtime();
        // Calculate the last update time
        server.lastUpdateTime = hrTime[0] * 1000 + Math.round(hrTime[1] / 1000);

        // We had an error, remove it from the state
        if (err) {
            // Emit the server heartbeat failure
            helper.emitSDAMEvent(self, "serverHeartbeatFailed", { durationMS: latencyMS, failure: err, connectionId: server.name });

            // Remove server from the state
            self.s.replicaSetState.remove(server);
        } else {
            // Update the server ismaster
            server.ismaster = r.result;

            // Check if we have a lastWriteDate convert it to MS
            // and store on the server instance for later use
            if (server.ismaster.lastWrite && server.ismaster.lastWrite.lastWriteDate) {
                server.lastWriteDate = server.ismaster.lastWrite.lastWriteDate.getTime();
            }

            // Do we have a brand new server
            if (server.lastIsMasterMS === -1) {
                server.lastIsMasterMS = latencyMS;
            } else if (server.lastIsMasterMS) {
                // After the first measurement, average RTT MUST be computed using an
                // exponentially-weighted moving average formula, with a weighting factor (alpha) of 0.2.
                // If the prior average is denoted old_rtt, then the new average (new_rtt) is
                // computed from a new RTT measurement (x) using the following formula:
                // alpha = 0.2
                // new_rtt = alpha * x + (1 - alpha) * old_rtt                 server.lastIsMasterMS = 0.2 * latencyMS + (1 - 0.2) * server.lastIsMasterMS;             }
                server.lastIsMasterMS = 0.2 * latencyMS + (1 - 0.2) * server.lastIsMasterMS;
            }

            if (self.s.replicaSetState.update(server)) {
                // Primary lastIsMaster store it
                if (server.lastIsMaster() && server.lastIsMaster().ismaster) {
                    self.ismaster = server.lastIsMaster();
                }
            }

            // Server heart beat event
            helper.emitSDAMEvent(self, "serverHeartbeatSucceeded", { durationMS: latencyMS, reply: r.result, connectionId: server.name });
        }


        // Calculate the stalness for this server
        self.s.replicaSetState.updateServerMaxStaleness(server, self.s.haInterval);

        // Callback
        cb(err, r);
    });
};

const addServerToList = (list, server) => {
    for (const s of list) {
        if (s.name.toLowerCase() === server.name.toLowerCase()) {
            return true;
        }
    }

    list.push(server);
};

const handleEvent = (self) => {
    return function () {
        if (self.state === DESTROYED || self.state === UNREFERENCED) {
            return;
        }

        // Remove from the replicaset state
        self.s.replicaSetState.remove(this);

        // Are we in a destroyed state return
        if (self.state === DESTROYED || self.state === UNREFERENCED) {
            return;
        }

        // If no primary and secondary available
        if (
            !self.s.replicaSetState.hasPrimary() &&
            !self.s.replicaSetState.hasSecondary() &&
            self.s.options.secondaryOnlyConnectionAllowed
        ) {
            stateTransition(self, DISCONNECTED);
        } else if (!self.s.replicaSetState.hasPrimary()) {
            stateTransition(self, DISCONNECTED);
        }

        addServerToList(self.s.connectingServers, this);
    };
};

const applyAuthenticationContexts = (self, server, callback) => {
    if (self.s.authenticationContexts.length === 0) {
        return callback();
    }

    // Do not apply any auth contexts if it's an arbiter
    if (server.lastIsMaster() && server.lastIsMaster().arbiterOnly) {
        return callback();
    }

    // Copy contexts to ensure no modificiation in the middle of
    // auth process.
    const authContexts = self.s.authenticationContexts.slice(0);

    // Apply one of the contexts
    const applyAuth = (authContexts, server, callback) => {
        if (authContexts.length === 0) {
            return callback();
        }
        // Get the first auth context
        const authContext = authContexts.shift();
        // Copy the params
        const customAuthContext = authContext.slice(0);
        // Push our callback handler
        customAuthContext.push(() => {
            applyAuth(authContexts, server, callback);
        });

        // Attempt authentication
        server.auth.apply(server, customAuthContext);
    };

    // Apply all auth contexts
    applyAuth(authContexts, server, callback);
};

const connectNewServers = (self, servers, callback) => {
    // Count lefts
    let count = servers.length;
    let error = null;

    // Handle events
    const _handleEvent = (self, event) => {
        return function (err) {
            count = count - 1;

            // Destroyed
            if (self.state === DESTROYED || self.state === UNREFERENCED) {
                return this.destroy();
            }

            if (event === "connect" && !self.authenticating) {
                // Destroyed
                if (self.state === DESTROYED || self.state === UNREFERENCED) {
                    return this.destroy();
                }

                // Do we have authentication contexts that need to be applied
                applyAuthenticationContexts(self, this, () => {
                    // Destroy the instance
                    if (self.state === DESTROYED || self.state === UNREFERENCED) {
                        return this.destroy();
                    }

                    // Update the state
                    const result = self.s.replicaSetState.update(this);
                    // Update the state with the new server
                    if (result) {
                        // Primary lastIsMaster store it
                        if (this.lastIsMaster() && this.lastIsMaster().ismaster) {
                            self.ismaster = this.lastIsMaster();
                        }

                        // Remove the handlers
                        for (const h of handlers) {
                            this.removeAllListeners(h);
                        }

                        // Add stable state handlers
                        this.on("error", handleEvent(self, "error"));
                        this.on("close", handleEvent(self, "close"));
                        this.on("timeout", handleEvent(self, "timeout"));
                        this.on("parseError", handleEvent(self, "parseError"));

                        // Rexecute any stalled operation
                        rexecuteOperations(self);
                    } else {
                        this.destroy();
                    }
                });
            } else if (event === "connect" && self.authenticating) {
                this.destroy();
            } else if (event === "error") {
                error = err;
            }

            // Rexecute any stalled operation
            rexecuteOperations(self);

            // Are we done finish up callback
            if (count === 0) {
                callback(error);
            }
        };
    };

    // No new servers
    if (count === 0) {
        return callback();
    }

    // Execute method
    const execute = (_server, i) => {
        setTimeout(() => {
            // Destroyed
            if (self.state === DESTROYED || self.state === UNREFERENCED) {
                return;
            }

            // Create a new server instance
            const server = new Server(Object.assign({}, self.s.options, {
                host: _server.split(":")[0],
                port: parseInt(_server.split(":")[1], 10)
            }, {
                authProviders: self.authProviders,
                reconnect: false,
                monitoring: false,
                inTopology: true
            }, {
                clientInfo: util.clone(self.s.clientInfo)
            }));

            // Add temp handlers
            server.once("connect", _handleEvent(self, "connect"));
            server.once("close", _handleEvent(self, "close"));
            server.once("timeout", _handleEvent(self, "timeout"));
            server.once("error", _handleEvent(self, "error"));
            server.once("parseError", _handleEvent(self, "parseError"));

            // SDAM Monitoring events
            server.on("serverOpening", (e) => {
                self.emit("serverOpening", e);
            });
            server.on("serverDescriptionChanged", (e) => {
                self.emit("serverDescriptionChanged", e);
            });
            server.on("serverClosed", (e) => {
                self.emit("serverClosed", e);
            });
            server.connect(self.s.connectOptions);
        }, i);
    };

    // Create new instances
    for (let i = 0; i < servers.length; i++) {
        execute(servers[i], i);
    }
};

const topologyMonitor = (self, options = {}) => {
    if (self.state === DESTROYED || self.state === UNREFERENCED) {
        return;
    }

    const servers = util.keys(self.s.replicaSetState.set);

    // Get the haInterval
    const _process = options.haInterval ? setTimeout : setInterval;
    const _haInterval = options.haInterval ? options.haInterval : self.s.haInterval;

    // Count of initial sweep servers to check
    let count = servers.length;

    // Each server is monitored in parallel in their own timeout loop
    const monitorServer = (_host, _self) => {
        const intervalId = _process(() => {
            if (self.state === DESTROYED || self.state === UNREFERENCED) {
                clearInterval(intervalId);
                return;
            }

            // Adjust the count
            count = count - 1;

            // Do we already have server connection available for this host
            const _server = _self.s.replicaSetState.get(_host);

            // Check if we have a known server connection and reuse
            if (_server) {
                return pingServer(_self, _server, () => {
                    if (self.state === DESTROYED || self.state === UNREFERENCED) {
                        clearInterval(intervalId);
                        return;
                    }

                    // Initial sweep
                    if (_process === setTimeout) {
                        if (
                            _self.state === CONNECTING &&
                            (
                                (
                                    self.s.replicaSetState.hasSecondary() &&
                                    self.s.options.secondaryOnlyConnectionAllowed
                                ) ||
                                self.s.replicaSetState.hasPrimary()
                            )
                        ) {
                            _self.state = CONNECTED;

                            // Emit connected sign
                            process.nextTick(() => {
                                self.emit("connect", self);
                            });

                            // Start topology interval check
                            topologyMonitor(_self, {});
                        }
                    } else {
                        if (
                            _self.state === DISCONNECTED &&
                            (
                                (
                                    self.s.replicaSetState.hasSecondary()
                                    && self.s.options.secondaryOnlyConnectionAllowed
                                ) ||
                                self.s.replicaSetState.hasPrimary()
                            )
                        ) {
                            _self.state = CONNECTED;

                            // Rexecute any stalled operation
                            rexecuteOperations(self);

                            // Emit connected sign
                            process.nextTick(() => {
                                self.emit("reconnect", self);
                            });
                        }
                    }

                    if (
                        self.initialConnectState.connect &&
                        !self.initialConnectState.fullsetup &&
                        self.s.replicaSetState.hasPrimaryAndSecondary()
                    ) {
                        // Set initial connect state
                        self.initialConnectState.fullsetup = true;
                        self.initialConnectState.all = true;

                        process.nextTick(() => {
                            self.emit("fullsetup", self);
                            self.emit("all", self);
                        });
                    }
                });
            }
        }, _haInterval);
        // Add the intervalId to our list of intervalIds
        self.intervalIds.push(intervalId);
    };

    if (_process === setTimeout) {
        return connectNewServers(self, self.s.replicaSetState.unknownServers, (err) => {
            if (!self.s.replicaSetState.hasPrimary() && !self.s.options.secondaryOnlyConnectionAllowed) {
                if (err) {
                    return self.emit("error", err);
                }
                self.emit("error", new MongoError("no primary found in replicaset"));
                return self.destroy();
            } else if (!self.s.replicaSetState.hasSecondary() && self.s.options.secondaryOnlyConnectionAllowed) {
                if (err) {
                    return self.emit("error", err);
                }
                self.emit("error", new MongoError("no secondary found in replicaset"));
                return self.destroy();
            }

            for (const s of servers) {
                monitorServer(s, self, options);
            }
        });
    }
    for (const s of servers) {
        monitorServer(s, self, options);
    }


    // Run the reconnect process
    const executeReconnect = (self) => {
        return () => {
            if (self.state === DESTROYED || self.state === UNREFERENCED) {
                return;
            }

            connectNewServers(self, self.s.replicaSetState.unknownServers, () => {
                if (self.s.replicaSetState.hasPrimary()) {
                    self.intervalIds.push(setTimeout(executeReconnect(self), _haInterval));
                } else {
                    self.intervalIds.push(setTimeout(executeReconnect(self), self.s.minHeartbeatFrequencyMS));
                }
            });
        };
    };

    // Decide what kind of interval to use
    const intervalTime = !self.s.replicaSetState.hasPrimary()
        ? self.s.minHeartbeatFrequencyMS
        : _haInterval;

    self.intervalIds.push(setTimeout(executeReconnect(self), intervalTime));
};

const handleInitialConnectEvent = (self, event) => {
    return function () {
        // Destroy the instance
        if (self.state === DESTROYED || self.state === UNREFERENCED) {
            return this.destroy();
        }

        // Check the type of server
        if (event === "connect") {
            // Do we have authentication contexts that need to be applied
            applyAuthenticationContexts(self, this, () => {
                // Destroy the instance
                if (self.state === DESTROYED || self.state === UNREFERENCED) {
                    return this.destroy();
                }
                // Update the state
                const result = self.s.replicaSetState.update(this);
                if (result === true) {
                    // Primary lastIsMaster store it
                    if (this.lastIsMaster() && this.lastIsMaster().ismaster) {
                        self.ismaster = this.lastIsMaster();
                    }

                    // Remove the handlers
                    for (const h of handlers) {
                        this.removeAllListeners(h);
                    }

                    // Add stable state handlers
                    this.on("error", handleEvent(self, "error"));
                    this.on("close", handleEvent(self, "close"));
                    this.on("timeout", handleEvent(self, "timeout"));
                    this.on("parseError", handleEvent(self, "parseError"));

                    // Do we have a primary or primaryAndSecondary
                    if (
                        self.state === CONNECTING &&
                        self.s.replicaSetState.hasPrimary() ||
                        (self.s.replicaSetState.hasSecondary() && self.s.options.secondaryOnlyConnectionAllowed)
                    ) {
                        // We are connected
                        self.state = CONNECTED;

                        // Set initial connect state
                        self.initialConnectState.connect = true;
                        // Emit connect event
                        process.nextTick(() => {
                            self.emit("connect", self);
                        });

                        topologyMonitor(self, {});
                    }
                } else if (result instanceof MongoError) {
                    this.destroy();
                    self.destroy();
                    return self.emit("error", result);
                } else {
                    this.destroy();
                }
            });
        } else {
            // Emit failure to connect
            self.emit("failed", this);

            addServerToList(self.s.connectingServers, this);
            // Remove from the state
            self.s.replicaSetState.remove(this);
        }

        if (
            self.initialConnectState.connect &&
            !self.initialConnectState.fullsetup &&
            self.s.replicaSetState.hasPrimaryAndSecondary()
        ) {
            // Set initial connect state
            self.initialConnectState.fullsetup = true;
            self.initialConnectState.all = true;

            process.nextTick(() => {
                self.emit("fullsetup", self);
                self.emit("all", self);
            });
        }

        // Remove from the list from connectingServers
        for (let i = 0; i < self.s.connectingServers.length; i++) {
            if (self.s.connectingServers[i].equals(this)) {
                self.s.connectingServers.splice(i, 1);
            }
        }

        // Trigger topologyMonitor
        if (self.s.connectingServers.length === 0 && self.state === CONNECTING) {
            topologyMonitor(self, { haInterval: 1 });
        }
    };
};

const connectServers = (self, servers) => {
    // Update connectingServers
    self.s.connectingServers = self.s.connectingServers.concat(servers);

    // Index used to interleaf the server connects, avoiding
    // runtime issues on io constrained vm's
    let timeoutInterval = 0;

    const connect = (server, timeoutInterval) => {
        setTimeout(() => {
            // Add the server to the state
            if (self.s.replicaSetState.update(server)) {
                // Primary lastIsMaster store it
                if (server.lastIsMaster() && server.lastIsMaster().ismaster) {
                    self.ismaster = server.lastIsMaster();
                }
            }

            // Add event handlers
            server.once("close", handleInitialConnectEvent(self, "close"));
            server.once("timeout", handleInitialConnectEvent(self, "timeout"));
            server.once("parseError", handleInitialConnectEvent(self, "parseError"));
            server.once("error", handleInitialConnectEvent(self, "error"));
            server.once("connect", handleInitialConnectEvent(self, "connect"));
            // SDAM Monitoring events
            server.on("serverOpening", (e) => {
                self.emit("serverOpening", e);
            });
            server.on("serverDescriptionChanged", (e) => {
                self.emit("serverDescriptionChanged", e);
            });
            server.on("serverClosed", (e) => {
                self.emit("serverClosed", e);
            });
            // Start connection
            server.connect(self.s.connectOptions);
        }, timeoutInterval);
    };

    // Start all the servers
    while (servers.length > 0) {
        connect(servers.shift(), timeoutInterval++);
    }
};

const executeWriteOperation = (self, op, ns, ops, options, callback) => {
    if (is.function(options)) {
        callback = options;
        options = {};
    }
    // Ensure we have no options

    // No server returned we had an error
    if (is.nil(self.s.replicaSetState.primary)) {
        return callback(new MongoError("no primary server found"));
    }

    // Execute the command
    self.s.replicaSetState.primary[op](ns, ops, options, callback);
};

/**
 * Creates a new Replset instance
 * @class
 * @param {array} seedlist A list of seeds for the replicaset
 * @param {boolean} options.setName The Replicaset set name
 * @param {boolean} [options.secondaryOnlyConnectionAllowed=false] Allow connection to a secondary only replicaset
 * @param {number} [options.haInterval=10000] The High availability period for replicaset inquiry
 * @param {boolean} [options.emitError=false] Server will emit errors events
 * @param {Cursor} [options.cursorFactory=Cursor] The cursor factory class used for all query cursors
 * @param {number} [options.size=5] Server connection pool size
 * @param {boolean} [options.keepAlive=true] TCP Connection keep alive enabled
 * @param {number} [options.keepAliveInitialDelay=0] Initial delay before TCP keep alive enabled
 * @param {boolean} [options.noDelay=true] TCP Connection no delay
 * @param {number} [options.connectionTimeout=10000] TCP Connection timeout setting
 * @param {number} [options.socketTimeout=0] TCP Socket timeout setting
 * @param {boolean} [options.singleBufferSerializtion=true] Serialize into single buffer, trade of peak memory for serialization speed
 * @param {boolean} [options.ssl=false] Use SSL for connection
 * @param {boolean|function} [options.checkServerIdentity=true] Ensure we check server identify during SSL, set to false to disable checking. Only works for Node 0.12.x or higher. You can pass in a boolean or your own checkServerIdentity override function.
 * @param {Buffer} [options.ca] SSL Certificate store binary buffer
 * @param {Buffer} [options.cert] SSL Certificate binary buffer
 * @param {Buffer} [options.key] SSL Key file binary buffer
 * @param {string} [options.passphrase] SSL Certificate pass phrase
 * @param {string} [options.servername=null] String containing the server name requested via TLS SNI.
 * @param {boolean} [options.rejectUnauthorized=true] Reject unauthorized server certificates
 * @param {boolean} [options.promoteLongs=true] Convert Long values from the db into Numbers if they fit into 53 bits
 * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
 * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
 * @param {number} [options.pingInterval=5000] Ping interval to check the response time to the different servers
  * @param {number} [options.localThresholdMS=15] Cutoff latency point in MS for Replicaset member selection
 * @param {boolean} [options.domainsEnabled=false] Enable the wrapping of the callback in the current domain, disabled by default to avoid perf hit.
 * @return {ReplSet} A cursor instance
 * @fires ReplSet#connect
 * @fires ReplSet#ha
 * @fires ReplSet#joined
 * @fires ReplSet#left
 * @fires ReplSet#failed
 * @fires ReplSet#fullsetup
 * @fires ReplSet#all
 * @fires ReplSet#error
 * @fires ReplSet#serverHeartbeatStarted
 * @fires ReplSet#serverHeartbeatSucceeded
 * @fires ReplSet#serverHeartbeatFailed
 * @fires ReplSet#topologyOpening
 * @fires ReplSet#topologyClosed
 * @fires ReplSet#topologyDescriptionChanged
 * @property {string} type the topology type.
 * @property {string} parserType the parser type used (c++ or js).
 */

export default class ReplSet extends EventEmitter {
    constructor(seedlist, options = {}) {
        // Validate seedlist
        if (!is.array(seedlist)) {
            throw new MongoError("seedlist must be an array");
        }
        // Validate list
        if (seedlist.length === 0) {
            throw new MongoError("seedlist must contain at least one entry");
        }
        // Validate entries
        seedlist.forEach((e) => {
            if (!is.string(e.host) || !is.number(e.port)) {
                throw new MongoError("seedlist entry must contain a host and port");
            }
        });

        super();

        // Get replSet Id
        this.id = id++;

        // Get the localThresholdMS
        let localThresholdMS = options.localThresholdMS || 15;
        // Backward compatibility
        if (options.acceptableLatency) {
            localThresholdMS = options.acceptableLatency;
        }

        // Internal state
        this.s = {
            options: Object.assign({}, options),
            // BSON instance
            bson: options.bson || new adone.data.bson.BSON(),
            // Factory overrides
            Cursor: options.cursorFactory || BasicCursor,
            // Seedlist
            seedlist,
            // Replicaset state
            replicaSetState: new ReplSetState({
                id: this.id, setName: options.setName,
                acceptableLatency: localThresholdMS,
                heartbeatFrequencyMS: options.haInterval ? options.haInterval : 10000
            }),
            // Current servers we are connecting to
            connectingServers: [],
            // Ha interval
            haInterval: options.haInterval ? options.haInterval : 10000,
            // Minimum heartbeat frequency used if we detect a server close
            minHeartbeatFrequencyMS: 500,
            // Disconnect handler
            disconnectHandler: options.disconnectHandler,
            // Server selection index
            index: 0,
            // Connect function options passed in
            connectOptions: {},
            // Are we running in debug mode
            debug: is.boolean(options.debug) ? options.debug : false,
            // Client info
            clientInfo: helper.createClientInfo(options),
            // Authentication context
            authenticationContexts: []
        };

        // Add handler for topology change
        this.s.replicaSetState.on("topologyDescriptionChanged", (r) => {
            this.emit("topologyDescriptionChanged", r);
        });

        // All the authProviders
        this.authProviders = options.authProviders || {
            mongocr: new MongoCR(this.s.bson),
            x509: new X509(this.s.bson),
            plain: new Plain(this.s.bson),
            "scram-sha-1": new ScramSHA1(this.s.bson)
        };

        // Add forwarding of events from state handler
        const types = ["joined", "left"];
        types.forEach((x) => {
            this.s.replicaSetState.on(x, (t, s) => {
                this.emit(x, t, s);
            });
        });

        // Connect stat
        this.initialConnectState = {
            connect: false, fullsetup: false, all: false
        };

        // Disconnected state
        this.state = DISCONNECTED;
        this.haTimeoutId = null;
        // Are we authenticating
        this.authenticating = false;
        // Last ismaster
        this.ismaster = null;
        // Contains the intervalId
        this.intervalIds = [];
    }

    get type() {
        return "replset";
    }

    get parserType() {
        return "c++";
    }

    connect(options = {}) {
        // Add any connect level options to the internal state
        this.s.connectOptions = options;
        // Set connecting state
        stateTransition(this, CONNECTING);
        // Create server instances
        const servers = this.s.seedlist.map((x) => {
            return new Server(Object.assign({}, this.s.options, x, {
                authProviders: this.authProviders,
                reconnect: false,
                monitoring: false,
                inTopology: true
            }, {
                clientInfo: util.clone(this.s.clientInfo)
            }));
        });

        // Error out as high availbility interval must be < than socketTimeout
        if (this.s.options.socketTimeout > 0 && this.s.options.socketTimeout <= this.s.options.haInterval) {
            return this.emit("error", new MongoError(`haInterval [${this.s.options.haInterval}] MS must be set to less than socketTimeout [${this.s.options.socketTimeout}] MS`));
        }

        // Emit the topology opening event
        helper.emitSDAMEvent(this, "topologyOpening", { topologyId: this.id });
        // Start all server connections
        connectServers(this, servers);
    }

    destroy(options = {}) {
        // Transition state
        stateTransition(this, DESTROYED);
        // Clear out any monitoring process
        if (this.haTimeoutId) {
            clearTimeout(this.haTimeoutId);
        }
        // Destroy the replicaset
        this.s.replicaSetState.destroy(options);
        // Clear out authentication contexts
        this.s.authenticationContexts = [];

        // Destroy all connecting servers
        this.s.connectingServers.forEach((x) => {
            x.destroy(options);
        });

        // Clear out all monitoring
        for (const i of this.intervalIds) {
            clearInterval(i);
            clearTimeout(i);
        }

        // Reset list of intervalIds
        this.intervalIds = [];

        // Emit toplogy closing event
        helper.emitSDAMEvent(this, "topologyClosed", { topologyId: this.id });
    }

    unref() {
        // Transition state
        stateTransition(this, UNREFERENCED);

        this.s.replicaSetState.allServers().forEach((x) => {
            x.unref();
        });

        clearTimeout(this.haTimeoutId);
    }

    lastIsMaster() {
        // If secondaryOnlyConnectionAllowed and no primary but secondary
        // return the secondaries ismaster result.
        if (
            this.s.options.secondaryOnlyConnectionAllowed &&
            !this.s.replicaSetState.hasPrimary() &&
            this.s.replicaSetState.hasSecondary()
        ) {
            return this.s.replicaSetState.secondaries[0].lastIsMaster();
        }

        return this.s.replicaSetState.primary
            ? this.s.replicaSetState.primary.lastIsMaster()
            : this.ismaster;
    }

    connections() {
        const connections = [];
        for (const s of this.s.replicaSetState.allServers()) {
            connections.push(...s.connections());
        }
        return connections;
    }

    isConnected(options = {}) {
        // If we are authenticating signal not connected
        // To avoid interleaving of operations
        if (this.authenticating) {
            return false;
        }

        // If we specified a read preference check if we are connected to something
        // than can satisfy this
        if (options.readPreference && options.readPreference.equals(ReadPreference.secondary)) {
            return this.s.replicaSetState.hasSecondary();
        }

        if (options.readPreference && options.readPreference.equals(ReadPreference.primary)) {
            return this.s.replicaSetState.hasPrimary();
        }

        if (options.readPreference && options.readPreference.equals(ReadPreference.primaryPreferred)) {
            return this.s.replicaSetState.hasSecondary() || this.s.replicaSetState.hasPrimary();
        }

        if (options.readPreference && options.readPreference.equals(ReadPreference.secondaryPreferred)) {
            return this.s.replicaSetState.hasSecondary() || this.s.replicaSetState.hasPrimary();
        }

        if (this.s.options.secondaryOnlyConnectionAllowed && this.s.replicaSetState.hasSecondary()) {
            return true;
        }

        return this.s.replicaSetState.hasPrimary();
    }

    isDestroyed() {
        return this.state === DESTROYED;
    }

    getServer(options = {}) {
        // Pick the right server baspickServerd on readPreference
        const server = this.s.replicaSetState.pickServer(options.readPreference);
        if (this.s.debug) {
            this.emit("pickedServer", options.readPreference, server);
        }
        return server;
    }

    getConnection(options) {
        const server = this.getServer(options);
        if (server) {
            return server.getConnection();
        }
    }

    getServers() {
        return this.s.replicaSetState.allServers();
    }

    insert(ns, ops, options, callback) {
        if (is.function(options)) {
            callback = options;
            options = {};
        }
        if (this.state === DESTROYED) {
            return callback(new MongoError("topology was destroyed"));
        }

        // Not connected but we have a disconnecthandler
        if (!this.s.replicaSetState.hasPrimary() && !is.nil(this.s.disconnectHandler)) {
            return this.s.disconnectHandler.add("insert", ns, ops, options, callback);
        }

        // Execute write operation
        executeWriteOperation(this, "insert", ns, ops, options, callback);
    }

    update(ns, ops, options, callback) {
        if (is.function(options)) {
            callback = options;
            options = {};
        }
        if (this.state === DESTROYED) {
            return callback(new MongoError("topology was destroyed"));
        }

        // Not connected but we have a disconnecthandler
        if (!this.s.replicaSetState.hasPrimary() && !is.nil(this.s.disconnectHandler)) {
            return this.s.disconnectHandler.add("update", ns, ops, options, callback);
        }

        // Execute write operation
        executeWriteOperation(this, "update", ns, ops, options, callback);
    }

    remove(ns, ops, options, callback) {
        if (is.function(options)) {
            callback = options;
            options = {};
        }
        if (this.state === DESTROYED) {
            return callback(new MongoError("topology was destroyed"));
        }

        // Not connected but we have a disconnecthandler
        if (!this.s.replicaSetState.hasPrimary() && !is.nil(this.s.disconnectHandler)) {
            return this.s.disconnectHandler.add("remove", ns, ops, options, callback);
        }

        // Execute write operation
        executeWriteOperation(this, "remove", ns, ops, options, callback);
    }

    command(ns, cmd, options, callback) {
        if (is.function(options)) {
            callback = options;
            options = {};
        }
        if (this.state === DESTROYED) {
            return callback(new MongoError("topology was destroyed"));
        }

        // Establish readPreference
        const readPreference = options.readPreference ? options.readPreference : ReadPreference.primary;

        // If the readPreference is primary and we have no primary, store it
        if (
            readPreference.preference === "primary" &&
            !this.s.replicaSetState.hasPrimary() &&
            !is.nil(this.s.disconnectHandler)
        ) {
            return this.s.disconnectHandler.add("command", ns, cmd, options, callback);
        } else if (
            readPreference.preference === "secondary" &&
            !this.s.replicaSetState.hasSecondary() &&
            !is.nil(this.s.disconnectHandler)
        ) {
            return this.s.disconnectHandler.add("command", ns, cmd, options, callback);
        } else if (
            readPreference.preference !== "primary" &&
            !this.s.replicaSetState.hasSecondary() &&
            !this.s.replicaSetState.hasPrimary() &&
            !is.nil(this.s.disconnectHandler)
        ) {
            return this.s.disconnectHandler.add("command", ns, cmd, options, callback);
        }

        // Pick a server
        const server = this.s.replicaSetState.pickServer(readPreference);
        // We received an error, return it
        if (!(server instanceof Server)) {
            return callback(server);
        }
        // Emit debug event
        if (this.s.debug) {
            this.emit("pickedServer", ReadPreference.primary, server);
        }

        // No server returned we had an error
        if (is.nil(server)) {
            return callback(new MongoError(`no server found that matches the provided readPreference ${readPreference}`));
        }

        // Execute the command
        server.command(ns, cmd, options, callback);
    }

    auth(...args) {
        const [mechanism, db] = args;
        const callback = args[args.length - 1];
        let currentContextIndex = 0;

        // If we don't have the mechanism fail
        if (is.nil(this.authProviders[mechanism]) && mechanism !== "default") {
            return callback(new MongoError(`auth provider ${mechanism} does not exist`));
        }

        // Are we already authenticating, throw
        if (this.authenticating) {
            return callback(new MongoError("authentication or logout allready in process"));
        }

        // Topology is not connected, save the call in the provided store to be
        // Executed at some point when the handler deems it's reconnected
        if (!is.nil(this.s.disconnectHandler)) {
            if (!this.s.replicaSetState.hasPrimary() && !this.s.options.secondaryOnlyConnectionAllowed) {
                return this.s.disconnectHandler.add("auth", db, args, {}, callback);
            } else if (!this.s.replicaSetState.hasSecondary() && this.s.options.secondaryOnlyConnectionAllowed) {
                return this.s.disconnectHandler.add("auth", db, args, {}, callback);
            }
        }
        if (!this.s.replicaSetState.hasPrimary() && !is.nil(this.s.disconnectHandler)) {
            return this.s.disconnectHandler.add("auth", db, args, {}, callback);
        }

        args.pop();  // remove the callback

        // Set to authenticating
        this.authenticating = true;
        // All errors
        const errors = [];

        // Get all the servers
        const servers = this.s.replicaSetState.allServers();
        // No servers return
        if (servers.length === 0) {
            this.authenticating = false;
            callback(null, true);
        }

        let count = servers.length;

        // Authenticate
        const auth = (server) => {
            // Arguments without a callback
            const finalArguments = args.slice();

            finalArguments.push((err) => {
                count = count - 1;
                // Save all the errors
                if (err) {
                    errors.push({ name: server.name, err });
                }
                // We are done
                if (count === 0) {
                    // Auth is done
                    this.authenticating = false;

                    // Return the auth error
                    if (errors.length) {
                        // Remove the entry from the stored authentication contexts
                        this.s.authenticationContexts.splice(currentContextIndex, 0);
                        // Return error
                        return callback(MongoError.create({
                            message: "authentication fail", errors
                        }), false);
                    }

                    // Successfully authenticated session
                    callback(null, this);
                }
            });

            if (!server.lastIsMaster().arbiterOnly) {
                // Execute the auth only against non arbiter servers
                server.auth(...finalArguments);
            } else {
                // If we are authenticating against an arbiter just ignore it
                finalArguments.pop()(null);
            }
        };

        // Save current context index
        currentContextIndex = this.s.authenticationContexts.length;

        // Store the auth context and return the last index
        this.s.authenticationContexts.push(args.slice());

        // Authenticate against all servers
        while (servers.length > 0) {
            auth(servers.shift());
        }
    }

    logout(dbName, callback) {
        // Are we authenticating or logging out, throw
        if (this.authenticating) {
            throw new MongoError("authentication or logout allready in process");
        }

        // Ensure no new members are processed while logging out
        this.authenticating = true;

        // Remove from all auth providers (avoid any reaplication of the auth details)
        const providers = util.keys(this.authProviders);
        for (const p of providers) {
            this.authProviders[p].logout(dbName);
        }

        // Clear out any contexts associated with the db
        this.s.authenticationContexts = this.s.authenticationContexts.filter((context) => {
            return context[1] !== dbName;
        });

        // Now logout all the servers
        const servers = this.s.replicaSetState.allServers();
        let count = servers.length;
        if (count === 0) {
            return callback();
        }
        const errors = [];

        const logoutServer = (_server, cb) => {
            _server.logout(dbName, (err) => {
                if (err) {
                    errors.push({ name: _server.name, err });
                }
                cb();
            });
        };

        // Execute logout on all server instances
        const handler = () => {
            count = count - 1;

            if (count === 0) {
                // Do not block new operations
                this.authenticating = false;
                // If we have one or more errors
                if (errors.length) {
                    return callback(MongoError.create({
                        message: `logout failed against db ${dbName}`, errors
                    }), false);
                }

                // No errors
                callback();
            }
        };
        for (const s of servers) {
            logoutServer(s, handler);
        }
    }

    cursor(ns, cmd, cursorOptions = {}) {
        const FinalCursor = cursorOptions.cursorFactory || this.s.Cursor;
        return new FinalCursor(this.s.bson, ns, cmd, cursorOptions, this, this.s.options);
    }
}