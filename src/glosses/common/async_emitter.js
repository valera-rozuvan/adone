const { is, util } = adone;

export default class AsyncEmitter extends adone.EventEmitter {
    constructor(concurrency = null) {
        super();
        if (concurrency >= 1) {
            this.setConcurrency(concurrency);
        }
        this._onceMapping = new Map();
    }

    setConcurrency(max = null) {
        if (max >= 1) {
            this.manager = util.throttle({ max });
        } else {
            this.manager = null;
        }
        return this;
    }

    emitParallel(event, ...args) {
        const promises = [];

        this.listeners(event).forEach((listener) => {
            promises.push(this._executeListener(listener, args));
        });

        return Promise.all(promises);
    }

    emitSerial(event, ...args) {
        return this.listeners(event).reduce((promise, listener) => promise.then((values) =>
            this._executeListener(listener, args).then((value) => {
                values.push(value);
                return values;
            })
        ), Promise.resolve([]));
    }

    emitReduce(event, ...args) {
        return this._emitReduceRun(event, args);
    }

    emitReduceRight(event, ...args) {
        return this._emitReduceRun(event, args, true);
    }

    once(event, listener) {
        if (!is.function(listener)) {
            throw new TypeError("listener must be a function");
        }
        let fired = false;
        const self = this;
        const onceListener = function (...args) {
            self.removeListener(event, onceListener);
            if (fired === false) {
                fired = true;
                return listener.apply(this, args);
            }
            return undefined;
        };
        this.on(event, onceListener);
        this._onceMapping.set(listener, onceListener);
        return this;
    }

    removeListener(event, listener) {
        if (this._onceMapping.has(listener)) {
            const t = this._onceMapping.get(listener);
            this._onceMapping.delete(listener);
            listener = t;
        }
        return super.removeListener(event, listener);
    }

    subscribe(event, listener, once = false) {
        const unsubscribe = () => {
            this.removeListener(event, listener);
        };

        if (once) {
            this.once(event, listener);
        } else {
            this.on(event, listener);
        }

        return unsubscribe;
    }

    _emitReduceRun(event, args, inverse = false) {
        const listeners = inverse ? this.listeners(event).reverse() : this.listeners(event);
        return listeners.reduce((promise, listener) => promise.then((prevArgs) => {
            const currentArgs = is.array(prevArgs) ? prevArgs : [prevArgs];
            return this._executeListener(listener, currentArgs);
        }), Promise.resolve(args));
    }

    _executeListener(listener, args) {
        try {
            if (this.manager) {
                return this.manager(() => listener(...args));
            }
            return Promise.resolve(listener(...args));
        } catch (err) {
            return Promise.reject(err);
        }
    }
}
