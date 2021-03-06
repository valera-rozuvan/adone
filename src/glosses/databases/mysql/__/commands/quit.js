const { database: { mysql: { c, __ } } } = adone;
const { packet, command: { Command } } = __;

export default class Quit extends Command {
    constructor(callback) {
        super();
        this.done = callback;
    }

    start(_, connection) {
        connection._closing = true;
        const quit = new packet.Packet(0, Buffer.from([1, 0, 0, 0, c.command.QUIT]), 0, 5);
        if (this.done) {
            this.done();
        }
        connection.writePacket(quit);
        return null;
    }
}
