// Adapted from https://developer.mozilla.org/en/docs/ECMAScript_DontEnum_attribute#JScript_DontEnum_Bug
const hasDontEnumBug = (function () {
    const obj = {
        constructor: function () {
            return "0";
        },
        toString: function () {
            return "1";
        },
        valueOf: function () {
            return "2";
        },
        toLocaleString: function () {
            return "3";
        },
        prototype: function () {
            return "4";
        },
        isPrototypeOf: function () {
            return "5";
        },
        propertyIsEnumerable: function () {
            return "6";
        },
        hasOwnProperty: function () {
            return "7";
        },
        length: function () {
            return "8";
        },
        unique: function () {
            return "9";
        }
    };

    const result = [];
    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            result.push(obj[prop]());
        }
    }
    return result.join("") !== "0123456789";
})();

/* Public: Extend target in place with all (own) properties from sources in-order. Thus, last source will
 *         override properties in previous sources.
 *
 * target - The Object to extend
 * sources - Objects to copy properties from.
 *
 * Returns the extended target
 */
export default function extend(target /*, sources */) {
    const sources = Array.prototype.slice.call(arguments, 1);

    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];

        for (const prop in source) {
            if (source.hasOwnProperty(prop)) {
                target[prop] = source[prop];
            }
        }

        // Make sure we copy (own) toString method even when in JScript with DontEnum bug
        // See https://developer.mozilla.org/en/docs/ECMAScript_DontEnum_attribute#JScript_DontEnum_Bug
        if (hasDontEnumBug && source.hasOwnProperty("toString") && source.toString !== target.toString) {
            target.toString = source.toString;
        }
    }

    return target;
}
