const { is } = adone;

// Iterator that traverses in the range of [min, max], stepping
// by distance from a given start position. I.e. for [0, 4], with
// start of 2, this will iterate 2, 3, 1, 4, 0.
export const distanceIterator = (start, minLine, maxLine) => {
    let wantForward = true;
    let backwardExhausted = false;
    let forwardExhausted = false;
    let localOffset = 1;

    return function iterator() {
        if (wantForward && !forwardExhausted) {
            if (backwardExhausted) {
                localOffset++;
            } else {
                wantForward = false;
            }

            // Check if trying to fit beyond text length, and if not, check it fits
            // after offset location (or desired location on first iteration)
            if (start + localOffset <= maxLine) {
                return localOffset;
            }

            forwardExhausted = true;
        }

        if (!backwardExhausted) {
            if (!forwardExhausted) {
                wantForward = true;
            }

            // Check if trying to fit before text beginning, and if not, check it fits
            // before offset location
            if (minLine <= start - localOffset) {
                return -localOffset++;
            }

            backwardExhausted = true;
            return iterator();
        }

        // We tried to fit hunk before text beginning and beyond text length, then
        // hunk can't fit on the text. Return undefined
    };
};

export const generateOptions = (options, defaults) => {
    if (is.function(options)) {
        defaults.callback = options;
    } else if (options) {
        for (const name in options) {
            /* istanbul ignore else */
            if (options.hasOwnProperty(name)) {
                defaults[name] = options[name];
            }
        }
    }
    return defaults;
};
