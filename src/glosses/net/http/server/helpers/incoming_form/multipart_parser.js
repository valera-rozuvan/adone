
const { x } = adone;

let s = 0;
const S = {
    PARSER_UNINITIALIZED: s++,
    START: s++,
    START_BOUNDARY: s++,
    HEADER_FIELD_START: s++,
    HEADER_FIELD: s++,
    HEADER_VALUE_START: s++,
    HEADER_VALUE: s++,
    HEADER_VALUE_ALMOST_DONE: s++,
    HEADERS_ALMOST_DONE: s++,
    PART_DATA_START: s++,
    PART_DATA: s++,
    PART_END: s++,
    END: s++
};


let f = 1;
const F = {
    PART_BOUNDARY: f,
    LAST_BOUNDARY: f *= 2
};

const LF = 10;
const CR = 13;
const SPACE = 32;
const HYPHEN = 45;
const COLON = 58;
const A = 97;
const Z = 122;

const lower = (c) => c | 0x20;

export default class MultipartParser {
    constructor() {
        this.boundary = null;
        this.boundaryChars = null;
        this.lookbehind = null;
        this.state = S.PARSER_UNINITIALIZED;

        this.index = null;
        this.flags = 0;
    }

    static stateToString(stateNumber) {
        for (const state in S) {
            const number = S[state];
            if (number === stateNumber) {
                return state;
            }
        }
    }

    initWithBoundary(str) {
        this.boundary = Buffer.alloc(str.length + 4);
        this.boundary.write("\r\n--", 0);
        this.boundary.write(str, 4);
        this.lookbehind = Buffer.alloc(this.boundary.length + 8);
        this.state = S.START;

        this.boundaryChars = {};
        for (const c of this.boundary) {
            this.boundaryChars[c] = true;
        }
    }

