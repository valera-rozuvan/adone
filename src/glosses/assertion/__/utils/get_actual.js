/*!
 * getActual utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * # getActual(object, [actual])
 *
 * Returns the `actual` value for an Assertion.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} assert.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getActual
 */

export default function getActual(obj, args) {
    return args.length > 4 ? args[4] : obj._obj;
}
