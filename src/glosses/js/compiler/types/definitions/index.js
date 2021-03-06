import * as t from "../index";

const { is } = adone;

export const VISITOR_KEYS = {};
export const ALIAS_KEYS = {};
export const NODE_FIELDS = {};
export const BUILDER_KEYS = {};
export const DEPRECATED_KEYS = {};

const getType = (val) => {
    if (is.array(val)) {
        return "array";
    } else if (is.null(val)) {
        return "null";
    } else if (is.undefined(val)) {
        return "undefined";
    }
    return typeof val;

};

export const assertEach = (callback) => {
    const validator = (node, key, val) => {
        if (!is.array(val)) {
            return;
        }

        for (let i = 0; i < val.length; i++) {
            callback(node, `${key}[${i}]`, val[i]);
        }
    };
    validator.each = callback;
    return validator;
};

export const assertOneOf = (...vals) => {
    const validate = (node, key, val) => {
        if (vals.indexOf(val) < 0) {
            throw new TypeError(
                `Property ${key} expected value to be one of ${JSON.stringify(vals)} but got ${JSON.stringify(val)}`
            );
        }
    };

    validate.oneOf = vals;

    return validate;
};

export const assertNodeType = (...types) => {
    const validate = (node, key, val) => {
        let valid = false;

        for (const type of types) {
            if (t.is(type, val)) {
                valid = true;
                break;
            }
        }

        if (!valid) {
            throw new TypeError(
                `Property ${key} of ${node.type} expected node to be of a type ${JSON.stringify(types)} ` +
                `but instead got ${JSON.stringify(val && val.type)}`
            );
        }
    };

    validate.oneOfNodeTypes = types;

    return validate;
};

export const assertNodeOrValueType = (...types) => {
    const validate = (node, key, val) => {
        let valid = false;

        for (const type of types) {
            if (getType(val) === type || t.is(type, val)) {
                valid = true;
                break;
            }
        }

        if (!valid) {
            throw new TypeError(
                `Property ${key} of ${node.type} expected node to be of a type ${JSON.stringify(types)} ` +
                `but instead got ${JSON.stringify(val && val.type)}`
            );
        }
    };

    validate.oneOfNodeOrValueTypes = types;

    return validate;
};

export const assertValueType = (type) => {
    const validate = (node, key, val) => {
        const valid = getType(val) === type;

        if (!valid) {
            throw new TypeError(`Property ${key} expected type of ${type} but got ${getType(val)}`);
        }
    };

    validate.type = type;

    return validate;
};

export const chain = (...fns) => {
    const validate = (...args) => {
        for (const fn of fns) {
            fn(...args);
        }
    };
    validate.chainOf = fns;
    return validate;
};


const store = {};

export default function defineType(type, opts = {}) {
    const inherits = (opts.inherits && store[opts.inherits]) || {};

    opts.fields = opts.fields || inherits.fields || {};
    opts.visitor = opts.visitor || inherits.visitor || [];
    opts.aliases = opts.aliases || inherits.aliases || [];
    opts.builder = opts.builder || inherits.builder || opts.visitor || [];

    if (opts.deprecatedAlias) {
        DEPRECATED_KEYS[opts.deprecatedAlias] = type;
    }

    // ensure all field keys are represented in `fields`
    for (const key of opts.visitor.concat(opts.builder)) {
        opts.fields[key] = opts.fields[key] || {};
    }

    for (const key in opts.fields) {
        const field = opts.fields[key];

        if (opts.builder.indexOf(key) === -1) {
            field.optional = true;
        }
        if (is.undefined(field.default)) {
            field.default = null;
        } else if (!field.validate) {
            field.validate = assertValueType(getType(field.default));
        }
    }

    VISITOR_KEYS[type] = opts.visitor;
    BUILDER_KEYS[type] = opts.builder;
    NODE_FIELDS[type] = opts.fields;
    ALIAS_KEYS[type] = opts.aliases;

    store[type] = opts;
}
