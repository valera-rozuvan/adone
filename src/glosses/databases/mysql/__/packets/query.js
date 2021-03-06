const { database: { mysql: { c, __ } } } = adone;
const { packet } = __;

export default class Query {
    constructor(sql, charsetNumber) {
        this.query = sql;
        this.charsetNumber = charsetNumber;
        this.encoding = c.charsetEncoding[charsetNumber];
    }

    toPacket() {
        const buf = __.stringParser.encode(this.query, this.encoding);
        const length = 5 + buf.length;

        const buffer = Buffer.allocUnsafe(length);
        const p = new packet.Packet(0, buffer, 0, length);
        p.offset = 4;
        p.writeInt8(c.command.QUERY);
        p.writeBuffer(buf);
        return p;
    }
}
