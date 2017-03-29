const EventEmitter = require("events").EventEmitter;
const inherits = require("util").inherits;
const deprecate = require("util").deprecate;
const DeferredLevelDOWN = require("deferred-leveldown");
const IteratorStream = require("level-iterator-stream");

const errors = require("level-errors");
const WriteError = errors.WriteError;
const ReadError = errors.ReadError;
const NotFoundError = errors.NotFoundError;
const OpenError = errors.OpenError;
const EncodingError = errors.EncodingError;
const InitializationError = errors.InitializationError;

const util = require("./util");
const Batch = require("./batch");
const Codec = require("level-codec");

const getOptions = util.getOptions;
const defaultOptions = util.defaultOptions;
const getLevelDOWN = util.getLevelDOWN;
const dispatchError = util.dispatchError;

function getCallback(options, callback) {
    return typeof options === "function" ? options : callback;
}

// Possible LevelUP#_status values:
//  - 'new'     - newly created, not opened or closed
//  - 'opening' - waiting for the database to be opened, post open()
//  - 'open'    - successfully opened the database, available for use
//  - 'closing' - waiting for the database to be closed, post close()
//  - 'closed'  - database has been successfully closed, should not be
//                 used except for another open() operation

function LevelUP(location, options, callback) {
    if (!(this instanceof LevelUP)) {
        return new LevelUP(location, options, callback);
    }

    let error;

    EventEmitter.call(this);
    this.setMaxListeners(Infinity);

    if (typeof location === "function") {
        options = typeof options === "object" ? options : {};
        options.db = location;
        location = null;
    } else if (typeof location === "object" && typeof location.db === "function") {
        options = location;
        location = null;
    }


    if (typeof options === "function") {
        callback = options;
        options = {};
    }

    if ((!options || typeof options.db !== "function") && typeof location !== "string") {
        error = new InitializationError(
            "Must provide a location for the database");
        if (callback) {
            return process.nextTick(() => {
                callback(error);
            });
        }
        throw error;
    }

    options = getOptions(options);
    this.options = adone.vendor.lodash.extend(defaultOptions, options);
    this._codec = new Codec(this.options);
    this._status = "new";
    // set this.location as enumerable but not configurable or writable
    Object.defineProperty(this, "location", {
        enumerable: true,
        value: location
    });

    this.open(callback);
}

inherits(LevelUP, EventEmitter);

LevelUP.prototype.open = function (callback) {
    const self = this;

    if (this.isOpen()) {
        if (callback) {
            process.nextTick(() => {
                callback(null, self);
            });
        }
        return this;
    }

    if (this._isOpening()) {
        return callback && this.once(
            "open"
            , () => {
                callback(null, self);
            }
        );
    }

    this.emit("opening");

    this._status = "opening";
    this.db = new DeferredLevelDOWN(this.location);
    const dbFactory = this.options.db || getLevelDOWN();
    const db = dbFactory(this.location);

    db.open(this.options, (err) => {
        if (err) {
            return dispatchError(self, new OpenError(err), callback);
        } else {
            self.db.setDb(db);
            self.db = db;
            self._status = "open";
            if (callback) {
                callback(null, self);
            }
            self.emit("open");
            self.emit("ready");
        }
    });
};

LevelUP.prototype.close = function (callback) {
    const self = this;

    if (this.isOpen()) {
        this._status = "closing";
        this.db.close(function () {
            self._status = "closed";
            self.emit("closed");
            if (callback) {
                callback.apply(null, arguments);
            }
        });
        this.emit("closing");
        this.db = new DeferredLevelDOWN(this.location);
    } else if (this._status === "closed" && callback) {
        return process.nextTick(callback);
    } else if (this._status === "closing" && callback) {
        this.once("closed", callback);
    } else if (this._isOpening()) {
        this.once("open", () => {
            self.close(callback);
        });
    }
};

LevelUP.prototype.isOpen = function () {
    return this._status === "open";
};

LevelUP.prototype._isOpening = function () {
    return this._status == "opening";
};

LevelUP.prototype.isClosed = function () {
    return (/^clos/).test(this._status);
};

function maybeError(db, options, callback) {
    if (!db._isOpening() && !db.isOpen()) {
        dispatchError(
            db
            , new ReadError("Database is not open")
            , callback
        );
        return true;
    }
}

function writeError(db, message, callback) {
    dispatchError(
        db
        , new WriteError(message)
        , callback
    );
}

function readError(db, message, callback) {
    dispatchError(
        db
        , new ReadError(message)
        , callback
    );
}


