const { is, std: { fs, stream } } = adone;

export const fsCreateWriteStream = (filename) => {
    const s = fs.createWriteStream(filename);
    if (process.version.match(/^v0.8/)) {
        s.on("close", () => {
            s.emit("finish");
        });
    }
    return s;
};

export const bufferEqual = (a, b) => {
    /* The bl module does not expose array indexing for its instances,
     * however, Buffer.get is deprecated and will be removed.
     * (See https://github.com/nodejs/io.js/blob/60a974d200/lib/buffer.js#L425)
     * => All incoming objects will be coerced to Buffer */
    if (!is.buffer(a)) {
        a = a.slice();
    }

    if (!is.buffer(b)) {
        b = b.slice();
    }

    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
};

export class NullStream extends stream.Writable {
    _write(chunk, encoding, callback) {
        callback();
    }
}
