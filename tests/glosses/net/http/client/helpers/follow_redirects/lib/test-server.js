// provides boilerplate for managing http and https servers during tests

const http = require("http");
const https = require("https");
const assert = require("assert");
const BPromise = require("bluebird");

module.exports = function (defaultPorts) {
	// set default ports for each protocol i.e. {http: 80, https: 443}
    defaultPorts = defaultPorts || {};
    let servers = [];

	/**
	 * Starts a server
	 *
	 * If options is a function, uses that the request handler for a `http` server on the default port.
	 * options.protocol - the protocol to use (`http` or `https`). Defaults to `http`.
	 * options.port - the port to use, will fall back to defaultPorts[protocol].
	 * options.app - the request handler passed to http|https.createServer
	 *
	 * the options object will also be passed to as the https config for https servers
	 *
	 * @param options
	 * @returns {Promise} that resolves when the server successfully started
	 */
    function start(options) {
        return BPromise.fromNode((callback) => {
            if (typeof options === "function") {
                options = {
                    app: options
                };
            }
            assert(typeof options.app, "function", "app");
            let server;
            let port;
            const protocol = options.protocol;
            if (!protocol || protocol.trim().match(/^http(:)?$/)) {
                server = http.createServer(options.app);
                port = options.port || defaultPorts.http;
            } else if (protocol.trim().match(/^https(:)?$/)) {
                server = https.createServer(options, options.app);
                port = options.port || defaultPorts.https;
            }
            assert(typeof port, "number", "port");
            servers.push(server);
            server.listen(port, callback);
        });
    }

	/**
	 * Stops all the currently running servers previously created with `start`
	 * @returns {Promise} that resolves when all servers have successfully shut down.
	 */
    function stop() {
        return BPromise.all(servers.map(stopServer)).finally(clearServers);
    }

    function stopServer(server) {
        return BPromise.fromNode((callback) => {
            server.close(callback);
        });
    }

    function clearServers() {
        servers = [];
    }

    return {
        start,
        stop
    };
};