    write(buffer) {
        const callback = (name, buffer, start, end) => {
            if (start !== undefined && start === end) {
                return;
            }

            const callbackSymbol = `on${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;
            if (callbackSymbol in this) {
                this[callbackSymbol](buffer, start, end);
            }
        };

        let i = 0;

        const dataCallback = (name, clear) => {
            const markSymbol = `${name}Mark`;
            if (!(markSymbol in this)) {
                return;
            }

            if (!clear) {
                callback(name, buffer, this[markSymbol], buffer.length);
                this[markSymbol] = 0;
            } else {
                callback(name, buffer, this[markSymbol], i);
                delete this[markSymbol];
            }
        };

        const mark = (name) => {
            this[`${name}Mark`] = i;
        };

        const clear = (name) => {
            delete this[`${name}Mark`];
        };

        const { lookbehind, boundary, boundaryChars } = this;
        const { length: bufferLength } = buffer;
        const { length: boundaryLength } = boundary;
        const boundaryEnd = boundaryLength - 1;
        let { index, state, flags } = this;

        for (i = 0; i < bufferLength; i++) {
            let c = buffer[i];
            switch (state) {
                case S.PARSER_UNINITIALIZED: {
                    return i;
                }
                case S.START: {
                    index = 0;
                    state = S.START_BOUNDARY;
                }
                // fallthrough
                case S.START_BOUNDARY: {
                    if (index === boundary.length - 2) {
                        if (c === HYPHEN) {
                            flags |= F.LAST_BOUNDARY;
                        } else if (c !== CR) {
                            return i;
                        }
                        index++;
                        break;
                    } else if (index - 1 === boundary.length - 2) {
                        if (flags & F.LAST_BOUNDARY && c === HYPHEN) {
                            callback("end");
                            state = S.END;
                            flags = 0;
                        } else if (!(flags & F.LAST_BOUNDARY) && c === LF) {
                            index = 0;
                            callback("partBegin");
                            state = S.HEADER_FIELD_START;
                        } else {
                            return i;
                        }
                        break;
                    }

                    if (c !== boundary[index + 2]) {
                        index = -2;
                    }
                    if (c === boundary[index + 2]) {
                        index++;
                    }
                    break;
                }
                case S.HEADER_FIELD_START: {
                    state = S.HEADER_FIELD;
                    mark("headerField");
                    index = 0;
                }
                // fallthrough
                case S.HEADER_FIELD: {
                    if (c === CR) {
                        clear("headerField");
                        state = S.HEADERS_ALMOST_DONE;
                        break;
                    }

                    index++;
                    if (c === HYPHEN) {
                        break;
                    }

                    if (c === COLON) {
                        if (index === 1) {
                            // empty header field
                            return i;
                        }
                        dataCallback("headerField", true);
                        state = S.HEADER_VALUE_START;
                        break;
                    }

                    const cl = lower(c);
                    if (cl < A || cl > Z) {
                        return i;
                    }
                    break;
                }
                case S.HEADER_VALUE_START: {
                    if (c === SPACE) {
                        break;
                    }

                    mark("headerValue");
                    state = S.HEADER_VALUE;
                }
                // fallthrough
                case S.HEADER_VALUE: {
                    if (c === CR) {
                        dataCallback("headerValue", true);
                        callback("headerEnd");
                        state = S.HEADER_VALUE_ALMOST_DONE;
                    }
                    break;
                }
                case S.HEADER_VALUE_ALMOST_DONE: {
                    if (c !== LF) {
                        return i;
                    }
                    state = S.HEADER_FIELD_START;
                    break;

                }
                case S.HEADERS_ALMOST_DONE: {
                    if (c !== LF) {
                        return i;
                    }

                    callback("headersEnd");
                    state = S.PART_DATA_START;
                    break;
                }
                case S.PART_DATA_START: {
                    state = S.PART_DATA;
                    mark("partData");
                }
                // fallthrough
                case S.PART_DATA: {
                    let prevIndex = index;

                    if (index === 0) {
                        // boyer-moore derrived algorithm to safely skip non-boundary data
                        i += boundaryEnd;
                        while (i < bufferLength && !(buffer[i] in boundaryChars)) {
                            i += boundaryLength;
                        }
                        i -= boundaryEnd;
                        c = buffer[i];
                    }

                    if (index < boundary.length) {
                        if (boundary[index] === c) {
                            if (index === 0) {
                                dataCallback("partData", true);
                            }
                            index++;
                        } else {
                            index = 0;
                        }
                    } else if (index === boundary.length) {
                        index++;
                        if (c === CR) {
                            // CR = part boundary
                            flags |= F.PART_BOUNDARY;
                        } else if (c === HYPHEN) {
                            // HYPHEN = end boundary
                            flags |= F.LAST_BOUNDARY;
                        } else {
                            index = 0;
                        }
                    } else if (index - 1 === boundary.length) {
                        if (flags & F.PART_BOUNDARY) {
                            index = 0;
                            if (c === LF) {
                                // unset the PART_BOUNDARY flag
                                flags &= ~F.PART_BOUNDARY;
                                callback("partEnd");
                                callback("partBegin");
                                state = S.HEADER_FIELD_START;
                                break;
                            }
                        } else if (flags & F.LAST_BOUNDARY) {
                            if (c === HYPHEN) {
                                callback("partEnd");
                                callback("end");
                                state = S.END;
                                flags = 0;
                            } else {
                                index = 0;
                            }
                        } else {
                            index = 0;
                        }
                    }

                    if (index > 0) {
                        // when matching a possible boundary, keep a lookbehind reference
                        // in case it turns out to be a false lead
                        lookbehind[index - 1] = c;
                    } else if (prevIndex > 0) {
                        // if our boundary turned out to be rubbish, the captured lookbehind
                        // belongs to partData
                        callback("partData", lookbehind, 0, prevIndex);
                        prevIndex = 0;
                        mark("partData");

                        // reconsider the current character even so it interrupted the sequence
                        // it could be the beginning of a new sequence
                        i--;
                    }

                    break;
                }
                case S.END: {
                    break;
                }
                default: {
                    return i;
                }
            }
        }

        dataCallback("headerField");
        dataCallback("headerValue");
        dataCallback("partData");

        this.index = index;
        this.state = state;
        this.flags = flags;

        return bufferLength;
    }

    end() {
        const callback = (self, name) => {
            const callbackSymbol = `on${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;
            if (callbackSymbol in self) {
                self[callbackSymbol]();
            }
        };
        if ((this.state === S.HEADER_FIELD_START && this.index === 0) || (this.state === S.PART_DATA && this.index === this.boundary.length)) {
            callback(this, "partEnd");
            callback(this, "end");
        } else if (this.state !== S.END) {
            return new x.IllegalState(`MultipartParser.end(): stream ended unexpectedly: ${this.explain()}`);
        }
    }
    explain() {
        return `state = ${MultipartParser.stateToString(this.state)}`;
    }
}
