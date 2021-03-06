const { is, math: { Long }, util: { memcpy: { utoa, atou } }, x } = adone;

const stringSource = (s) => {
    let i = 0;
    return () => i < s.length ? s.charCodeAt(i++) : null;
};

const stringDestination = () => {
    const cs = [];
    const ps = [];
    return (...args) => {
        if (args.length === 0) {
            return `${ps.join("")}${String.fromCharCode(...cs)}`;
        }
        if (cs.length + args.length > 1024) {
            ps.push(String.fromCharCode(...cs));
            cs.length = 0;
        }
        cs.push(...args);
    };
};


/**
 * utfx-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/utfx for details
 */

const utfx = {
    MAX_CODEPOINT: 0x10FFFF,
    encodeUTF8: (src, dst) => {
        let cp = null;
        if (is.number(src)) {
            cp = src,
                src = () => null;
        }
        while (cp !== null || (cp = src()) !== null) {
            if (cp < 0x80) {
                dst(cp & 0x7F);
            } else if (cp < 0x800) {
                dst(((cp >> 6) & 0x1F) | 0xC0);
                dst((cp & 0x3F) | 0x80);
            } else if (cp < 0x10000) {
                dst(((cp >> 12) & 0x0F) | 0xE0);
                dst(((cp >> 6) & 0x3F) | 0x80);
                dst((cp & 0x3F) | 0x80);
            } else {
                dst(((cp >> 18) & 0x07) | 0xF0);
                dst(((cp >> 12) & 0x3F) | 0x80);
                dst(((cp >> 6) & 0x3F) | 0x80);
                dst((cp & 0x3F) | 0x80);

            }
            cp = null;
        }
    },
    decodeUTF8: (src, dst) => {
        let a;
        let b;
        let c;
        let d;
        const fail = function (b) {
            b = b.slice(0, b.indexOf(null));
            const err = Error(b.toString());
            err.name = "TruncatedError";
            err.bytes = b;
            throw err;
        };
        while ((a = src()) !== null) {
            if ((a & 0x80) === 0) {
                dst(a);
            } else if ((a & 0xE0) === 0xC0) {
                b = src();
                if (b === null) {
                    fail([a, b]);
                }
                dst(((a & 0x1F) << 6) | (b & 0x3F));
            } else if ((a & 0xF0) === 0xE0) {
                b = src();
                if (b === null) {
                    fail([a, b]);
                }
                c = src();
                if (c === null) {
                    fail([a, b, c]);
                }
                dst(((a & 0x0F) << 12) | ((b & 0x3F) << 6) | (c & 0x3F));
            } else if ((a & 0xF8) === 0xF0) {
                b = src();
                if (b === null) {
                    fail([a, b]);
                }
                c = src();
                if (c === null) {
                    fail([a, b, c]);
                }
                d = src();
                if (d === null) {
                    fail([a, b, c, d]);
                }
                dst(((a & 0x07) << 18) | ((b & 0x3F) << 12) | ((c & 0x3F) << 6) | (d & 0x3F));
            } else {
                throw new RangeError(`Illegal starting byte: ${a}`);
            }
        }
    },
    UTF16toUTF8: (src, dst) => {
        let c1;
        let c2 = null;

        for (; ;) {
            c1 = c2 !== null ? c2 : src();
            if (c1 === null) {
                break;
            }
            if (c1 >= 0xD800 && c1 <= 0xDFFF) {
                c2 = src();
                if (c2 !== null && (c2 >= 0xDC00 && c2 <= 0xDFFF)) {
                    dst((c1 - 0xD800) * 0x400 + c2 - 0xDC00 + 0x10000);
                    c2 = null;
                    continue;
                }
            }
            dst(c1);
        }
        if (c2 !== null) {
            dst(c2);
        }
    },
    UTF8toUTF16: (src, dst) => {
        let cp = null;
        if (is.number(src)) {
            cp = src;
            src = () => null;
        }
        for (; ;) {
            if (cp === null) {
                cp = src();
                if (cp === null) {
                    break;
                }
            }
            if (cp <= 0xFFFF) {
                dst(cp);
            } else {
                cp -= 0x10000;
                dst((cp >> 10) + 0xD800);
                dst((cp % 0x400) + 0xDC00);
            }
            cp = null;
        }
    },
    encodeUTF16toUTF8: (src, dst) => utfx.UTF16toUTF8(src, (cp) => utfx.encodeUTF8(cp, dst)),
    decodeUTF8toUTF16: (src, dst) => utfx.decodeUTF8(src, (cp) => utfx.UTF8toUTF16(cp, dst)),
    calculateCodePoint: (cp) => {
        if (cp < 0x80) {
            return 1;
        }
        if (cp < 0x800) {
            return 2;
        }
        if (cp < 0x10000) {
            return 3;
        }
        return 4;
    },
    calculateUTF8: (src) => {
        let cp;
        let l = 0;
        for (; ;) {
            cp = src();
            if (cp === null) {
                break;
            }
            l += utfx.calculateCodePoint(cp);
        }
        return l;
    },
    calculateUTF16asUTF8: (src) => {
        let n = 0;
        let l = 0;
        utfx.UTF16toUTF8(src, (cp) => {
            ++n;
            l += utfx.calculateCodePoint(cp);
        });
        return [n, l];
    }
};

export default class ExBuffer {
    constructor(capacity = ExBuffer.DEFAULT_CAPACITY, noAssert = ExBuffer.DEFAULT_NOASSERT) {
        if (!noAssert) {
            capacity = capacity | 0;
            if (capacity < 0) {
                throw new RangeError("Illegal capacity");
            }
            noAssert = Boolean(noAssert);
        }

        this.buffer = capacity === 0 ? adone.emptyBuffer : Buffer.allocUnsafe(capacity);
        this.offset = 0;
        this.markedOffset = -1;
        this.limit = capacity;
        this.noAssert = noAssert;
    }

    readBitSet(offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }

        const ret = this.readVarint32(offset);
        const bits = ret.value;
        let bytes = (bits >> 3);
        let bit = 0;
        const value = [];
        let k;

        offset += ret.length;

        while (bytes--) {
            k = this.readInt8(offset++);
            value[bit++] = Boolean(k & 0x01);
            value[bit++] = Boolean(k & 0x02);
            value[bit++] = Boolean(k & 0x04);
            value[bit++] = Boolean(k & 0x08);
            value[bit++] = Boolean(k & 0x10);
            value[bit++] = Boolean(k & 0x20);
            value[bit++] = Boolean(k & 0x40);
            value[bit++] = Boolean(k & 0x80);
        }

        if (bit < bits) {
            let m = 0;
            k = this.readInt8(offset++);
            while (bit < bits) {
                value[bit++] = Boolean((k >> (m++)) & 1);
            }
        }

