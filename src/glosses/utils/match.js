export default function match(criteria, value = null, { index = false, start = 0, end = null, dot = false } = {}) {
    criteria = adone.util.arrify(criteria);
    if (value === null) {
        // it means we should create a matcher function
        return (value, opts) => match(criteria, value, opts);  // TODO: optimize
    }
    value = adone.util.arrify(value);
    if (end === null) {
        end = criteria.length;
    }
    // separate negative and non-negative criteria
    const neg = [];
    const pos = [];
    for (let i = start; i < end; ++i) {
        let criterion = criteria[i];
        let array = pos;
        if (adone.is.string(criterion) && criterion[0] === "!") {
            array = neg;
            criterion = criterion.slice(1);  // remove the leading "!"
        }
        array.push([i, criterion]);
    }
    // there is no negation, check the positive
    const string = value[0];
    const altString = adone.std.path.sep === "\\" && adone.util.normalizePath(string);
    const altValue = altString && [altString, ...value.slice(1)];

    // firstly check the negative
    for (const [, n] of neg) {
        if (adone.util.GlobExp.test(string, n, { dot }) || (altString && adone.util.GlobExp.test(altString, n, { dot }))) {
            return index ? -1 : false;
        }
    }

    if (pos.length === 0 && neg.length !== 0) {
        // if there is no positive cases assume everything that is not negative to be positive
        return true;
    }

    for (const [idx, p] of pos) {
        if (adone.is.function(p) && (p(...value) || altValue && p(...altValue))) {
            return index ? idx : true;
        }
        if (adone.is.regexp(p) && (p.test(string) || (altString && p.test(altString)))) {
            return index ? idx : true;
        }
        if (adone.is.string(p)) {
            if (p === string || (altString && p === altString)) {
                return index ? idx : true;
            }
            if (adone.util.GlobExp.test(string, p, { dot })) {
                return index ? idx : true;
            }
            if (altString && adone.util.GlobExp.test(altString, p, { dot })) {
                return index ? idx : true;
            }
        }
    }
    // there is no match
    return index ? -1 : false;
}
