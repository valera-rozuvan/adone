/* !
 * checkError utility
 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */



const getFunctionName = adone.util.functionName;
/**
 * ### .checkError
 *
 * Checks that an error conforms to a given set of criteria and/or retrieves information about it.
 *
 * @api public
 */

/**
 * ### .compatibleInstance(thrown, errorLike)
 *
 * Checks if two instances are compatible (strict equal).
 * Returns false if errorLike is not an instance of Error, because instances
 * can only be compatible if they're both error instances.
 *
 * @name compatibleInstance
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

export function compatibleInstance(thrown, errorLike) {
    return errorLike instanceof Error && thrown === errorLike;
}

/**
 * ### .compatibleConstructor(thrown, errorLike)
 *
 * Checks if two constructors are compatible.
 * This function can receive either an error constructor or
 * an error instance as the `errorLike` argument.
 * Constructors are compatible if they're the same or if one is
 * an instance of another.
 *
 * @name compatibleConstructor
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

export function compatibleConstructor(thrown, errorLike) {
    if (errorLike instanceof Error) {
        // If `errorLike` is an instance of any error we compare their constructors
        return thrown.constructor === errorLike.constructor || thrown instanceof errorLike.constructor;
    } else if (errorLike.prototype instanceof Error || errorLike === Error) {
        // If `errorLike` is a constructor that inherits from Error, we compare `thrown` to `errorLike` directly
        return thrown.constructor === errorLike || thrown instanceof errorLike;
    }

    return false;
}

/**
 * ### .compatibleMessage(thrown, errMatcher)
 *
 * Checks if an error's message is compatible with a matcher (String or RegExp).
 * If the message contains the String or passes the RegExp test,
 * it is considered compatible.
 *
 * @name compatibleMessage
 * @param {Error} thrown error
 * @param {String|RegExp} errMatcher to look for into the message
 * @namespace Utils
 * @api public
 */

export function compatibleMessage(thrown, errMatcher) {
    const comparisonString = adone.is.string(thrown) ? thrown : thrown.message;
    if (errMatcher instanceof RegExp) {
        return errMatcher.test(comparisonString);
    } else if (adone.is.string(errMatcher)) {
        return comparisonString.indexOf(errMatcher) !== -1; // eslint-disable-line no-magic-numbers
    }

    return false;
}

/**
 * ### .getConstructorName(errorLike)
 *
 * Gets the constructor name for an Error instance or constructor itself.
 *
 * @name getConstructorName
 * @param {Error|ErrorConstructor} errorLike
 * @namespace Utils
 * @api public
 */

export function getConstructorName(errorLike) {
    let constructorName = errorLike;
    if (errorLike instanceof Error) {
        constructorName = getFunctionName(errorLike.constructor);
    } else if (adone.is.function(errorLike)) {
        // If `err` is not an instance of Error it is an error constructor itself or another function.
        // If we've got a common function we get its name, otherwise we may need to create a new instance
        // of the error just in case it's a poorly-constructed error.
        constructorName = getFunctionName(errorLike);
        if (constructorName === "") {
            const newConstructorName = getFunctionName(new errorLike()); // eslint-disable-line babel/new-cap
            constructorName = newConstructorName || constructorName;
        }
    }

    return constructorName;
}

/**
 * ### .getMessage(errorLike)
 *
 * Gets the error message from an error.
 * If `err` is a String itself, we return it.
 * If the error has no message, we return an empty string.
 *
 * @name getMessage
 * @param {Error|String} errorLike
 * @namespace Utils
 * @api public
 */

export function getMessage(errorLike) {
    let msg = "";
    if (errorLike && errorLike.message) {
        msg = errorLike.message;
    } else if (adone.is.string(errorLike)) {
        msg = errorLike;
    }

    return msg;
}