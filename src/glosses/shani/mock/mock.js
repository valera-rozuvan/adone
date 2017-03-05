/**
 * Mock functions.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
import mockExpectation from "./mock-expectation";
import { toString as spyCallToString } from "./call";
import extend from "./util/extend";
import deepEqual from "./util/deep-equal";
import wrapMethod from "./util/wrap-method";

const push = Array.prototype.push;

function mock(object) {
    if (!object) {
        return mockExpectation.create("Anonymous mock");
    }

    return mock.create(object);
}

function each(collection, callback) {
    if (!collection) {
        return;
    }

    for (let i = 0, l = collection.length; i < l; i += 1) {
        callback(collection[i]);
    }
}

function arrayEquals(arr1, arr2, compareLength) {
    if (compareLength && (arr1.length !== arr2.length)) {
        return false;
    }

    for (let i = 0, l = arr1.length; i < l; i++) {
        if (!deepEqual(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;
}

extend(mock, {
    create: function create(object) {
        if (!object) {
            throw new TypeError("object is null");
        }

        const mockObject = extend({}, mock);
        mockObject.object = object;
        delete mockObject.create;

        return mockObject;
    },

    expects: function expects(method) {
        if (!method) {
            throw new TypeError("method is falsy");
        }

        if (!this.expectations) {
            this.expectations = {};
            this.proxies = [];
            this.failures = [];
        }

        if (!this.expectations[method]) {
            this.expectations[method] = [];
            const mockObject = this;

            wrapMethod(this.object, method, function () {
                return mockObject.invokeMethod(method, this, arguments);
            });

            push.call(this.proxies, method);
        }

        const expectation = mockExpectation.create(method);
        push.call(this.expectations[method], expectation);

        return expectation;
    },

    restore: function restore() {
        const object = this.object;

        each(this.proxies, function (proxy) {
            if (typeof object[proxy].restore === "function") {
                object[proxy].restore();
            }
        });
    },

    verify: function verify() {
        const expectations = this.expectations || {};
        const messages = this.failures ? this.failures.slice() : [];
        const met = [];

        each(this.proxies, function (proxy) {
            each(expectations[proxy], function (expectation) {
                if (!expectation.met()) {
                    push.call(messages, expectation.toString());
                } else {
                    push.call(met, expectation.toString());
                }
            });
        });

        this.restore();

        if (messages.length > 0) {
            mockExpectation.fail(messages.concat(met).join("\n"));
        } else if (met.length > 0) {
            mockExpectation.pass(messages.concat(met).join("\n"));
        }

        return true;
    },

    invokeMethod: function invokeMethod(method, thisValue, args) {
        /* if we cannot find any matching files we will explicitly call mockExpection#fail with error messages */
        /* eslint consistent-return: "off" */

        const expectations = this.expectations && this.expectations[method] ? this.expectations[method] : [];
        const expectationsWithMatchingArgs = [];
        const currentArgs = args || [];
        let available;

        for (let i = 0; i < expectations.length; i += 1) {
            const expectedArgs = expectations[i].expectedArguments || [];
            if (arrayEquals(expectedArgs, currentArgs, expectations[i].expectsExactArgCount)) {
                expectationsWithMatchingArgs.push(expectations[i]);
            }
        }

        for (let i = 0; i < expectationsWithMatchingArgs.length; i += 1) {
            if (!expectationsWithMatchingArgs[i].met() &&
                expectationsWithMatchingArgs[i].allowsCall(thisValue, args)) {
                return expectationsWithMatchingArgs[i].apply(thisValue, args);
            }
        }

        const messages = [];
        let exhausted = 0;

        for (let i = 0; i < expectationsWithMatchingArgs.length; i += 1) {
            if (expectationsWithMatchingArgs[i].allowsCall(thisValue, args)) {
                available = available || expectationsWithMatchingArgs[i];
            } else {
                exhausted += 1;
            }
        }

        if (available && exhausted === 0) {
            return available.apply(thisValue, args);
        }

        for (let i = 0; i < expectations.length; i += 1) {
            push.call(messages, "    " + expectations[i].toString());
        }

        messages.unshift("Unexpected call: " + spyCallToString.call({
            proxy: method,
            args: args
        }));

        const err = new Error();
        if (!err.stack) {
            // PhantomJS does not serialize the stack trace until the error has been thrown
            try {
                throw err;
            } catch (e) { /* empty */ }
        }
        this.failures.push("Unexpected call: " + spyCallToString.call({
            proxy: method,
            args: args,
            stack: err.stack
        }));

        mockExpectation.fail(messages.join("\n"));
    }
});

export default mock;
