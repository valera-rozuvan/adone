/**
 * Collections of stubs, spies and mocks.
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
import getPropertyDescriptor from "./util/get-property-descriptor";
import $spy from "./spy";
import $stub from "./stub";
import $mock from "./mock";
import walk from "./util/walk";
import valueToString from "./util/value-to-string";

const push = [].push;
const hasOwnProperty = Object.prototype.hasOwnProperty;

function getFakes(fakeCollection) {
    if (!fakeCollection.fakes) {
        fakeCollection.fakes = [];
    }

    return fakeCollection.fakes;
}

function each(fakeCollection, method) {
    const fakes = getFakes(fakeCollection);

    for (let i = 0, l = fakes.length; i < l; i += 1) {
        if (typeof fakes[i][method] === "function") {
            fakes[i][method]();
        }
    }
}

function compact(fakeCollection) {
    const fakes = getFakes(fakeCollection);
    const i = 0;
    while (i < fakes.length) {
        fakes.splice(i, 1);
    }
}

const collection = {
    verify: function verify() {
        each(this, "verify");
    },

    restore: function restore() {
        each(this, "restore");
        compact(this);
    },

    reset: function reset() {
        each(this, "reset");
    },

    resetBehavior: function resetBehavior() {
        each(this, "resetBehavior");
    },

    resetHistory: function resetHistory() {
        each(this, "resetHistory");
    },

    verifyAndRestore: function verifyAndRestore() {
        let exception;

        try {
            this.verify();
        } catch (e) {
            exception = e;
        }

        this.restore();

        if (exception) {
            throw exception;
        }
    },

    add: function add(fake) {
        push.call(getFakes(this), fake);
        return fake;
    },

    spy: function spy() {
        return this.add($spy.apply($spy, arguments));
    },

    stub: function stub(object, property, value) {
        if (property) {
            if (!object) {
                const type = object === null ? "null" : "undefined";
                throw new Error("Trying to stub property '" + valueToString(property) + "' of " + type);
            }

            const original = object[property];

            if (typeof original !== "function") {
                if (!hasOwnProperty.call(object, property)) {
                    throw new TypeError("Cannot stub non-existent own property " + valueToString(property));
                }

                object[property] = value;

                return this.add({
                    restore() {
                        object[property] = original;
                    }
                });
            }
        }
        if (!property && !!object && typeof object === "object") {
            const col = this;
            const stubbedObj = $stub.apply(null, arguments);

            walk(stubbedObj, function (prop, propOwner) {
                if (
                    typeof getPropertyDescriptor(propOwner, prop).value === "function" &&
                    stubbedObj.hasOwnProperty(prop)
                ) {
                    col.add(stubbedObj[prop]);
                }
            });

            return stubbedObj;
        }

        return this.add($stub.apply(null, arguments));
    },

    mock: function mock() {
        return this.add($mock.apply(null, arguments));
    },

    inject: function inject(obj) {
        const col = this;

        obj.spy = function () {
            return col.spy.apply(col, arguments);
        };

        obj.stub = function () {
            return col.stub.apply(col, arguments);
        };

        obj.mock = function () {
            return col.mock.apply(col, arguments);
        };

        return obj;
    }
};

export default collection;
