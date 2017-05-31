const { is, x, shani: { util: sutil } } = adone;

const {
    __: {
        util: {
            format,
            valueToString
        }
    },
    match
} = sutil;

const deepEqual = sutil.__.util.deepEqual.use(match);

const throwYieldError = (proxy, text, args) => {
    let msg = adone.util.functionName(proxy) + text;
    if (args.length) {
        msg += ` Received [${args.join(", ")}]`;
    }
    throw new x.Exception(msg);
};

export default class SpyCall {
    constructor(spy, thisValue, args, returnValue, exception, id, errorWithCallStack) {
        if (!is.number(id)) {
            throw new x.InvalidArgument("Call id is not a number");
        }
        this.proxy = spy;
        this.thisValue = thisValue;
        this.args = args;
        this.returnValue = returnValue;
        this.exception = exception;
        this.callId = id;
        this.errorWithCallStack = errorWithCallStack;
    }

    get stack() {
        return this.errorWithCallStack && this.errorWithCallStack.stack || "";
    }

    calledOn(thisValue) {
        if (match && match.isMatcher(thisValue)) {
            return thisValue.test(this.thisValue);
        }
        return this.thisValue === thisValue;
    }

    calledWith(...calledWithArgs) {
        if (calledWithArgs.length > this.args.length) {
            return false;
        }

        return calledWithArgs.reduce((prev, arg, i) => {
            return prev && deepEqual(arg, this.args[i]);
        }, true);
    }

    calledWithMatch(...calledWithMatchArgs) {
        if (calledWithMatchArgs.length > this.args.length) {
            return false;
        }

        return calledWithMatchArgs.reduce((prev, expectation, i) => {
            const actual = this.args[i];

            return prev && (match && match(expectation).test(actual));
        }, true);
    }

    calledWithExactly(...args) {
        return arguments.length === this.args.length && this.calledWith(...args);
    }

    notCalledWith(...args) {
        return !this.calledWith(...args);
    }

    notCalledWithMatch(...args) {
        return !this.calledWithMatch(...args);
    }

    returned(value) {
        return deepEqual(value, this.returnValue);
    }

    threw(error) {
        if (is.undefined(error) || !this.exception) {
            return Boolean(this.exception);
        }

        return this.exception === error || this.exception.name === error;
    }

    calledWithNew() {
        return this.proxy.prototype && this.thisValue instanceof this.proxy;
    }

    calledBefore(other) {
        return this.callId < other.callId;
    }

    calledAfter(other) {
        return this.callId > other.callId;
    }

    calledImmediatelyBefore(other) {
        return this.callId === other.callId - 1;
    }

    calledImmediatelyAfter(other) {
        return this.callId === other.callId + 1;
    }

    callArg(pos) {
        this.args[pos]();
    }

    callArgOn(pos, thisValue) {
        this.args[pos].apply(thisValue);
    }

    callArgWith(pos, ...args) {
        this.callArgOnWith(pos, null, ...args);
    }

    callArgOnWith(pos, thisValue, ...args) {
        this.args[pos].apply(thisValue, args);
    }

    throwArg(pos) {
        if (pos > this.args.length) {
            throw new x.InvalidArgument(`Not enough arguments: ${pos} required but only ${this.args.length} present`);
        }

        throw this.args[pos];
    }

    yield(...args) {
        this.yieldOn(null, ...args);
    }

    yieldOn(thisValue, ...args) {
        const yieldFn = [...this.args].filter(is.function)[0];

        if (!yieldFn) {
            throwYieldError(this.proxy, " cannot yield since no callback was passed.", [...this.args]);
        }

        yieldFn.apply(thisValue, args);
    }

    yieldTo(prop, ...args) {
        this.yieldToOn(prop, null, ...args);
    }

    yieldToOn(prop, thisValue, ...args) {
        const yieldArg = [...this.args].filter((arg) => {
            return arg && is.function(arg[prop]);
        })[0];
        const yieldFn = yieldArg && yieldArg[prop];

        if (!yieldFn) {
            throwYieldError(this.proxy, ` cannot yield to '${valueToString(prop)}' since no callback was passed.`, [...this.args]);
        }
        yieldFn.apply(thisValue, args);
    }

    toString() {
        let callStr = this.proxy ? `${this.proxy.toString()}(` : "";

        if (!this.args) {
            return ":(";
        }

        const formattedArgs = [...this.args].map((arg) => format(arg));

        callStr = `${callStr + formattedArgs.join(", ")})`;

        if (!is.undefined(this.returnValue)) {
            callStr += ` => ${format(this.returnValue)}`;
        }

        if (this.exception) {
            callStr += ` !${this.exception.name}`;

            if (this.exception.message) {
                callStr += `(${this.exception.message})`;
            }
        }
        if (this.stack) {
            // Omit the error message and the two top stack frames:
            callStr += (this.stack.split("\n")[3] || "unknown").replace(/^\s*(?:at\s+|@)?/, " at ");
        }

        return callStr;
    }
}

SpyCall.prototype.invokeCallback = SpyCall.prototype.yield;
SpyCall.toString = SpyCall.prototype.toString;  // used by mocks
