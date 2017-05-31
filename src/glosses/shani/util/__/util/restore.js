const {
    is,
    shani: { util: { __: { util: { walk } } } }
} = adone;

const isRestorable = (obj) => is.function(obj) && is.function(obj.restore) && obj.restore[Symbol.for("shani:restorable")];

export default function restore(object) {
    if (!is.null(object) && is.plainObject(object)) {
        walk(object, (prop) => {
            if (isRestorable(object[prop])) {
                object[prop].restore();
            }
        });
    } else if (isRestorable(object)) {
        object.restore();
    }
}
