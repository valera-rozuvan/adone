// @flow

import adone from "adone";

const { is, x, util, fast: { Fast } } = adone;

const defaultMode = 0o777 & (~process.umask());

function normalize(mode) {
    if (mode === null || mode === undefined) {
        return mode;
    }
    let called = false;
    const newMode = {
        owner: {},
        group: {},
        others: {}
    };

    ["read", "write", "execute"].forEach((key) => {
        if (is.boolean(mode[key])) {
            newMode.owner[key] = mode[key];
            newMode.group[key] = mode[key];
            newMode.others[key] = mode[key];
            called = true;
        }
    });

    return called ? newMode : mode;
}

function assign(a, b) {
    for (const key of Object.keys(b)) {
        if (is.object(b[key])) {
            assign(a[key], b[key]);
        } else if (key in a) {
            a[key] = b[key];
        }
    }
}

export default function chmod(mode, dirMode) {
    if (mode !== null && mode !== undefined && !is.number(mode) && !is.object(mode)) {
        throw new x.InvalidArgument("Expected mode to be null/undefined/number/Object");
    }

    if (dirMode === true) {
        dirMode = mode;
    }
    if (dirMode !== null && dirMode !== undefined && !is.number(dirMode) && !is.object(dirMode)) {
        throw new TypeError("Expected dirMode to be null/undefined/true/number/Object");
    }

    const nMode = normalize(mode);
    const nDirMode = normalize(dirMode);

    return new Fast(null, {
        transform(file) {
            let [curMode, ncurMode] = [mode, nMode];
            if (file.isNull() && file.stat && file.stat.isDirectory()) {
                [curMode, ncurMode] = [dirMode, nDirMode];
            }

            if (curMode === undefined || curMode === null) {
                this.push(file);
                return;
            }

            file.stat = file.stat || {};
            file.stat.mode = file.stat.mode || defaultMode;

            if (is.object(curMode)) {
                const statMode = new util.Mode(file.stat);
                assign(statMode, ncurMode);
                file.stat.mode = statMode.stat.mode;
            } else {
                file.stat.mode = curMode;
            }
            this.push(file);
        }
    });
}
