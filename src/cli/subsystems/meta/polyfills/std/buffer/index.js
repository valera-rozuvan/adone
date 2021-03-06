; (function () {
    const lookup = [];
    const revLookup = [];

    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
    }

    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;

    const placeHoldersCount = (b64) => {
        const len = b64.length;
        if (len % 4 > 0) {
            throw new Error("Invalid string. Length must be a multiple of 4");
        }

        // the number of equal signs (place holders)
        // if there are two placeholders, than the two characters before it
        // represent one byte
        // if there is only one, then the three characters before it represent 2 bytes
        // this is just a cheap hack to not do indexOf twice
        return b64[len - 2] === "=" ? 2 : b64[len - 1] === "=" ? 1 : 0;
    };

    const encodeChunk = (uint8, start, end) => {
        let tmp;
        const output = [];
        for (let i = start; i < end; i += 3) {
            tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
            output.push(lookup[tmp >> 18 & 0x3F] + lookup[tmp >> 12 & 0x3F] + lookup[tmp >> 6 & 0x3F] + lookup[tmp & 0x3F]);
        }
        return output.join("");
    };
    const base64 = {
        byteLength: (b64) => {
            // base64 is 4/3 + up to two characters of the original data
            return b64.length * 3 / 4 - placeHoldersCount(b64);
        },
        toByteArray: (b64) => {
            let i;
            let j;
            let tmp;
            const len = b64.length;
            const placeHolders = placeHoldersCount(b64);

            const arr = new Uint8Array(len * 3 / 4 - placeHolders);

            // if there are placeholders, only get up to the last complete 4 chars
            const l = placeHolders > 0 ? len - 4 : len;

            let L = 0;

            for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
                arr[L++] = (tmp >> 16) & 0xFF;
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
            }

            if (placeHolders === 2) {
                tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
                arr[L++] = tmp & 0xFF;
            } else if (placeHolders === 1) {
                tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
            }

            return arr;
        },
        fromByteArray: (uint8) => {
            let tmp;
            const len = uint8.length;
            const extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
            let output = "";
            const parts = [];
            const maxChunkLength = 16383; // must be multiple of 3

            // go through the array every three bytes, we'll deal with trailing stuff later
            for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
            }

            // pad the end with zeros, but make sure to not forget the extra bytes
            if (extraBytes === 1) {
                tmp = uint8[len - 1];
                output += lookup[tmp >> 2];
                output += lookup[(tmp << 4) & 0x3F];
                output += "==";
            } else if (extraBytes === 2) {
                tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
                output += lookup[tmp >> 10];
                output += lookup[(tmp >> 4) & 0x3F];
                output += lookup[(tmp << 2) & 0x3F];
                output += "=";
            }

            parts.push(output);

            return parts.join("");
        }
    };

    const ieee754 = {
        read: (buffer, offset, isLE, mLen, nBytes) => {
            let e;
            let m;
            const eLen = nBytes * 8 - mLen - 1;
            const eMax = (1 << eLen) - 1;
            const eBias = eMax >> 1;
            let nBits = -7;
            let i = isLE ? (nBytes - 1) : 0;
            const d = isLE ? -1 : 1;
            let s = buffer[offset + i];

            i += d;

            e = s & ((1 << (-nBits)) - 1);
            s >>= (-nBits);
            nBits += eLen;
            for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) { }

            m = e & ((1 << (-nBits)) - 1);
            e >>= (-nBits);
            nBits += mLen;
            for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) { }

            if (e === 0) {
                e = 1 - eBias;
            } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity);
            } else {
                m = m + Math.pow(2, mLen);
                e = e - eBias;
            }
            return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
        },
        write: (buffer, value, offset, isLE, mLen, nBytes) => {
            let e;
            let m;
            let c;
            let eLen = nBytes * 8 - mLen - 1;
            const eMax = (1 << eLen) - 1;
            const eBias = eMax >> 1;
            const rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
            let i = isLE ? 0 : (nBytes - 1);
            const d = isLE ? 1 : -1;
            const s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

            value = Math.abs(value);

            if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0;
                e = eMax;
            } else {
                e = Math.floor(Math.log(value) / Math.LN2);
                if (value * (c = Math.pow(2, -e)) < 1) {
                    e--;
                    c *= 2;
                }
                if (e + eBias >= 1) {
                    value += rt / c;
                } else {
                    value += rt * Math.pow(2, 1 - eBias);
                }
                if (value * c >= 2) {
                    e++;
                    c /= 2;
                }

                if (e + eBias >= eMax) {
                    m = 0;
                    e = eMax;
                } else if (e + eBias >= 1) {
                    m = (value * c - 1) * Math.pow(2, mLen);
                    e = e + eBias;
                } else {
                    m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                    e = 0;
                }
            }

            for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) { }

            e = (e << mLen) | m;
            eLen += mLen;
            for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) { }

            buffer[offset + i - d] |= s * 128;
        }
    };

    const INSPECT_MAX_BYTES = 50;

    const K_MAX_LENGTH = 0x7fffffff;
    const kMaxLength = K_MAX_LENGTH;

    const assertSize = (size) => {
        if (typeof size !== "number") {
            throw new TypeError('"size" argument must be a number');
        } else if (size < 0) {
            throw new RangeError('"size" argument must not be negative');
        }
    };

    const createBuffer = (length) => {
        if (length > K_MAX_LENGTH) {
            throw new RangeError("Invalid typed array length");
        }
        // Return an augmented `Uint8Array` instance
        const buf = new Uint8Array(length);
        buf.__proto__ = Buffer.prototype;
        return buf;
    };

    const checked = (length) => {
        // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
        // length is NaN (which is otherwise coerced to zero.)
        if (length >= K_MAX_LENGTH) {
            throw new RangeError(`${"Attempt to allocate Buffer larger than maximum size: 0x"}${K_MAX_LENGTH.toString(16)} bytes`);
        }
        return length | 0;
    };

    const allocUnsafe = (size) => {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
    };

    const fromArrayLike = (array) => {
        const length = array.length < 0 ? 0 : checked(array.length) | 0;
        const buf = createBuffer(length);
        for (let i = 0; i < length; i += 1) {
            buf[i] = array[i] & 255;
        }
        return buf;
    };

    const swap = (b, n, m) => {
        const i = b[n];
        b[n] = b[m];
        b[m] = i;
    };

    const arrayIndexOf = (arr, val, byteOffset, encoding, dir) => {
        let indexSize = 1;
        let arrLength = arr.length;
        let valLength = val.length;

        if (encoding !== undefined) {
            encoding = String(encoding).toLowerCase();
            if (encoding === "ucs2" || encoding === "ucs-2" ||
                encoding === "utf16le" || encoding === "utf-16le") {
                if (arr.length < 2 || val.length < 2) {
                    return -1;
                }
                indexSize = 2;
                arrLength /= 2;
                valLength /= 2;
                byteOffset /= 2;
            }
        }

        const read = (buf, i) => {
            if (indexSize === 1) {
                return buf[i];
            }
            return buf.readUInt16BE(i * indexSize);
        };

        let i;
        if (dir) {
            let foundIndex = -1;
            for (i = byteOffset; i < arrLength; i++) {
                if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                    if (foundIndex === -1) {
                        foundIndex = i;
                    }
                    if (i - foundIndex + 1 === valLength) {
                        return foundIndex * indexSize;
                    }
                } else {
                    if (foundIndex !== -1) {
                        i -= i - foundIndex;
                    }
                    foundIndex = -1;
                }
            }
        } else {
            if (byteOffset + valLength > arrLength) {
                byteOffset = arrLength - valLength;
            }
            for (i = byteOffset; i >= 0; i--) {
                let found = true;
                for (let j = 0; j < valLength; j++) {
                    if (read(arr, i + j) !== read(val, j)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return i;
                }
            }
        }

        return -1;
    };

    // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
    // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
    //
    // Arguments:
    // - buffer - a Buffer to search
    // - val - a string, Buffer, or number
    // - byteOffset - an index into `buffer`; will be clamped to an int32
    // - encoding - an optional encoding, relevant is val is a string
    // - dir - true for indexOf, false for lastIndexOf
    const bidirectionalIndexOf = (buffer, val, byteOffset, encoding, dir) => {
        // Empty buffer means no match
        if (buffer.length === 0) {
            return -1;
        }

        // Normalize byteOffset
        if (typeof byteOffset === "string") {
            encoding = byteOffset;
            byteOffset = 0;
        } else if (byteOffset > 0x7fffffff) {
            byteOffset = 0x7fffffff;
        } else if (byteOffset < -0x80000000) {
            byteOffset = -0x80000000;
        }
        byteOffset = Number(byteOffset);  // Coerce to Number.
        if (numberIsNaN(byteOffset)) {
            // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
            byteOffset = dir ? 0 : (buffer.length - 1);
        }

        // Normalize byteOffset: negative offsets start from the end of the buffer
        if (byteOffset < 0) {
            byteOffset = buffer.length + byteOffset;
        }
        if (byteOffset >= buffer.length) {
            if (dir) {
                return -1;
            }
            byteOffset = buffer.length - 1;

        } else if (byteOffset < 0) {
            if (dir) {
                byteOffset = 0;
            } else {
                return -1;
            }
        }

        // Normalize val
        if (typeof val === "string") {
            val = Buffer.from(val, encoding);
        }

        // Finally, search either indexOf (if dir is true) or lastIndexOf
        if (Buffer.isBuffer(val)) {
            // Special case: looking for empty string/buffer always fails
            if (val.length === 0) {
                return -1;
            }
            return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
            val = val & 0xFF; // Search for a byte value [0-255]
            if (typeof Uint8Array.prototype.indexOf === "function") {
                if (dir) {
                    return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
                }
                return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);

            }
            return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }

        throw new TypeError("val must be string, number or Buffer");
    };

    const asciiWrite = (buf, string, offset, length) => blitBuffer(asciiToBytes(string), buf, offset, length);
    const latin1Write = (buf, string, offset, length) => asciiWrite(buf, string, offset, length);
    const base64Write = (buf, string, offset, length) => blitBuffer(base64ToBytes(string), buf, offset, length);
    const ucs2Write = (buf, string, offset, length) => blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);

    const base64Slice = (buf, start, end) => {
        if (start === 0 && end === buf.length) {
            return base64.fromByteArray(buf);
        }
        return base64.fromByteArray(buf.slice(start, end));
    };

    // Based on http://stackoverflow.com/a/22747272/680742, the browser with
    // the lowest limit is Chrome, with 0x10000 args.
    // We go 1 magnitude less, for safety
    const MAX_ARGUMENTS_LENGTH = 0x1000;

    const utf8Slice = (buf, start, end) => {
        end = Math.min(buf.length, end);
        const codePoints = [];

        let i = start;
        while (i < end) {
            const firstByte = buf[i];
            let codePoint = null;
            let bytesPerSequence = (firstByte > 0xEF) ? 4
                : (firstByte > 0xDF) ? 3
                    : (firstByte > 0xBF) ? 2
                        : 1;

            if (i + bytesPerSequence <= end) {
                let secondByte;
                let thirdByte;
                let fourthByte;
                let tempCodePoint;

                switch (bytesPerSequence) {
                    case 1:
                        if (firstByte < 0x80) {
                            codePoint = firstByte;
                        }
                        break;
                    case 2:
                        secondByte = buf[i + 1];
                        if ((secondByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
                            if (tempCodePoint > 0x7F) {
                                codePoint = tempCodePoint;
                            }
                        }
                        break;
                    case 3:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
                            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                codePoint = tempCodePoint;
                            }
                        }
                        break;
                    case 4:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        fourthByte = buf[i + 3];
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
                            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                codePoint = tempCodePoint;
                            }
                        }
                }
            }

            if (codePoint === null) {
                // we did not generate a valid codePoint so insert a
                // replacement char (U+FFFD) and advance only 1 byte
                codePoint = 0xFFFD;
                bytesPerSequence = 1;
            } else if (codePoint > 0xFFFF) {
                // encode to utf16 (surrogate pair dance)
                codePoint -= 0x10000;
                codePoints.push(codePoint >>> 10 & 0x3FF | 0xD800);
                codePoint = 0xDC00 | codePoint & 0x3FF;
            }

            codePoints.push(codePoint);
            i += bytesPerSequence;
        }

        const len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
            return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
        }

        // Decode in chunks to avoid "call stack size exceeded".
        let res = "";
        i = 0;
        while (i < len) {
            res += String.fromCharCode.apply(
                String,
                codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
            );
        }
        return res;
    };

    /*
     * Need to make sure that buffer isn't trying to write out of bounds.
     */
    const checkOffset = (offset, ext, length) => {
        if ((offset % 1) !== 0 || offset < 0) {
            throw new RangeError("offset is not uint");
        }
        if (offset + ext > length) {
            throw new RangeError("Trying to access beyond buffer length");
        }
    };

    const checkInt = (buf, value, offset, ext, max, min) => {
        if (!Buffer.isBuffer(buf)) {
            throw new TypeError('"buffer" argument must be a Buffer instance');
        }
        if (value > max || value < min) {
            throw new RangeError('"value" argument is out of bounds');
        }
        if (offset + ext > buf.length) {
            throw new RangeError("Index out of range");
        }
    };

    const checkIEEE754 = (buf, value, offset, ext, max, min) => {
        if (offset + ext > buf.length) {
            throw new RangeError("Index out of range");
        }
        if (offset < 0) {
            throw new RangeError("Index out of range");
        }
    };

    const writeFloat = (buf, value, offset, littleEndian, noAssert) => {
        value = Number(value);
        offset = offset >>> 0;
        if (!noAssert) {
            checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
    };

    const writeDouble = (buf, value, offset, littleEndian, noAssert) => {
        value = Number(value);
        offset = offset >>> 0;
        if (!noAssert) {
            checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
    };

    // HELPER FUNCTIONS
    // ================

    const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

    const base64clean = (str) => {
        // Node strips out invalid characters like \n and \t from the string, base64-js does not
        str = str.trim().replace(INVALID_BASE64_RE, "");
        // Node converts strings with length < 2 to ''
        if (str.length < 2) {
            return "";
        }
        // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
        while (str.length % 4 !== 0) {
            str = `${str}=`;
        }
        return str;
    };

    const toHex = (n) => {
        if (n < 16) {
            return `0${n.toString(16)}`;
        }
        return n.toString(16);
    };

    const utf8ToBytes = (string, units) => {
        units = units || Infinity;
        let codePoint;
        const length = string.length;
        let leadSurrogate = null;
        const bytes = [];

        for (let i = 0; i < length; ++i) {
            codePoint = string.charCodeAt(i);

            // is surrogate component
            if (codePoint > 0xD7FF && codePoint < 0xE000) {
                // last char was a lead
                if (!leadSurrogate) {
                    // no lead yet
                    if (codePoint > 0xDBFF) {
                        // unexpected trail
                        if ((units -= 3) > -1) {
                            bytes.push(0xEF, 0xBF, 0xBD);
                        }
                        continue;
                    } else if (i + 1 === length) {
                        // unpaired lead
                        if ((units -= 3) > -1) {
                            bytes.push(0xEF, 0xBF, 0xBD);
                        }
                        continue;
                    }

                    // valid lead
                    leadSurrogate = codePoint;

                    continue;
                }

                // 2 leads in a row
                if (codePoint < 0xDC00) {
                    if ((units -= 3) > -1) {
                        bytes.push(0xEF, 0xBF, 0xBD);
                    }
                    leadSurrogate = codePoint;
                    continue;
                }

                // valid surrogate pair
                codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
            } else if (leadSurrogate) {
                // valid bmp char, but last char was a lead
                if ((units -= 3) > -1) {
                    bytes.push(0xEF, 0xBF, 0xBD);
                }
            }

            leadSurrogate = null;

            // encode utf8
            if (codePoint < 0x80) {
                if ((units -= 1) < 0) {
                    break;
                }
                bytes.push(codePoint);
            } else if (codePoint < 0x800) {
                if ((units -= 2) < 0) {
                    break;
                }
                bytes.push(
                    codePoint >> 0x6 | 0xC0,
                    codePoint & 0x3F | 0x80
                );
            } else if (codePoint < 0x10000) {
                if ((units -= 3) < 0) {
                    break;
                }
                bytes.push(
                    codePoint >> 0xC | 0xE0,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                );
            } else if (codePoint < 0x110000) {
                if ((units -= 4) < 0) {
                    break;
                }
                bytes.push(
                    codePoint >> 0x12 | 0xF0,
                    codePoint >> 0xC & 0x3F | 0x80,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                );
            } else {
                throw new Error("Invalid code point");
            }
        }

        return bytes;
    };

    const asciiToBytes = (str) => {
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
            // Node's code seems to be doing this and not & 0x7F..
            byteArray.push(str.charCodeAt(i) & 0xFF);
        }
        return byteArray;
    };

    const utf16leToBytes = (str, units) => {
        let c, hi, lo;
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
            if ((units -= 2) < 0) {
                break;
            }

            c = str.charCodeAt(i);
            hi = c >> 8;
            lo = c % 256;
            byteArray.push(lo);
            byteArray.push(hi);
        }

        return byteArray;
    };

    const base64ToBytes = (str) => base64.toByteArray(base64clean(str));

    const blitBuffer = (src, dst, offset, length) => {
        let i;
        for (i = 0; i < length; ++i) {
            if ((i + offset >= dst.length) || (i >= src.length)) {
                break;
            }
            dst[i + offset] = src[i];
        }
        return i;
    };

    // Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
    const isArrayBufferView = (obj) => (typeof ArrayBuffer.isView === "function") && ArrayBuffer.isView(obj);
    const numberIsNaN = (obj) => obj !== obj; // eslint-disable-line no-self-compare

    class Buffer extends Uint8Array {
        constructor(arg, encodingOrOffset, length) {
            super();

            // Common case.
            if (typeof arg === "number") {
                if (typeof encodingOrOffset === "string") {
                    throw new Error(
                        "If encoding is specified then the first argument must be a string"
                    );
                }
                return allocUnsafe(arg);
            }
            return Buffer.from(arg, encodingOrOffset, length);
        }

        swap16() {
            const len = this.length;
            if (len % 2 !== 0) {
                throw new RangeError("Buffer size must be a multiple of 16-bits");
            }
            for (let i = 0; i < len; i += 2) {
                swap(this, i, i + 1);
            }
            return this;
        }

        swap32() {
            const len = this.length;
            if (len % 4 !== 0) {
                throw new RangeError("Buffer size must be a multiple of 32-bits");
            }
            for (let i = 0; i < len; i += 4) {
                swap(this, i, i + 3);
                swap(this, i + 1, i + 2);
            }
            return this;
        }

        swap64() {
            const len = this.length;
            if (len % 8 !== 0) {
                throw new RangeError("Buffer size must be a multiple of 64-bits");
            }
            for (let i = 0; i < len; i += 8) {
                swap(this, i, i + 7);
                swap(this, i + 1, i + 6);
                swap(this, i + 2, i + 5);
                swap(this, i + 3, i + 4);
            }
            return this;
        }

        toString(encoding, start, end) {
            const length = this.length;
            if (length === 0) {
                return "";
            }
            if (arguments.length === 0) {
                return utf8Slice(this, 0, length);
            }

            let loweredCase = false;

            // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
            // property of a typed array.

            // This behaves neither like String nor Uint8Array in that we set start/end
            // to their upper/lower bounds if the value passed is out of range.
            // undefined is handled specially as per ECMA-262 6th Edition,
            // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
            if (start === undefined || start < 0) {
                start = 0;
            }
            // Return early if start > this.length. Done here to prevent potential uint32
            // coercion fail below.
            if (start > this.length) {
                return "";
            }

            if (end === undefined || end > this.length) {
                end = this.length;
            }

            if (end <= 0) {
                return "";
            }

            // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
            end >>>= 0;
            start >>>= 0;

            if (end <= start) {
                return "";
            }

            if (!encoding) {
                encoding = "utf8";
            }

            while (true) {
                switch (encoding) {
                    case "hex": {
                        const len = this.length;

                        if (!start || start < 0) {
                            start = 0;
                        }
                        if (!end || end < 0 || end > len) {
                            end = len;
                        }

                        let out = "";
                        for (let i = start; i < end; ++i) {
                            out += toHex(this[i]);
                        }
                        return out;
                    }
                    case "utf8":
                    case "utf-8":
                        return utf8Slice(this, start, end);

                    case "ascii": {
                        let ret = "";
                        end = Math.min(this.length, end);

                        for (let i = start; i < end; ++i) {
                            ret += String.fromCharCode(this[i] & 0x7F);
                        }
                        return ret;
                    }

                    case "latin1":
                    case "binary": {
                        let ret = "";
                        end = Math.min(this.length, end);

                        for (let i = start; i < end; ++i) {
                            ret += String.fromCharCode(this[i]);
                        }
                        return ret;
                    }
                    case "base64":
                        return base64Slice(this, start, end);

                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le": {
                        const bytes = this.slice(start, end);
                        let res = "";
                        for (let i = 0; i < bytes.length; i += 2) {
                            res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
                        }
                        return res;
                    }
                    default:
                        if (loweredCase) {
                            throw new TypeError(`Unknown encoding: ${encoding}`);
                        }
                        encoding = (`${encoding}`).toLowerCase();
                        loweredCase = true;
                }
            }

        }

        equals(b) {
            if (!Buffer.isBuffer(b)) {
                throw new TypeError("Argument must be a Buffer");
            }
            if (this === b) {
                return true;
            }
            return Buffer.compare(this, b) === 0;
        }

        inspect() {
            let str = "";
            const max = INSPECT_MAX_BYTES;
            if (this.length > 0) {
                str = this.toString("hex", 0, max).match(/.{2}/g).join(" ");
                if (this.length > max) {
                    str += " ... ";
                }
            }
            return `<Buffer ${str}>`;
        }

        compare(target, start, end, thisStart, thisEnd) {
            if (!Buffer.isBuffer(target)) {
                throw new TypeError("Argument must be a Buffer");
            }

            if (start === undefined) {
                start = 0;
            }
            if (end === undefined) {
                end = target ? target.length : 0;
            }
            if (thisStart === undefined) {
                thisStart = 0;
            }
            if (thisEnd === undefined) {
                thisEnd = this.length;
            }

            if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                throw new RangeError("out of range index");
            }

            if (thisStart >= thisEnd && start >= end) {
                return 0;
            }
            if (thisStart >= thisEnd) {
                return -1;
            }
            if (start >= end) {
                return 1;
            }

            start >>>= 0;
            end >>>= 0;
            thisStart >>>= 0;
            thisEnd >>>= 0;

            if (this === target) {
                return 0;
            }

            let x = thisEnd - thisStart;
            let y = end - start;
            const len = Math.min(x, y);

            const thisCopy = this.slice(thisStart, thisEnd);
            const targetCopy = target.slice(start, end);

            for (let i = 0; i < len; ++i) {
                if (thisCopy[i] !== targetCopy[i]) {
                    x = thisCopy[i];
                    y = targetCopy[i];
                    break;
                }
            }

            if (x < y) {
                return -1;
            }
            if (y < x) {
                return 1;
            }
            return 0;
        }

        includes(val, byteOffset, encoding) {
            return this.indexOf(val, byteOffset, encoding) !== -1;
        }

        indexOf(val, byteOffset, encoding) {
            return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
        }

        lastIndexOf(val, byteOffset, encoding) {
            return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
        }

        write(string, offset, length, encoding) {
            // Buffer#write(string)
            if (offset === undefined) {
                encoding = "utf8";
                length = this.length;
                offset = 0;
                // Buffer#write(string, encoding)
            } else if (length === undefined && typeof offset === "string") {
                encoding = offset;
                length = this.length;
                offset = 0;
                // Buffer#write(string, offset[, length][, encoding])
            } else if (isFinite(offset)) {
                offset = offset >>> 0;
                if (isFinite(length)) {
                    length = length >>> 0;
                    if (encoding === undefined) {
                        encoding = "utf8";
                    }
                } else {
                    encoding = length;
                    length = undefined;
                }
            } else {
                throw new Error(
                    "Buffer.write(string, encoding, offset[, length]) is no longer supported"
                );
            }

            const remaining = this.length - offset;
            if (length === undefined || length > remaining) {
                length = remaining;
            }

            if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                throw new RangeError("Attempt to write outside buffer bounds");
            }

            if (!encoding) {
                encoding = "utf8";
            }

            let loweredCase = false;
            for (; ;) {
                switch (encoding) {
                    case "hex": {
                        offset = Number(offset) || 0;
                        const remaining = this.length - offset;
                        if (!length) {
                            length = remaining;
                        } else {
                            length = Number(length);
                            if (length > remaining) {
                                length = remaining;
                            }
                        }

                        // must be an even number of digits
                        const strLen = string.length;
                        if (strLen % 2 !== 0) {
                            throw new TypeError("Invalid hex string");
                        }

                        if (length > strLen / 2) {
                            length = strLen / 2;
                        }
                        let i;
                        for (i = 0; i < length; ++i) {
                            const parsed = parseInt(string.substr(i * 2, 2), 16);
                            if (numberIsNaN(parsed)) {
                                return i;
                            }
                            this[offset + i] = parsed;
                        }
                        return i;
                    }

                    case "utf8":
                    case "utf-8":
                        return blitBuffer(utf8ToBytes(string, this.length - offset), this, offset, length);

                    case "ascii":
                        return asciiWrite(this, string, offset, length);

                    case "latin1":
                    case "binary":
                        return latin1Write(this, string, offset, length);

                    case "base64":
                        // Warning: maxLength not taken into account in base64Write
                        return base64Write(this, string, offset, length);

                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        return ucs2Write(this, string, offset, length);

                    default:
                        if (loweredCase) {
                            throw new TypeError(`Unknown encoding: ${encoding}`);
                        }
                        encoding = (`${encoding}`).toLowerCase();
                        loweredCase = true;
                }
            }
        }

        toJSON() {
            return {
                type: "Buffer",
                data: Array.prototype.slice.call(this._arr || this, 0)
            };
        }

        slice(start, end) {
            const len = this.length;
            start = ~~start;
            end = end === undefined ? len : ~~end;

            if (start < 0) {
                start += len;
                if (start < 0) {
                    start = 0;
                }
            } else if (start > len) {
                start = len;
            }

            if (end < 0) {
                end += len;
                if (end < 0) {
                    end = 0;
                }
            } else if (end > len) {
                end = len;
            }

            if (end < start) {
                end = start;
            }

            const newBuf = this.subarray(start, end);
            // Return an augmented `Uint8Array` instance
            newBuf.__proto__ = Buffer.prototype;
            return newBuf;
        }

        readUIntLE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
            }

            let val = this[offset];
            let mul = 1;
            let i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
            }

            return val;
        }

        readUIntBE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
            }

            let val = this[offset + --byteLength];
            let mul = 1;
            while (byteLength > 0 && (mul *= 0x100)) {
                val += this[offset + --byteLength] * mul;
            }

            return val;
        }

        readUInt8(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 1, this.length);
            }
            return this[offset];
        }

        readUInt16LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 2, this.length);
            }
            return this[offset] | (this[offset + 1] << 8);
        }

        readUInt16BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 2, this.length);
            }
            return (this[offset] << 8) | this[offset + 1];
        }

        readUInt32LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }

            return ((this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16)) +
                (this[offset + 3] * 0x1000000);
        }

        readUInt32BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }

            return (this[offset] * 0x1000000) +
                ((this[offset + 1] << 16) |
                    (this[offset + 2] << 8) |
                    this[offset + 3]);
        }

        readIntLE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
            }

            let val = this[offset];
            let mul = 1;
            let i = 0;
            while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) {
                val -= Math.pow(2, 8 * byteLength);
            }

            return val;
        }

        readIntBE(offset, byteLength, noAssert) {
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
            }

            let i = byteLength;
            let mul = 1;
            let val = this[offset + --i];
            while (i > 0 && (mul *= 0x100)) {
                val += this[offset + --i] * mul;
            }
            mul *= 0x80;

            if (val >= mul) {
                val -= Math.pow(2, 8 * byteLength);
            }

            return val;
        }

        readInt8(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 1, this.length);
            }
            if (!(this[offset] & 0x80)) {
                return (this[offset]);
            }
            return ((0xff - this[offset] + 1) * -1);
        }

        readInt16LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 2, this.length);
            }
            const val = this[offset] | (this[offset + 1] << 8);
            return (val & 0x8000) ? val | 0xFFFF0000 : val;
        }

        readInt16BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 2, this.length);
            }
            const val = this[offset + 1] | (this[offset] << 8);
            return (val & 0x8000) ? val | 0xFFFF0000 : val;
        }

        readInt32LE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }

            return (this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16) |
                (this[offset + 3] << 24);
        }

        readInt32BE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }

            return (this[offset] << 24) |
                (this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                (this[offset + 3]);
        }

        readFloatLE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }
            return ieee754.read(this, offset, true, 23, 4);
        }

        readFloatBE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 4, this.length);
            }
            return ieee754.read(this, offset, false, 23, 4);
        }

        readDoubleLE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 8, this.length);
            }
            return ieee754.read(this, offset, true, 52, 8);
        }

        readDoubleBE(offset, noAssert) {
            offset = offset >>> 0;
            if (!noAssert) {
                checkOffset(offset, 8, this.length);
            }
            return ieee754.read(this, offset, false, 52, 8);
        }

        writeUIntLE(value, offset, byteLength, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                const maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
            }

            let mul = 1;
            let i = 0;
            this[offset] = value & 0xFF;
            while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
            }

            return offset + byteLength;
        }

        writeUIntBE(value, offset, byteLength, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            byteLength = byteLength >>> 0;
            if (!noAssert) {
                const maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
            }

            let i = byteLength - 1;
            let mul = 1;
            this[offset + i] = value & 0xFF;
            while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
            }

            return offset + byteLength;
        }

        writeUInt8(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 1, 0xff, 0);
            }
            this[offset] = (value & 0xff);
            return offset + 1;
        }

        writeUInt16LE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 2, 0xffff, 0);
            }
            this[offset] = (value & 0xff);
            this[offset + 1] = (value >>> 8);
            return offset + 2;
        }

        writeUInt16BE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 2, 0xffff, 0);
            }
            this[offset] = (value >>> 8);
            this[offset + 1] = (value & 0xff);
            return offset + 2;
        }

        writeUInt32LE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 4, 0xffffffff, 0);
            }
            this[offset + 3] = (value >>> 24);
            this[offset + 2] = (value >>> 16);
            this[offset + 1] = (value >>> 8);
            this[offset] = (value & 0xff);
            return offset + 4;
        }

        writeUInt32BE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 4, 0xffffffff, 0);
            }
            this[offset] = (value >>> 24);
            this[offset + 1] = (value >>> 16);
            this[offset + 2] = (value >>> 8);
            this[offset + 3] = (value & 0xff);
            return offset + 4;
        }

        writeIntLE(value, offset, byteLength, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                const limit = Math.pow(2, (8 * byteLength) - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            let i = 0;
            let mul = 1;
            let sub = 0;
            this[offset] = value & 0xFF;
            while (++i < byteLength && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                    sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
            }

            return offset + byteLength;
        }

        writeIntBE(value, offset, byteLength, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                const limit = Math.pow(2, (8 * byteLength) - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
            }

            let i = byteLength - 1;
            let mul = 1;
            let sub = 0;
            this[offset + i] = value & 0xFF;
            while (--i >= 0 && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                    sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
            }

            return offset + byteLength;
        }

        writeInt8(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 1, 0x7f, -0x80);
            }
            if (value < 0) {
                value = 0xff + value + 1;
            }
            this[offset] = (value & 0xff);
            return offset + 1;
        }

        writeInt16LE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            }
            this[offset] = (value & 0xff);
            this[offset + 1] = (value >>> 8);
            return offset + 2;
        }

        writeInt16BE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 2, 0x7fff, -0x8000);
            }
            this[offset] = (value >>> 8);
            this[offset + 1] = (value & 0xff);
            return offset + 2;
        }

        writeInt32LE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            }
            this[offset] = (value & 0xff);
            this[offset + 1] = (value >>> 8);
            this[offset + 2] = (value >>> 16);
            this[offset + 3] = (value >>> 24);
            return offset + 4;
        }

        writeInt32BE(value, offset, noAssert) {
            value = Number(value);
            offset = offset >>> 0;
            if (!noAssert) {
                checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
            }
            if (value < 0) {
                value = 0xffffffff + value + 1;
            }
            this[offset] = (value >>> 24);
            this[offset + 1] = (value >>> 16);
            this[offset + 2] = (value >>> 8);
            this[offset + 3] = (value & 0xff);
            return offset + 4;
        }

        writeFloatLE(value, offset, noAssert) {
            return writeFloat(this, value, offset, true, noAssert);
        }

        writeFloatBE(value, offset, noAssert) {
            return writeFloat(this, value, offset, false, noAssert);
        }

        writeDoubleLE(value, offset, noAssert) {
            return writeDouble(this, value, offset, true, noAssert);
        }

        writeDoubleBE(value, offset, noAssert) {
            return writeDouble(this, value, offset, false, noAssert);
        }

        // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
        copy(target, targetStart, start, end) {
            if (!start) {
                start = 0;
            }
            if (!end && end !== 0) {
                end = this.length;
            }
            if (targetStart >= target.length) {
                targetStart = target.length;
            }
            if (!targetStart) {
                targetStart = 0;
            }
            if (end > 0 && end < start) {
                end = start;
            }

            // Copy 0 bytes; we're done
            if (end === start) {
                return 0;
            }
            if (target.length === 0 || this.length === 0) {
                return 0;
            }

            // Fatal error conditions
            if (targetStart < 0) {
                throw new RangeError("targetStart out of bounds");
            }
            if (start < 0 || start >= this.length) {
                throw new RangeError("sourceStart out of bounds");
            }
            if (end < 0) {
                throw new RangeError("sourceEnd out of bounds");
            }

            // Are we oob?
            if (end > this.length) {
                end = this.length;
            }
            if (target.length - targetStart < end - start) {
                end = target.length - targetStart + start;
            }

            const len = end - start;
            let i;

            if (this === target && start < targetStart && targetStart < end) {
                // descending copy from end
                for (i = len - 1; i >= 0; --i) {
                    target[i + targetStart] = this[i + start];
                }
            } else if (len < 1000) {
                // ascending copy from start
                for (i = 0; i < len; ++i) {
                    target[i + targetStart] = this[i + start];
                }
            } else {
                Uint8Array.prototype.set.call(
                    target,
                    this.subarray(start, start + len),
                    targetStart
                );
            }

            return len;
        }

        // Usage:
        //    buffer.fill(number[, offset[, end]])
        //    buffer.fill(buffer[, offset[, end]])
        //    buffer.fill(string[, offset[, end]][, encoding])
        fill(val, start, end, encoding) {
            // Handle string cases:
            if (typeof val === "string") {
                if (typeof start === "string") {
                    encoding = start;
                    start = 0;
                    end = this.length;
                } else if (typeof end === "string") {
                    encoding = end;
                    end = this.length;
                }
                if (val.length === 1) {
                    const code = val.charCodeAt(0);
                    if (code < 256) {
                        val = code;
                    }
                }
                if (encoding !== undefined && typeof encoding !== "string") {
                    throw new TypeError("encoding must be a string");
                }
                if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
                    throw new TypeError(`Unknown encoding: ${encoding}`);
                }
            } else if (typeof val === "number") {
                val = val & 255;
            }

            // Invalid ranges are not set to a default, so can range check early.
            if (start < 0 || this.length < start || this.length < end) {
                throw new RangeError("Out of range index");
            }

            if (end <= start) {
                return this;
            }

            start = start >>> 0;
            end = end === undefined ? this.length : end >>> 0;

            if (!val) {
                val = 0;
            }

            let i;
            if (typeof val === "number") {
                for (i = start; i < end; ++i) {
                    this[i] = val;
                }
            } else {
                const bytes = Buffer.isBuffer(val)
                    ? val
                    : new Buffer(val, encoding);
                const len = bytes.length;
                for (i = 0; i < end - start; ++i) {
                    this[i + start] = bytes[i % len];
                }
            }

            return this;
        }

        /**
         * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
         * if value is a number.
         * Buffer.from(str[, encoding])
         * Buffer.from(array)
         * Buffer.from(buffer)
         * Buffer.from(arrayBuffer[, byteOffset[, length]])
         **/
        static from(value, encodingOrOffset, length) {
            if (typeof value === "number") {
                throw new TypeError('"value" argument must not be a number');
            }

            if (value instanceof ArrayBuffer) {
                if (encodingOrOffset < 0 || value.byteLength < encodingOrOffset) {
                    throw new RangeError("'offset' is out of bounds");
                }

                if (value.byteLength < encodingOrOffset + (length || 0)) {
                    throw new RangeError("'length' is out of bounds");
                }

                let buf;
                if (encodingOrOffset === undefined && length === undefined) {
                    buf = new Uint8Array(value);
                } else if (length === undefined) {
                    buf = new Uint8Array(value, encodingOrOffset);
                } else {
                    buf = new Uint8Array(value, encodingOrOffset, length);
                }

                // Return an augmented `Uint8Array` instance
                buf.__proto__ = Buffer.prototype;
                return buf;
            }

            if (typeof value === "string") {
                if (typeof encodingOrOffset !== "string" || encodingOrOffset === "") {
                    encodingOrOffset = "utf8";
                }

                if (!Buffer.isEncoding(encodingOrOffset)) {
                    throw new TypeError('"encoding" must be a valid string encoding');
                }

                const length = Buffer.byteLength(value, encodingOrOffset) | 0;
                let buf = createBuffer(length);

                const actual = buf.write(value, encodingOrOffset);

                if (actual !== length) {
                    // Writing a hex string, for example, that contains invalid characters will
                    // cause everything after the first invalid character to be ignored. (e.g.
                    // 'abxxcd' will be treated as 'ab')
                    buf = buf.slice(0, actual);
                }

                return buf;
            }

            if (Buffer.isBuffer(value)) {
                const len = checked(value.length) | 0;
                const buf = createBuffer(len);

                if (buf.length === 0) {
                    return buf;
                }

                value.copy(buf, 0, 0, len);
                return buf;
            }

            if (value) {
                if (isArrayBufferView(value) || "length" in value) {
                    if (typeof value.length !== "number" || numberIsNaN(value.length)) {
                        return createBuffer(0);
                    }
                    return fromArrayLike(value);
                }

                if (value.type === "Buffer" && Array.isArray(value.data)) {
                    return fromArrayLike(value.data);
                }
            }

            throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
        }

        /**
         * Creates a new filled Buffer instance.
         * alloc(size[, fill[, encoding]])
         **/
        static alloc(size, fill, encoding) {
            assertSize(size);
            if (size <= 0) {
                return createBuffer(size);
            }
            if (fill !== undefined) {
                // Only pay attention to encoding if it's a string. This
                // prevents accidentally sending in a number that would
                // be interpretted as a start offset.
                return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
            }
            return createBuffer(size);
        }

        /**
         * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
         * */
        static allocUnsafe(size) {
            return allocUnsafe(size);
        }

        /**
         * By default creates a non-zero-filled Buffer instance.
         */
        static allocUnsafeSlow(size) {
            return allocUnsafe(size);
        }

        static isBuffer(b) {
            return b != null && b._isBuffer === true;
        }

        static compare(a, b) {
            if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                throw new TypeError("Arguments must be Buffers");
            }

            if (a === b) {
                return 0;
            }

            let x = a.length;
            let y = b.length;

            for (let i = 0, len = Math.min(x, y); i < len; ++i) {
                if (a[i] !== b[i]) {
                    x = a[i];
                    y = b[i];
                    break;
                }
            }

            if (x < y) {
                return -1;
            }
            if (y < x) {
                return 1;
            }
            return 0;
        }

        static isEncoding(encoding) {
            switch (String(encoding).toLowerCase()) {
                case "hex":
                case "utf8":
                case "utf-8":
                case "ascii":
                case "latin1":
                case "binary":
                case "base64":
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                    return true;
                default:
                    return false;
            }
        }

        static concat(list, length) {
            if (!Array.isArray(list)) {
                throw new TypeError('"list" argument must be an Array of Buffers');
            }

            if (list.length === 0) {
                return Buffer.alloc(0);
            }

            let i;
            if (length === undefined) {
                length = 0;
                for (i = 0; i < list.length; ++i) {
                    length += list[i].length;
                }
            }

            const buffer = Buffer.allocUnsafe(length);
            let pos = 0;
            for (i = 0; i < list.length; ++i) {
                const buf = list[i];
                if (!Buffer.isBuffer(buf)) {
                    throw new TypeError('"list" argument must be an Array of Buffers');
                }
                buf.copy(buffer, pos);
                pos += buf.length;
            }
            return buffer;
        }

        static byteLength(string, encoding) {
            if (Buffer.isBuffer(string)) {
                return string.length;
            }
            if (isArrayBufferView(string) || string instanceof ArrayBuffer) {
                return string.byteLength;
            }
            if (typeof string !== "string") {
                string = `${string}`;
            }

            const len = string.length;
            if (len === 0) {
                return 0;
            }

            // Use a for loop to avoid recursion
            let loweredCase = false;
            for (; ;) {
                switch (encoding) {
                    case "ascii":
                    case "latin1":
                    case "binary":
                        return len;
                    case "utf8":
                    case "utf-8":
                    case undefined:
                        return utf8ToBytes(string).length;
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        return len * 2;
                    case "hex":
                        return len >>> 1;
                    case "base64":
                        return base64ToBytes(string).length;
                    default:
                        if (loweredCase) {
                            return utf8ToBytes(string).length;
                        } // assume utf8
                        encoding = (String(encoding)).toLowerCase();
                        loweredCase = true;
                }
            }
        }
    }

    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    if (Symbol.species && Buffer[Symbol.species] === Buffer) {
        Object.defineProperty(Buffer, Symbol.species, {
            value: null,
            configurable: true
        });
    }
    Buffer.poolSize = 8192; // not used by this implementation
    Buffer.prototype._isBuffer = true;

    if (typeof(window) !== "undefined") {
        window["Buffer"] = Buffer;
    } else {
        module.exports.Buffer = Buffer;
    }
})();
