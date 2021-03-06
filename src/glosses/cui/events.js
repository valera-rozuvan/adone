const slice = Array.prototype.slice;

export default class EventEmitter {
    constructor() {
        if (!this._events) {
            this._events = {};
        }
    }

    setMaxListeners(n) {
        this._maxListeners = n;
    }

    addListener(type, listener) {
        if (!this._events[type]) {
            this._events[type] = listener;
        } else if (typeof this._events[type] === "function") {
            this._events[type] = [this._events[type], listener];
        } else {
            this._events[type].push(listener);
        }
        this._emit("newListener", [type, listener]);
    }

    removeListener(type, listener) {
        const handler = this._events[type];
        if (!handler) {
            return;
        }

        if (typeof handler === "function" || handler.length === 1) {
            delete this._events[type];
            this._emit("removeListener", [type, listener]);
            return;
        }

        for (let i = 0; i < handler.length; i++) {
            if (handler[i] === listener || handler[i].listener === listener) {
                handler.splice(i, 1);
                this._emit("removeListener", [type, listener]);
                return;
            }
        }
    }

    removeAllListeners(type) {
        if (type) {
            delete this._events[type];
        } else {
            this._events = {};
        }
    }

    once(type, listener) {
        function on() {
            this.removeListener(type, on);
            return listener.apply(this, arguments);
        }
        on.listener = listener;
        return this.on(type, on);
    }

    listeners(type) {
        return typeof this._events[type] === "function" ? [this._events[type]] : this._events[type] || [];
    }

    _emit(type, args) {
        const handler = this._events[type];
        let ret;

        // if (type !== 'event') {
        //   this._emit('event', [type.replace(/^element /, '')].concat(args));
        // }

        if (!handler) {
            if (type === "error") {
                throw new args[0]();
            }
            return;
        }

        if (typeof handler === "function") {
            return handler.apply(this, args);
        }

        for (let i = 0; i < handler.length; i++) {
            if (handler[i].apply(this, args) === false) {
                ret = false;
            }
        }

        return ret !== false;
    }

    emit(type) {
        const args = slice.call(arguments, 1);
        const params = slice.call(arguments);
        let el = this;

        this._emit("event", params);

        if (this.type === "screen") {
            return this._emit(type, args);
        }

        if (this._emit(type, args) === false) {
            return false;
        }

        type = `element ${type}`;
        args.unshift(this);
        // `element` prefix
        // params = [type].concat(args);
        // no `element` prefix
        // params.splice(1, 0, this);

        do {
            // el._emit('event', params);
            if (!el._events[type]) {
                continue;
            }
            if (el._emit(type, args) === false) {
                return false;
            }
        } while (el = el.parent);

        return true;
    }

}

EventEmitter.prototype.on = EventEmitter.prototype.addListener;
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

// For hooking into the main EventEmitter if we want to.
// Might be better to do things this way being that it
// will always be compatible with node, not to mention
// it gives us domain support as well.
// Node.prototype._emit = Node.prototype.emit;
// Node.prototype.emit = function(type) {
//   var args, el;
//
//   if (this.type === 'screen') {
//     return this._emit.apply(this, arguments);
//   }
//
//   this._emit.apply(this, arguments);
//   if (this._bubbleStopped) return false;
//
//   args = slice.call(arguments, 1);
//   el = this;
//
//   args.unshift('element ' + type, this);
//   this._bubbleStopped = false;
//   //args.push(stopBubble);
//
//   do {
//     if (!el._events || !el._events[type]) continue;
//     el._emit.apply(el, args);
//     if (this._bubbleStopped) return false;
//   } while (el = el.parent);
//
//   return true;
// };
//
// Node.prototype._addListener = Node.prototype.addListener;
// Node.prototype.on =
// Node.prototype.addListener = function(type, listener) {
//   function on() {
//     if (listener.apply(this, arguments) === false) {
//       this._bubbleStopped = true;
//     }
//   }
//   on.listener = listener;
//   return this._addListener(type, on);
// };