LevelUP.prototype.get = function (key_, options, callback) {
    let self = this
        , key;

    callback = getCallback(options, callback);

    if (maybeError(this, options, callback)) {
        return;
    }

    if (key_ === null || key_ === undefined || typeof callback !== "function") {
        return readError(this
            , "get() requires key and callback arguments", callback);
    }

    options = util.getOptions(options);
    key = this._codec.encodeKey(key_, options);

    options.asBuffer = this._codec.valueAsBuffer(options);

    this.db.get(key, options, (err, value) => {
        if (err) {
            if ((/notfound/i).test(err) || err.notFound) {
                err = new NotFoundError(
                    `Key not found in database [${key_}]`, err);
            } else {
                err = new ReadError(err);
            }
            return dispatchError(self, err, callback);
        }
        if (callback) {
            try {
                value = self._codec.decodeValue(value, options);
            } catch (e) {
                return callback(new EncodingError(e));
            }
            callback(null, value);
        }
    });
};

LevelUP.prototype.put = function (key_, value_, options, callback) {
    let self = this
        , key
        , value;

    callback = getCallback(options, callback);

    if (key_ === null || key_ === undefined) {
        return writeError(this, "put() requires a key argument", callback);
    }

    if (maybeError(this, options, callback)) {
        return;
    }

    options = getOptions(options);
    key = this._codec.encodeKey(key_, options);
    value = this._codec.encodeValue(value_, options);

    this.db.put(key, value, options, (err) => {
        if (err) {
            return dispatchError(self, new WriteError(err), callback);
        } else {
            self.emit("put", key_, value_);
            if (callback) {
                callback();
            }
        }
    });
};

LevelUP.prototype.del = function (key_, options, callback) {
    let self = this
        , key;

    callback = getCallback(options, callback);

    if (key_ === null || key_ === undefined) {
        return writeError(this, "del() requires a key argument", callback);
    }

    if (maybeError(this, options, callback)) {
        return;
    }

    options = getOptions(options);
    key = this._codec.encodeKey(key_, options);

    this.db.del(key, options, (err) => {
        if (err) {
            return dispatchError(self, new WriteError(err), callback);
        } else {
            self.emit("del", key_);
            if (callback) {
                callback();
            }
        }
    });
};

LevelUP.prototype.batch = function (arr_, options, callback) {
    const self = this;
    let arr;

    if (!arguments.length) {
        return new Batch(this, this._codec);
    }

    callback = getCallback(options, callback);

    if (!Array.isArray(arr_)) {
        return writeError(this, "batch() requires an array argument", callback);
    }

    if (maybeError(this, options, callback)) {
        return;
    }

    options = getOptions(options);
    arr = self._codec.encodeBatch(arr_, options);
    arr = arr.map((op) => {
        if (!op.type && op.key !== undefined && op.value !== undefined) {
            op.type = "put";
        }
        return op;
    });

    this.db.batch(arr, options, (err) => {
        if (err) {
            return dispatchError(self, new WriteError(err), callback);
        } else {
            self.emit("batch", arr_);
            if (callback) {
                callback();
            }
        }
    });
};

LevelUP.prototype.approximateSize = deprecate(function (start_, end_, options, callback) {
    const self = this;

    callback = getCallback(options, callback);

    options = getOptions(options);

    if (start_ === null || start_ === undefined || end_ === null || end_ === undefined || typeof callback !== "function") {
        return readError(this, "approximateSize() requires start, end and callback arguments", callback);
    }

    const start = this._codec.encodeKey(start_, options);
    const end = this._codec.encodeKey(end_, options);

    this.db.approximateSize(start, end, (err, size) => {
        if (err) {
            return dispatchError(self, new OpenError(err), callback);
        } else if (callback) {
            callback(null, size);
        }
    });
}, "db.approximateSize() is deprecated. Use db.db.approximateSize() instead");

LevelUP.prototype.readStream = LevelUP.prototype.createReadStream = function (options) {
    options = adone.vendor.lodash.extend({ keys: true, values: true }, this.options, options);

    options.keyEncoding = options.keyEncoding;
    options.valueEncoding = options.valueEncoding;

    options = this._codec.encodeLtgt(options);
    options.keyAsBuffer = this._codec.keyAsBuffer(options);
    options.valueAsBuffer = this._codec.valueAsBuffer(options);

    if (typeof options.limit !== "number") {
        options.limit = -1;
    }

    return new IteratorStream(this.db.iterator(options), adone.vendor.lodash.extend(options, {
        decoder: this._codec.createStreamDecoder(options)
    }));
};

LevelUP.prototype.keyStream = LevelUP.prototype.createKeyStream = function (options = {}) {
    return this.createReadStream(adone.vendor.lodash.extend(options, { keys: true, values: false }));
};

LevelUP.prototype.valueStream = LevelUP.prototype.createValueStream = function (options = {}) {
    return this.createReadStream(adone.vendor.lodash.extend(options, { keys: false, values: true }));
};

LevelUP.prototype.toString = function () {
    return "LevelUP";
};

module.exports = LevelUP;
module.exports.errors = require("level-errors");