        if (relative) {
            this.offset = offset;
        }
        return value;
    }

    /**
     * Reads the specified number of bytes.
     * @param {number} length Number of bytes to read
     * @param {number=} offset Offset to read from. Will use and increase {@link ExBuffer#offset} by `length` if omitted.
     * @returns {!ExBuffer}
     * @expose
     */
    read(length, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + length > this.buffer.length) {
                throw new x.InvalidArgument(`Illegal offset: 0 <= ${offset} (${length}) <= ${this.buffer.length}`);
            }
        }
        const slice = this.slice(offset, offset + length);
        if (relative) {
            this.offset += length;
        }
        return slice;
    }

    readInt8(offset) {
        offset = this._checkRead(offset, 1);
        let value = this.buffer[offset];
        if ((value & 0x80) === 0x80) {
            value = -(0xFF - value + 1); // Cast to signed
        }
        return value;
    }

    readUInt8(offset) {
        offset = this._checkRead(offset, 1);
        return this.buffer[offset];
    }

    readInt16LE(offset) {
        offset = this._checkRead(offset, 2);
        let value = 0;
        value = this.buffer[offset];
        value |= this.buffer[offset + 1] << 8;
        if ((value & 0x8000) === 0x8000) {
            value = -(0xFFFF - value + 1); // Cast to signed
        }
        return value;
    }

    readInt16BE(offset) {
        offset = this._checkRead(offset, 2);
        let value = 0;
        value = this.buffer[offset] << 8;
        value |= this.buffer[offset + 1];
        if ((value & 0x8000) === 0x8000) {
            value = -(0xFFFF - value + 1); // Cast to signed
        }
        return value;
    }

    readUInt16LE(offset) {
        offset = this._checkRead(offset, 2);
        let value = 0;
        value = this.buffer[offset];
        value |= this.buffer[offset + 1] << 8;
        return value;
    }

    readUInt16BE(offset) {
        offset = this._checkRead(offset, 2);
        let value = 0;
        value = this.buffer[offset] << 8;
        value |= this.buffer[offset + 1];
        return value;
    }

    readInt32LE(offset) {
        offset = this._checkRead(offset, 4);
        let value = 0;
        value = this.buffer[offset + 2] << 16;
        value |= this.buffer[offset + 1] << 8;
        value |= this.buffer[offset];
        value += this.buffer[offset + 3] << 24 >>> 0;
        value |= 0; // Cast to signed
        return value;
    }

    readInt32BE(offset) {
        offset = this._checkRead(offset, 4);
        let value = 0;
        value = this.buffer[offset + 1] << 16;
        value |= this.buffer[offset + 2] << 8;
        value |= this.buffer[offset + 3];
        value += this.buffer[offset] << 24 >>> 0;
        value |= 0; // Cast to signed
        return value;
    }

    readUInt32LE(offset) {
        offset = this._checkRead(offset, 4);
        let value = 0;
        value = this.buffer[offset + 2] << 16;
        value |= this.buffer[offset + 1] << 8;
        value |= this.buffer[offset];
        value += this.buffer[offset + 3] << 24 >>> 0;
        return value;
    }

    readUInt32BE(offset) {
        offset = this._checkRead(offset, 4);
        let value = 0;
        value = this.buffer[offset + 1] << 16;
        value |= this.buffer[offset + 2] << 8;
        value |= this.buffer[offset + 3];
        value += this.buffer[offset] << 24 >>> 0;
        return value;
    }

    readInt64LE(offset) {
        offset = this._checkRead(offset, 8);
        let lo = 0;
        let hi = 0;
        lo = this.buffer[offset + 2] << 16;
        lo |= this.buffer[offset + 1] << 8;
        lo |= this.buffer[offset];
        lo += this.buffer[offset + 3] << 24 >>> 0;
        offset += 4;
        hi = this.buffer[offset + 2] << 16;
        hi |= this.buffer[offset + 1] << 8;
        hi |= this.buffer[offset];
        hi += this.buffer[offset + 3] << 24 >>> 0;
        return new Long(lo, hi, false);
    }

    readInt64BE(offset) {
        offset = this._checkRead(offset, 8);
        let lo = 0;
        let hi = 0;
        hi = this.buffer[offset + 1] << 16;
        hi |= this.buffer[offset + 2] << 8;
        hi |= this.buffer[offset + 3];
        hi += this.buffer[offset] << 24 >>> 0;
        offset += 4;
        lo = this.buffer[offset + 1] << 16;
        lo |= this.buffer[offset + 2] << 8;
        lo |= this.buffer[offset + 3];
        lo += this.buffer[offset] << 24 >>> 0;
        return new Long(lo, hi, false);
    }

    readUInt64LE(offset) {
        offset = this._checkRead(offset, 8);
        let lo = 0;
        let hi = 0;
        lo = this.buffer[offset + 2] << 16;
        lo |= this.buffer[offset + 1] << 8;
        lo |= this.buffer[offset];
        lo += this.buffer[offset + 3] << 24 >>> 0;
        offset += 4;
        hi = this.buffer[offset + 2] << 16;
        hi |= this.buffer[offset + 1] << 8;
        hi |= this.buffer[offset];
        hi += this.buffer[offset + 3] << 24 >>> 0;
        return new Long(lo, hi, true);
    }

    readUInt64BE(offset) {
        offset = this._checkRead(offset, 8);
        let lo = 0;
        let hi = 0;
        hi = this.buffer[offset + 1] << 16;
        hi |= this.buffer[offset + 2] << 8;
        hi |= this.buffer[offset + 3];
        hi += this.buffer[offset] << 24 >>> 0;
        offset += 4;
        lo = this.buffer[offset + 1] << 16;
        lo |= this.buffer[offset + 2] << 8;
        lo |= this.buffer[offset + 3];
        lo += this.buffer[offset] << 24 >>> 0;
        return new Long(lo, hi, true);
    }

    readFloatLE(offset) {
        offset = this._checkRead(offset, 4);
        return this.buffer.readFloatLE(offset, true);
    }

    readFloatBE(offset) {
        offset = this._checkRead(offset, 4);
        return this.buffer.readFloatBE(offset, true);
    }

    readDoubleLE(offset) {
        offset = this._checkRead(offset, 8);
        return this.buffer.readDoubleLE(offset, true);
    }

    readDoubleBE(offset) {
        offset = this._checkRead(offset, 8);
        return this.buffer.readDoubleBE(offset, true);
    }

    // Appends some data to this ExBuffer. This will overwrite any contents behind the specified offset up to the appended data's length.
    write(source, offset, length, encoding) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        const result = offset >>>= 0;
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        // let length;
        const isString = is.string(source); 
        if (isString) {
            length = length || Buffer.byteLength(source);
        } else {
            if (!is.exbuffer(source)) {
                source = ExBuffer.wrap(source, encoding);
            }
            length = source.limit - source.offset;
        }
        
        if (length <= 0) {
            return this; // Nothing to append
        }
        offset += length;
        let capacity = this.buffer.length;
        if (offset > capacity) {
            this.resize((capacity *= 2) > offset ? capacity : offset);
        }
        if (isString) {
            this.buffer.write(source, result);
        } else {
            source.buffer.copy(this.buffer, result, source.offset, source.limit);
            source.offset += length;
        }
        if (relative) {
            this.offset += length;
        }
        return this;
    }

    // Writes the array as a bitset.
    writeBitSet(value, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.array(value)) {
                throw new x.InvalidArgument("Illegal BitSet: Not an array");
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new TypeError(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new RangeError(`Illegal offset: 0 <= ${offset}  (0) <= ${this.buffer.length}`);
            }
        }

        const start = offset;
        const bits = value.length;
        let bytes = (bits >> 3);
        let bit = 0;
        let k;

        offset += this.writeVarint32(bits, offset);

        while (bytes--) {
            k = (Boolean(value[bit++]) & 1) |
                ((Boolean(value[bit++]) & 1) << 1) |
                ((Boolean(value[bit++]) & 1) << 2) |
                ((Boolean(value[bit++]) & 1) << 3) |
                ((Boolean(value[bit++]) & 1) << 4) |
                ((Boolean(value[bit++]) & 1) << 5) |
                ((Boolean(value[bit++]) & 1) << 6) |
                ((Boolean(value[bit++]) & 1) << 7);
            this.writeInt8(k, offset++);
        }

        if (bit < bits) {
            let m = 0; k = 0;
            while (bit < bits) {
                k = k | ((Boolean(value[bit++]) & 1) << (m++));
            }
            this.writeInt8(k, offset++);
        }

        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    }

    writeInt8(value, offset) {
        value |= 0;
        offset = this._checkWrite(value, offset, 1);
        this.buffer[offset] = value;
        return this;
    }

    writeUInt8(value, offset) {
        value >>>= 0;
        offset = this._checkWrite(value, offset, 1);
        this.buffer[offset] = value;
        return this;
    }

    writeInt16LE(value, offset) {
        value |= 0;
        offset = this._checkWrite(value, offset, 2);
        this.buffer[offset + 1] = value >>> 8;
        this.buffer[offset] = value;
        return this;
    }

    writeInt16BE(value, offset) {
        value |= 0;
        offset = this._checkWrite(value, offset, 2);
        this.buffer[offset] = value >>> 8;
        this.buffer[offset + 1] = value;
        return this;
    }

    writeUInt16LE(value, offset) {
        value >>>= 0;
        offset = this._checkWrite(value, offset, 2);
        this.buffer[offset + 1] = value >>> 8;
        this.buffer[offset] = value;
        return this;
    }

    writeUInt16BE(value, offset) {
        value >>>= 0;
        offset = this._checkWrite(value, offset, 2);

        this.buffer[offset] = value >>> 8;
        this.buffer[offset + 1] = value;
        return this;
    }

    writeInt32LE(value, offset) {
        value |= 0;
        offset = this._checkWrite(value, offset, 4);
        this.buffer[offset + 3] = value >>> 24;
        this.buffer[offset + 2] = value >>> 16;
        this.buffer[offset + 1] = value >>> 8;
        this.buffer[offset] = value;
        return this;
    }

    writeInt32BE(value, offset) {
        value |= 0;
        offset = this._checkWrite(value, offset, 4);
        this.buffer[offset] = value >>> 24;
        this.buffer[offset + 1] = value >>> 16;
        this.buffer[offset + 2] = value >>> 8;
        this.buffer[offset + 3] = value;
        return this;
    }

    writeUInt32LE(value, offset) {
        value >>>= 0;
        offset = this._checkWrite(value, offset, 4);
        this.buffer[offset + 3] = value >>> 24;
        this.buffer[offset + 2] = value >>> 16;
        this.buffer[offset + 1] = value >>> 8;
        this.buffer[offset] = value;
        return this;
    }

    writeUInt32BE(value, offset) {
        value >>>= 0;
        offset = this._checkWrite(value, offset, 4);
        this.buffer[offset] = value >>> 24;
        this.buffer[offset + 1] = value >>> 16;
        this.buffer[offset + 2] = value >>> 8;
        this.buffer[offset + 3] = value;
        return this;
    }

    writeInt64LE(value, offset) {
        [value, offset] = this._checkWriteLong(value, offset);
        const lo = value.low;
        const hi = value.high;
        this.buffer[offset + 3] = lo >>> 24;
        this.buffer[offset + 2] = lo >>> 16;
        this.buffer[offset + 1] = lo >>> 8;
        this.buffer[offset] = lo;
        offset += 4;
        this.buffer[offset + 3] = hi >>> 24;
        this.buffer[offset + 2] = hi >>> 16;
        this.buffer[offset + 1] = hi >>> 8;
        this.buffer[offset] = hi;
        return this;
    }

    writeInt64BE(value, offset) {
        [value, offset] = this._checkWriteLong(value, offset);
        const lo = value.low;
        const hi = value.high;
        this.buffer[offset] = hi >>> 24;
        this.buffer[offset + 1] = hi >>> 16;
        this.buffer[offset + 2] = hi >>> 8;
        this.buffer[offset + 3] = hi;
        offset += 4;
        this.buffer[offset] = lo >>> 24;
        this.buffer[offset + 1] = lo >>> 16;
        this.buffer[offset + 2] = lo >>> 8;
        this.buffer[offset + 3] = lo;
        return this;
    }

    writeUInt64LE(value, offset) {
        [value, offset] = this._checkWriteLong(value, offset);
        const lo = value.low;
        const hi = value.high;
        this.buffer[offset + 3] = lo >>> 24;
        this.buffer[offset + 2] = lo >>> 16;
        this.buffer[offset + 1] = lo >>> 8;
        this.buffer[offset] = lo;
        offset += 4;
        this.buffer[offset + 3] = hi >>> 24;
        this.buffer[offset + 2] = hi >>> 16;
        this.buffer[offset + 1] = hi >>> 8;
        this.buffer[offset] = hi;
        return this;
    }

    writeUInt64BE(value, offset) {
        [value, offset] = this._checkWriteLong(value, offset);
        const lo = value.low;
        const hi = value.high;
        this.buffer[offset] = hi >>> 24;
        this.buffer[offset + 1] = hi >>> 16;
        this.buffer[offset + 2] = hi >>> 8;
        this.buffer[offset + 3] = hi;
        offset += 4;
        this.buffer[offset] = lo >>> 24;
        this.buffer[offset + 1] = lo >>> 16;
        this.buffer[offset + 2] = lo >>> 8;
        this.buffer[offset + 3] = lo;
        return this;
    }

    writeFloatLE(value, offset) {
        offset = this._checkWrite(value, offset, 4, true);
        this.buffer.writeFloatLE(value, offset, true);
        return this;
    }

    writeFloatBE(value, offset) {
        offset = this._checkWrite(value, offset, 4, true);
        this.buffer.writeFloatBE(value, offset, true);
        return this;
    }

    writeDoubleLE(value, offset) {
        offset = this._checkWrite(value, offset, 8, true);
        this.buffer.writeDoubleLE(value, offset, true);
        return this;
    }

    writeDoubleBE(value, offset) {
        offset = this._checkWrite(value, offset, 8, true);
        this.buffer.writeDoubleBE(value, offset, true);
        return this;
    }

    _checkRead(offset, bytes) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
            this.offset += bytes;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            if (offset < 0 || offset + bytes > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (${bytes}) <= ${this.buffer.length}`);
            }
        }
        return offset;
    }

    _checkWrite(value, offset, bytes, isFloat) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
            this.offset += bytes;
        }
        const result = offset >>>= 0;
        if (!this.noAssert) {
            if (!is.number(value) || (!isFloat && value % 1 !== 0)) {
                throw new x.InvalidArgument(`Illegal value: ${value} (not an integer)`);
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        offset += bytes;
        let capacity = this.buffer.length;
        if (offset > capacity) {
            this.resize((capacity *= 2) > offset ? capacity : offset);
        }
        return result;
    }

    _checkWriteLong(value, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
            this.offset += 8;
        }
        const result = offset >>>= 0;
        if (!this.noAssert) {
            if (is.number(value)) {
                value = Long.fromNumber(value);
            } else if (is.string(value)) {
                value = Long.fromString(value);
            } else if (!(value && value instanceof Long)) {
                throw new x.InvalidArgument(`Illegal value: ${value} (not an integer or Long)`);
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        if (is.number(value)) {
            value = Long.fromNumber(value);
        } else if (is.string(value)) {
            value = Long.fromString(value);
        }

        offset += 8;
        let capacity = this.buffer.length;
        if (offset > capacity) {
            this.resize((capacity *= 2) > offset ? capacity : offset);
        }
        return [value, result];
    }

    writeVarint32(value, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(value) || value % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal value: ${value} (not an integer)`);
            }
            value |= 0;
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        const size = ExBuffer.calculateVarint32(value);
        let b;
        offset += size;
        let capacity10 = this.buffer.length;
        if (offset > capacity10) {
            this.resize((capacity10 *= 2) > offset ? capacity10 : offset);
        }
        offset -= size;
        value >>>= 0;
        while (value >= 0x80) {
            b = (value & 0x7f) | 0x80;
            this.buffer[offset++] = b;
            value >>>= 7;
        }
        this.buffer[offset++] = value;
        if (relative) {
            this.offset = offset;
            return this;
        }
        return size;
    }

    writeVarint32ZigZag(value, offset) {
        return this.writeVarint32(ExBuffer.zigZagEncode32(value), offset);
    }

    readVarint32(offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (1) <= ${this.buffer.length}`);
            }
        }
        let c = 0;
        let value = 0 >>> 0;
        let b;
        do {
            if (!this.noAssert && offset > this.limit) {
                const err = new x.Exception("Truncated");
                err.truncated = true;
                throw err;
            }
            b = this.buffer[offset++];
            if (c < 5) {
                value |= (b & 0x7f) << (7 * c);
            }
            ++c;
        } while ((b & 0x80) !== 0);
        value |= 0;
        if (relative) {
            this.offset = offset;
            return value;
        }
        return { value, length: c };
    }

    readVarint32ZigZag(offset) {
        let val = this.readVarint32(offset);
        if (is.object(val)) {
            val.value = ExBuffer.zigZagDecode32(val.value);
        } else {
            val = ExBuffer.zigZagDecode32(val);
        }
        return val;
    }

    writeVarint64(value, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (is.number(value)) {
                value = Long.fromNumber(value);
            } else if (is.string(value)) {
                value = Long.fromString(value);
            } else if (!(value && value instanceof Long)) {
                throw new x.InvalidArgument(`Illegal value: ${value} (not an integer or Long)`);
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        if (is.number(value)) {
            value = Long.fromNumber(value, false);
        } else if (is.string(value)) {
            value = Long.fromString(value, false);
        } else if (value.unsigned !== false) {
            value = value.toSigned();
        }
        const size = ExBuffer.calculateVarint64(value);
        const part0 = value.toInt() >>> 0;
        const part1 = value.shru(28).toInt() >>> 0;
        const part2 = value.shru(56).toInt() >>> 0;
        offset += size;
        let capacity11 = this.buffer.length;
        if (offset > capacity11) {
            this.resize((capacity11 *= 2) > offset ? capacity11 : offset);
        }
        offset -= size;
        switch (size) {
            case 10:
                this.buffer[offset + 9] = (part2 >>> 7) & 0x01;
            // falls through
            case 9:
                this.buffer[offset + 8] = size !== 9 ? (part2) | 0x80 : (part2) & 0x7F;
            // falls through
            case 8:
                this.buffer[offset + 7] = size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7F;
            // falls through
            case 7:
                this.buffer[offset + 6] = size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7F;
            // falls through
            case 6:
                this.buffer[offset + 5] = size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7F;
            // falls through
            case 5:
                this.buffer[offset + 4] = size !== 5 ? (part1) | 0x80 : (part1) & 0x7F;
            // falls through
            case 4:
                this.buffer[offset + 3] = size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7F;
            // falls through
            case 3:
                this.buffer[offset + 2] = size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7F;
            // falls through
            case 2:
                this.buffer[offset + 1] = size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7F;
            // falls through
            case 1:
                this.buffer[offset] = size !== 1 ? (part0) | 0x80 : (part0) & 0x7F;
        }
        if (relative) {
            this.offset += size;
            return this;
        }
        return size;

    }

    writeVarint64ZigZag(value, offset) {
        return this.writeVarint64(ExBuffer.zigZagEncode64(value), offset);
    }

    readVarint64(offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (1) <= ${this.buffer.length}`);
            }
        }
        // ref: src/google/protobuf/io/coded_stream.cc
        const start = offset;
        let part0 = 0;
        let part1 = 0;
        let part2 = 0;
        let b = 0;
        b = this.buffer[offset++];
        part0 = (b & 0x7F);
        if (b & 0x80) {
            b = this.buffer[offset++];
            part0 |= (b & 0x7F) << 7;
            if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                b = this.buffer[offset++];
                part0 |= (b & 0x7F) << 14;
                if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                    b = this.buffer[offset++];
                    part0 |= (b & 0x7F) << 21;
                    if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                        b = this.buffer[offset++];
                        part1 = (b & 0x7F);
                        if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                            b = this.buffer[offset++];
                            part1 |= (b & 0x7F) << 7;
                            if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                                b = this.buffer[offset++];
                                part1 |= (b & 0x7F) << 14;
                                if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                                    b = this.buffer[offset++];
                                    part1 |= (b & 0x7F) << 21;
                                    if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                                        b = this.buffer[offset++];
                                        part2 = (b & 0x7F);
                                        if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                                            b = this.buffer[offset++];
                                            part2 |= (b & 0x7F) << 7;
                                            if ((b & 0x80) || (this.noAssert && is.undefined(b))) {
                                                throw new x.IllegalState("Buffer overrun");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        const value = Long.fromBits(part0 | (part1 << 28), (part1 >>> 4) | (part2) << 24, false);
        if (relative) {
            this.offset = offset;
            return value;
        }
        return { value, length: offset - start };
    }

    readVarint64ZigZag(offset) {
        let val = this.readVarint64(offset);
        if (val && val.value instanceof Long) {
            val.value = ExBuffer.zigZagDecode64(val.value);
        } else {
            val = ExBuffer.zigZagDecode64(val);
        }
        return val;
    }

    writeCString(str, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        let i;
        let k = str.length;
        if (!this.noAssert) {
            if (!is.string(str)) {
                throw new x.InvalidArgument("Illegal str: Not a string");
            }
            for (i = 0; i < k; ++i) {
                if (str.charCodeAt(i) === 0) {
                    throw new x.InvalidArgument("Illegal str: Contains NULL-characters");
                }
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        // UTF8 strings do not contain zero bytes in between except for the zero character, so:
        k = Buffer.byteLength(str, "utf8");
        offset += k + 1;
        let capacity12 = this.buffer.length;
        if (offset > capacity12) {
            this.resize((capacity12 *= 2) > offset ? capacity12 : offset);
        }
        offset -= k + 1;
        offset += this.buffer.write(str, offset, k, "utf8");
        this.buffer[offset++] = 0;
        if (relative) {
            this.offset = offset;
            return this;
        }
        return k;
    }

    readCString(offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (1) <= ${this.buffer.length}`);
            }
        }
        const start = offset;
        let temp;
        // UTF8 strings do not contain zero bytes in between except for the zero character itself, so:
        do {
            if (offset >= this.buffer.length) {
                throw new x.IllegalState(`Index out of range: ${offset} <= ${this.buffer.length}`);
            }
            temp = this.buffer[offset++];
        } while (temp !== 0);
        const str = this.buffer.toString("utf8", start, offset - 1);
        if (relative) {
            this.offset = offset;
            return str;
        }
        return { string: str, length: offset - start };
    }

    // Writes an UTF8 encoded string.
    writeString(str, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        const k = Buffer.byteLength(str, "utf8");
        offset += k;
        let capacity14 = this.buffer.length;
        if (offset > capacity14) {
            capacity14 *= 2;
            this.resize(capacity14 > offset ? capacity14 : offset);
        }
        offset -= k;
        offset += this.buffer.write(str, offset, k, "utf8");
        if (relative) {
            this.offset = offset;
            return this;
        }
        return k;
    }

    readString(length, metrics, offset) {
        if (is.number(metrics)) {
            offset = metrics;
            metrics = undefined;
        }
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (is.undefined(metrics)) {
            metrics = ExBuffer.METRICS_CHARS;
        }
        if (!this.noAssert) {
            if (!is.number(length) || length % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal length: ${length} (not an integer)`);
            }
            length |= 0;
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        let i = 0;
        const start = offset;
        let temp;
        let sd;
        if (metrics === ExBuffer.METRICS_CHARS) { // The same for node and the browser
            sd = stringDestination();
            utfx.decodeUTF8(() => {
                return i < length && offset < this.limit ? this.buffer[offset++] : null;
            }, (cp) => {
                ++i;
                utfx.UTF8toUTF16(cp, sd);
            });
            if (i !== length) {
                throw new x.IllegalState(`Illegal range: Truncated data, ${i} == ${length}`);
            }
            if (relative) {
                this.offset = offset;
                return sd();
            }
            return { string: sd(), length: offset - start };

        } else if (metrics === ExBuffer.METRICS_BYTES) {
            if (!this.noAssert) {
                if (!is.number(offset) || offset % 1 !== 0) {
                    throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
                }
                offset >>>= 0;
                if (offset < 0 || offset + length > this.buffer.length) {
                    throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (${length}) <= ${this.buffer.length}`);
                }
            }
            temp = this.buffer.toString("utf8", offset, offset + length);
            if (relative) {
                this.offset += length;
                return temp;
            }
            return { string: temp, length };

        }
        throw new x.NotSupported(`Unsupported metrics: ${metrics}`);

    }

    writeVString(str, offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.string(str)) {
                throw new x.InvalidArgument("Illegal str: Not a string");
            }
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        const start = offset;
        const k = Buffer.byteLength(str, "utf8");
        const l = ExBuffer.calculateVarint32(k);
        offset += l + k;
        let capacity15 = this.buffer.length;
        if (offset > capacity15) {
            this.resize((capacity15 *= 2) > offset ? capacity15 : offset);
        }
        offset -= l + k;
        offset += this.writeVarint32(k, offset);
        offset += this.buffer.write(str, offset, k, "utf8");
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    }

    readVString(offset) {
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (1) <= ${this.buffer.length}`);
            }
        }
        const start = offset;
        const len = this.readVarint32(offset);
        const str = this.readString(len.value, ExBuffer.METRICS_BYTES, offset += len.length);
        offset += str.length;
        if (relative) {
            this.offset = offset;
            return str.string;
        }
        return { string: str.string, length: offset - start };
    }

    appendTo(target, offset) {
        target.write(this, offset);
        return this;
    }

    assert(assert) {
        this.noAssert = !assert;
        return this;
    }

    capacity() {
        return this.buffer.length;
    }

    clear() {
        this.offset = 0;
        this.limit = this.buffer.length;
        this.markedOffset = -1;
        return this;
    }

    clone(copy) {
        const bb = new ExBuffer(0, this.noAssert);
        if (copy) {
            const buffer = new Buffer(this.buffer.length);
            this.buffer.copy(buffer);
            bb.buffer = buffer;
        } else {
            bb.buffer = this.buffer;
        }
        bb.offset = this.offset;
        bb.markedOffset = this.markedOffset;
        bb.limit = this.limit;
        return bb;
    }

    compact(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        if (begin === 0 && end === this.buffer.length) {
            return this; // Already compacted
        }
        const len = end - begin;
        if (len === 0) {
            this.buffer = adone.emptyBuffer;
            if (this.markedOffset >= 0) {
                this.markedOffset -= begin;
            }
            this.offset = 0;
            this.limit = 0;
            return this;
        }
        const buffer = new Buffer(len);
        this.buffer.copy(buffer, 0, begin, end);
        this.buffer = buffer;
        if (this.markedOffset >= 0) {
            this.markedOffset -= begin;
        }
        this.offset = 0;
        this.limit = len;
        return this;
    }

    copy(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        if (begin === end) {
            return new ExBuffer(0, this.noAssert);
        }
        const capacity = end - begin;
        const bb = new ExBuffer(capacity, this.noAssert);
        bb.offset = 0;
        bb.limit = capacity;
        if (bb.markedOffset >= 0) {
            bb.markedOffset -= begin;
        }
        this.copyTo(bb, 0, begin, end);
        return bb;
    }

    copyTo(target, targetOffset, sourceOffset, sourceLimit) {
        let relative;
        let targetRelative;
        if (!this.noAssert) {
            if (!is.exbuffer(target)) {
                throw new x.InvalidArgument("Illegal target: Not a ExBuffer");
            }
        }
        targetOffset = (targetRelative = is.undefined(targetOffset)) ? target.offset : targetOffset | 0;
        sourceOffset = (relative = is.undefined(sourceOffset)) ? this.offset : sourceOffset | 0;
        sourceLimit = is.undefined(sourceLimit) ? this.limit : sourceLimit | 0;

        if (targetOffset < 0 || targetOffset > target.buffer.length) {
            throw new x.IllegalState(`Illegal target range: 0 <= ${targetOffset} <= ${target.buffer.length}`);
        }
        if (sourceOffset < 0 || sourceLimit > this.buffer.length) {
            throw new x.IllegalState(`Illegal source range: 0 <= ${sourceOffset} <= ${this.buffer.length}`);
        }

        const len = sourceLimit - sourceOffset;
        if (len === 0) {
            return target; // Nothing to copy
        }

        target.ensureCapacity(targetOffset + len);

        this.buffer.copy(target.buffer, targetOffset, sourceOffset, sourceLimit);

        if (relative) {
            this.offset += len;
        }
        if (targetRelative) {
            target.offset += len;
        }

        return this;
    }

    ensureCapacity(capacity) {
        let current = this.buffer.length;
        if (current < capacity) {
            return this.resize((current *= 2) > capacity ? current : capacity);
        }
        return this;
    }

    fill(value, begin, end) {
        const relative = is.undefined(begin);
        if (relative) {
            begin = this.offset;
        }
        if (is.string(value) && value.length > 0) {
            value = value.charCodeAt(0);
        }
        if (is.undefined(begin)) {
            begin = this.offset;
        }
        if (is.undefined(end)) {
            end = this.limit;
        }
        if (!this.noAssert) {
            if (!is.number(value) || value % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal value: ${value} (not an integer)`);
            }
            value |= 0;
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        if (begin >= end) {
            return this; // Nothing to fill
        }
        this.buffer.fill(value, begin, end);
        begin = end;
        if (relative) {
            this.offset = begin;
        }
        return this;
    }

    // Makes this ExBuffer ready for a new sequence of write or relative read operations. Sets `limit = offset` and `offset = 0`.
    // Make sure always to flip a ExBuffer when all relative read or write operations are complete.
    flip() {
        this.limit = this.offset;
        this.offset = 0;
        return this;
    }

    // Marks an offset on this ExBuffer to be used later.
    mark(offset) {
        offset = is.undefined(offset) ? this.offset : offset;
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        this.markedOffset = offset;
        return this;
    }

    prepend(source, encoding, offset) {
        if (is.number(encoding) || !is.string(encoding)) {
            offset = encoding;
            encoding = undefined;
        }
        const relative = is.undefined(offset);
        if (relative) {
            offset = this.offset;
        }
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal offset: ${offset} (not an integer)`);
            }
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.length) {
                throw new x.IllegalState(`Illegal offset: 0 <= ${offset} (0) <= ${this.buffer.length}`);
            }
        }
        if (!(source instanceof ExBuffer)) {
            source = ExBuffer.wrap(source, encoding);
        }
        const len = source.limit - source.offset;
        if (len <= 0) {
            return this; // Nothing to prepend
        }
        const diff = len - offset;
        if (diff > 0) { // Not enough space before offset, so resize + move
            const buffer = new Buffer(this.buffer.length + diff);
            this.buffer.copy(buffer, len, offset, this.buffer.length);
            this.buffer = buffer;
            this.offset += diff;
            if (this.markedOffset >= 0) {
                this.markedOffset += diff;
            }
            this.limit += diff;
            offset += diff;
        }
        source.buffer.copy(this.buffer, offset - len, source.offset, source.limit);

        source.offset = source.limit;
        if (relative) {
            this.offset -= len;
        }
        return this;
    }

    prependTo(target, offset) {
        target.prepend(this, offset);
        return this;
    }

    remaining() {
        return this.limit - this.offset;
    }

    reset() {
        if (this.markedOffset >= 0) {
            this.offset = this.markedOffset;
            this.markedOffset = -1;
        } else {
            this.offset = 0;
        }
        return this;
    }

    resize(capacity) {
        if (!this.noAssert) {
            if (!is.number(capacity) || capacity % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal capacity: ${capacity} (not an integer)`);
            }
            capacity |= 0;
            if (capacity < 0) {
                throw new x.IllegalState(`Illegal capacity: 0 <= ${capacity}`);
            }
        }
        if (this.buffer.length < capacity) {
            const buffer = Buffer.allocUnsafe(capacity);
            this.buffer.copy(buffer);
            this.buffer = buffer;
        }
        return this;
    }

    reverse(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        if (begin === end) {
            return this; // Nothing to reverse
        }
        Array.prototype.reverse.call(this.buffer.slice(begin, end));
        return this;
    }

    skip(length) {
        if (!this.noAssert) {
            if (!is.number(length) || length % 1 !== 0) {
                throw new x.InvalidArgument(`Illegal length: ${length} (not an integer)`);
            }
            length |= 0;
        }
        const offset = this.offset + length;
        if (!this.noAssert) {
            if (offset < 0 || offset > this.buffer.length) {
                throw new x.IllegalState(`Illegal length: 0 <= ${this.offset} + ${length} <= ${this.buffer.length}`);
            }
        }
        this.offset = offset;
        return this;
    }

    slice(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        const bb = new ExBuffer(end - begin);
        bb.buffer = this.buffer.slice(begin, end);
        return bb;
    }

    // Returns a copy of the backing buffer that contains this ExBuffer's contents.
    toBuffer(forceCopy, begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        begin >>>= 0;
        end >>>= 0;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        if (forceCopy) {
            const buffer = new Buffer(end - begin);
            this.buffer.copy(buffer, 0, begin, end);
            return buffer;
        }
        if (begin === 0 && end === this.buffer.length) {
            return this.buffer;
        }
        return this.buffer.slice(begin, end);

    }

    toArrayBuffer() {
        let offset = this.offset;
        let limit = this.limit;
        if (!this.noAssert) {
            if (!is.number(offset) || offset % 1 !== 0) {
                throw new x.InvalidArgument("Illegal offset: Not an integer");
            }
            offset >>>= 0;
            if (!is.number(limit) || limit % 1 !== 0) {
                throw new x.InvalidArgument("Illegal limit: Not an integer");
            }
            limit >>>= 0;
            if (offset < 0 || offset > limit || limit > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${offset} <= ${limit} <= ${this.buffer.length}`);
            }
        }
        const ab = new ArrayBuffer(limit - offset);
        utoa(ab, 0, this.buffer, offset, limit);
        return ab;
    }

    toString(encoding, begin, end) {
        if (is.undefined(encoding)) {
            return `ByteBufferNB(offset=${this.offset},markedOffset=${this.markedOffset},limit=${this.limit},capacity=${this.capacity()})`;
        }

        switch (encoding) {
            case "utf8":
                return this.toUTF8(begin, end);
            case "base64":
                return this.toBase64(begin, end);
            case "hex":
                return this.toHex(begin, end);
            case "binary":
                return this.toBinary(begin, end);
            case "debug":
                return this.toDebug();
            case "columns":
                return this.toColumns();
            default:
                throw new x.NotSupported(`Unsupported encoding: ${encoding}`);
        }
    }

    toBase64(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        begin = begin | 0; end = end | 0;
        if (begin < 0 || end > this.capacity || begin > end) {
            throw new x.IllegalState("begin, end");
        }
        return this.buffer.toString("base64", begin, end);
    }

    toBinary(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        begin |= 0; end |= 0;
        if (begin < 0 || end > this.capacity() || begin > end) {
            throw new x.IllegalState("begin, end");
        }
        return this.buffer.toString("binary", begin, end);
    }

    toDebug(columns) {
        let i = -1;
        const k = this.buffer.length;
        let b;
        let hex = "";
        let asc = "";
        let out = "";
        while (i < k) {
            if (i !== -1) {
                b = this.buffer[i];
                if (b < 0x10) {
                    hex += `0${b.toString(16).toUpperCase()}`;
                } else {
                    hex += b.toString(16).toUpperCase();
                }
                if (columns) {
                    asc += b > 32 && b < 127 ? String.fromCharCode(b) : ".";
                }
            }
            ++i;
            if (columns) {
                if (i > 0 && i % 16 === 0 && i !== k) {
                    while (hex.length < 3 * 16 + 3) {
                        hex += " ";
                    }
                    out += `${hex + asc}\n`;
                    hex = asc = "";
                }
            }
            if (i === this.offset && i === this.limit) {
                hex += i === this.markedOffset ? "!" : "|";
            } else if (i === this.offset) {
                hex += i === this.markedOffset ? "[" : "<";
            } else if (i === this.limit) {
                hex += i === this.markedOffset ? "]" : ">";
            } else {
                hex += i === this.markedOffset ? "'" : (columns || (i !== 0 && i !== k) ? " " : "");
            }
        }
        if (columns && hex !== " ") {
            while (hex.length < 3 * 16 + 3) {
                hex += " ";
            }
            out += `${hex + asc}\n`;
        }
        return columns ? out : hex;
    }

    toHex(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        return this.buffer.toString("hex", begin, end);
    }

    toUTF8(begin, end) {
        begin = is.undefined(begin) ? this.offset : begin;
        end = is.undefined(end) ? this.limit : end;
        if (!this.noAssert) {
            if (!is.number(begin) || begin % 1 !== 0) {
                throw new x.InvalidArgument("Illegal begin: Not an integer");
            }
            begin >>>= 0;
            if (!is.number(end) || end % 1 !== 0) {
                throw new x.InvalidArgument("Illegal end: Not an integer");
            }
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.length) {
                throw new x.IllegalState(`Illegal range: 0 <= ${begin} <= ${end} <= ${this.buffer.length}`);
            }
        }
        return this.buffer.toString("utf8", begin, end);
    }

    static accessor() {
        return Buffer;
    }

    static allocate(capacity, noAssert) {
        return new ExBuffer(capacity, noAssert);
    }

    static concat(buffers, encoding, noAssert) {
        if (is.boolean(encoding) || !is.string(encoding)) {
            noAssert = encoding;
            encoding = undefined;
        }
        let capacity = 0;
        const k = buffers.length;
        let i = 0;
        let length;
        for (; i < k; ++i) {
            if (!is.exbuffer(buffers[i])) {
                buffers[i] = ExBuffer.wrap(buffers[i], encoding);
            }
            length = buffers[i].limit - buffers[i].offset;
            if (length > 0) {
                capacity += length;
            }
        }
        if (capacity === 0) {
            return new ExBuffer(0, noAssert);
        }
        const bb = new ExBuffer(capacity, noAssert);
        let bi;
        i = 0;

        while (i < k) {
            bi = buffers[i++];
            length = bi.limit - bi.offset;
            if (length <= 0) {
                continue;
            }
            bi.buffer.copy(bb.buffer, bb.offset, bi.offset, bi.limit);
            bb.offset += length;
        }
        bb.limit = bb.offset;
        bb.offset = 0;
        return bb;
    }

    static type() {
        return Buffer;
    }

    static wrap(buffer, encoding, noAssert) {
        if (is.string(buffer)) {
            if (is.undefined(encoding)) {
                encoding = "utf8";
            }
            switch (encoding) {
                case "base64":
                    return ExBuffer.fromBase64(buffer);
                case "hex":
                    return ExBuffer.fromHex(buffer);
                case "binary":
                    return ExBuffer.fromBinary(buffer);
                case "utf8":
                    return ExBuffer.fromUTF8(buffer);
                case "debug":
                    return ExBuffer.fromDebug(buffer);
                default:
                    throw new x.NotSupported(`Unsupported encoding: ${encoding}`);
            }
        }

        let bb;
        if (is.exbuffer(buffer)) {
            bb = buffer.clone();
            bb.markedOffset = -1;
            return bb;
        }

        let b;

        if (buffer instanceof Uint8Array) { // Extract bytes from Uint8Array
            b = Buffer.allocUnsafe(buffer.length);
            atou(b, 0, buffer.buffer, buffer.byteOffset, buffer.byteOffset + buffer.length);
            buffer = b;
        } else if (buffer instanceof ArrayBuffer) { // Convert ArrayBuffer to Buffer
            b = Buffer.allocUnsafe(buffer.byteLength);
            atou(b, 0, buffer, 0, buffer.byteLength);
            buffer = b;
        } else if (!(buffer instanceof Buffer)) { // Create from octets if it is an error, otherwise fail
            if (!is.array(buffer)) {
                throw new x.InvalidArgument("Illegal buffer");
            }
            buffer = new Buffer(buffer);
        }
        bb = new ExBuffer(0, noAssert);
        if (buffer.length > 0) { // Avoid references to more than one EMPTY_BUFFER
            bb.buffer = buffer;
            bb.limit = buffer.length;
        }
        return bb;
    }

    static calculateVarint32(value) {
        value = value >>> 0;
        if (value < 1 << 7) {
            return 1;
        } else if (value < 1 << 14) {
            return 2;
        } else if (value < 1 << 21) {
            return 3;
        } else if (value < 1 << 28) {
            return 4;
        }
        return 5;
    }

    // Zigzag encodes a signed 32bit integer so that it can be effectively used with varint encoding.
    static zigZagEncode32(n) {
        return (((n |= 0) << 1) ^ (n >> 31)) >>> 0; // ref: src/google/protobuf/wire_format_lite.h
    }

    // Decodes a zigzag encoded signed 32bit integer.
    static zigZagDecode32(n) {
        return ((n >>> 1) ^ -(n & 1)) | 0; // // ref: src/google/protobuf/wire_format_lite.h
    }

    // Calculates the actual number of bytes required to store a 64bit base 128 variable-length integer.
    static calculateVarint64(value) {
        if (is.number(value)) {
            value = Long.fromNumber(value);
        } else if (is.string(value)) {
            value = Long.fromString(value);
        }
        // ref: src/google/protobuf/io/coded_stream.cc
        const part0 = value.toInt() >>> 0;
        const part1 = value.shru(28).toInt() >>> 0;
        const part2 = value.shru(56).toInt() >>> 0;
        if (part2 === 0) {
            if (part1 === 0) {
                if (part0 < 1 << 14) {
                    return part0 < 1 << 7 ? 1 : 2;
                }
                return part0 < 1 << 21 ? 3 : 4;

            }
            if (part1 < 1 << 14) {
                return part1 < 1 << 7 ? 5 : 6;
            }
            return part1 < 1 << 21 ? 7 : 8;
        }
        return part2 < 1 << 7 ? 9 : 10;

    }

    // Zigzag encodes a signed 64bit integer so that it can be effectively used with varint encoding.
    static zigZagEncode64(value) {
        if (is.number(value)) {
            value = Long.fromNumber(value, false);
        } else if (is.string(value)) {
            value = Long.fromString(value, false);
        } else if (value.unsigned !== false) {
            value = value.toSigned();
        }
        // ref: src/google/protobuf/wire_format_lite.h
        return value.shl(1).xor(value.shr(63)).toUnsigned();
    }

    // Decodes a zigzag encoded signed 64bit integer.
    static zigZagDecode64(value) {
        if (is.number(value)) {
            value = Long.fromNumber(value, false);
        } else if (is.string(value)) {
            value = Long.fromString(value, false);
        } else if (value.unsigned !== false) {
            value = value.toSigned();
        }
        // ref: src/google/protobuf/wire_format_lite.h
        return value.shru(1).xor(value.and(Long.ONE).toSigned().negate()).toSigned();
    }

    // Calculates the number of UTF8 characters of a string. JavaScript itself uses UTF-16, so that a string's `length` property does not reflect its actual UTF8 size if it contains code points larger than 0xFFFF.
    static calculateUTF8Chars(str) {
        return utfx.calculateUTF16asUTF8(stringSource(str))[0];
    }

    // Calculates the number of UTF8 bytes of a string.
    static calculateString(str) {
        if (!is.string(str)) {
            throw new x.InvalidArgument(`Illegal argument: ${typeof str}`);
        }
        return Buffer.byteLength(str, "utf8");
    }

    // Decodes a base64 encoded string to a ExBuffer.
    static fromBase64(str) {
        return ExBuffer.wrap(Buffer.from(str, "base64"));
    }

    // Encodes a binary string to base64 like `window.btoa` does.
    static btoa(str) {
        return ExBuffer.fromBinary(str).toBase64();
    }

    // Decodes a base64 encoded string to binary like `window.atob` does.
    static atob(b64) {
        return ExBuffer.fromBase64(b64).toBinary();
    }

    // Decodes a binary encoded string, that is using only characters 0x00-0xFF as bytes, to a ExBuffer.
    static fromBinary(str) {
        return ExBuffer.wrap(Buffer.from(str, "binary"));
    }

    // Decodes a hex encoded string with marked offsets to a ExBuffer.
    static fromDebug(str, noAssert) {
        const k = str.length;
        const bb = new ExBuffer(((k + 1) / 3) | 0, noAssert);
        let i = 0;
        let j = 0;
        let ch;
        let b;
        let rs = false; // Require symbol next
        let ho = false;
        let hm = false;
        let hl = false; // Already has offset (ho), markedOffset (hm), limit (hl)?
        let fail = false;
        while (i < k) {
            switch (ch = str.charAt(i++)) {
                case "!":
                    if (!noAssert) {
                        if (ho || hm || hl) {
                            fail = true;
                            break;
                        }
                        ho = hm = hl = true;
                    }
                    bb.offset = bb.markedOffset = bb.limit = j;
                    rs = false;
                    break;
                case "|":
                    if (!noAssert) {
                        if (ho || hl) {
                            fail = true;
                            break;
                        }
                        ho = hl = true;
                    }
                    bb.offset = bb.limit = j;
                    rs = false;
                    break;
                case "[":
                    if (!noAssert) {
                        if (ho || hm) {
                            fail = true;
                            break;
                        }
                        ho = hm = true;
                    }
                    bb.offset = bb.markedOffset = j;
                    rs = false;
                    break;
                case "<":
                    if (!noAssert) {
                        if (ho) {
                            fail = true;
                            break;
                        }
                        ho = true;
                    }
                    bb.offset = j;
                    rs = false;
                    break;
                case "]":
                    if (!noAssert) {
                        if (hl || hm) {
                            fail = true;
                            break;
                        }
                        hl = hm = true;
                    }
                    bb.limit = bb.markedOffset = j;
                    rs = false;
                    break;
                case ">":
                    if (!noAssert) {
                        if (hl) {
                            fail = true;
                            break;
                        }
                        hl = true;
                    }
                    bb.limit = j;
                    rs = false;
                    break;
                case "'":
                    if (!noAssert) {
                        if (hm) {
                            fail = true;
                            break;
                        }
                        hm = true;
                    }
                    bb.markedOffset = j;
                    rs = false;
                    break;
                case " ":
                    rs = false;
                    break;
                default:
                    if (!noAssert) {
                        if (rs) {
                            fail = true;
                            break;
                        }
                    }
                    b = parseInt(ch + str.charAt(i++), 16);
                    if (!noAssert) {
                        if (isNaN(b) || b < 0 || b > 255) {
                            throw new x.IllegalState("Illegal str: Not a debug encoded string");
                        }
                    }
                    bb.buffer[j++] = b;
                    rs = true;
            }
            if (fail) {
                throw new x.IllegalState(`Illegal str: Invalid symbol at ${i}`);
            }
        }
        if (!noAssert) {
            if (!ho || !hl) {
                throw new x.IllegalState("Illegal str: Missing offset or limit");
            }
            if (j < bb.buffer.length) {
                throw new x.IllegalState(`Illegal str: Not a debug encoded string (is it hex?) ${j} < ${k}`);
            }
        }
        return bb;
    }

    // Decodes a hex encoded string to a ExBuffer.
    static fromHex(str, noAssert) {
        if (!noAssert) {
            if (!is.string(str)) {
                throw new x.InvalidArgument("Illegal str: Not a string");
            }
            if (str.length % 2 !== 0) {
                throw new x.InvalidArgument("Illegal str: Length not a multiple of 2");
            }
        }
        const bb = new ExBuffer(0, true);
        bb.buffer = Buffer.from(str, "hex");
        bb.limit = bb.buffer.length;
        return bb;
    }

    // Decodes an UTF8 encoded string to a ExBuffer.
    static fromUTF8(str, noAssert) {
        if (!noAssert) {
            if (!is.string(str)) {
                throw new x.InvalidArgument("Illegal str: Not a string");
            }
        }
        const bb = new ExBuffer(0, noAssert);
        bb.buffer = Buffer.from(str, "utf8");
        bb.limit = bb.buffer.length;
        return bb;
    }
}
adone.tag.set(ExBuffer, adone.tag.EXBUFFER);
ExBuffer.DEFAULT_CAPACITY = 64;
ExBuffer.DEFAULT_NOASSERT = false;
ExBuffer.MAX_VARINT32_BYTES = 5; // Maximum number of bytes required to store a 32bit base 128 variable-length integer
ExBuffer.MAX_VARINT64_BYTES = 10; // Maximum number of bytes required to store a 64bit base 128 variable-length integer
ExBuffer.METRICS_CHARS = "c"; // Metrics representing number of UTF8 characters. Evaluates to `c`.
ExBuffer.METRICS_BYTES = "b"; // Metrics representing number of bytes. Evaluates to `b`.
