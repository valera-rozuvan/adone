function addOperation(type, key, value, options) {
    const operation = {
        type,
        key,
        value,
        options
    };

    if (options && options.prefix) {
        operation.prefix = options.prefix;
        delete options.prefix;
    }

    this._operations.push(operation);

    return this;
}

function Batch(sdb) {
    this._operations = [];
    this._sdb = sdb;

    this.put = addOperation.bind(this, "put");
    this.del = addOperation.bind(this, "del");
}

const B = Batch.prototype;

B.clear = function () {
    this._operations = [];
};

B.write = function (cb) {
    this._sdb.batch(this._operations, cb);
};

export default Batch;
