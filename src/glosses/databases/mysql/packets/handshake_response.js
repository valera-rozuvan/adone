const { is, x, database: { mysql: { c, packet: { Packet }, auth } } } = adone;

export default class HandshakeResponse {
    constructor(handshake) {
        this.user = handshake.user || "";
        this.database = handshake.database || "";
        this.password = handshake.password || "";
        this.passwordSha1 = handshake.passwordSha1;
        this.authPluginData1 = handshake.authPluginData1;
        this.authPluginData2 = handshake.authPluginData2;
        this.compress = handshake.compress;
        this.clientFlags = handshake.flags;
        // TODO: pre-4.1 auth support
        let authToken;
        if (this.passwordSha1) {
            authToken = auth.calculateTokenFromPasswordSha(
                this.passwordSha1,
                this.authPluginData1,
                this.authPluginData2
            );
        } else {
            authToken = auth.calculateToken(
                this.password,
                this.authPluginData1,
                this.authPluginData2
            );
        }
        this.authToken = authToken;
        this.charsetNumber = handshake.charsetNumber;
        this.encoding = c.charsetEncoding[handshake.charsetNumber];
        this.connectAttributes = handshake.connectAttributes;
    }

    serializeResponse(buffer) {
        const isSet = (flag) => this.clientFlags & c.client[flag];
        const packet = new Packet(0, buffer, 0, buffer.length);
        packet.offset = 4;
        packet.writeInt32(this.clientFlags);
        packet.writeInt32(0); // max packet size. todo: move to config
        packet.writeInt8(this.charsetNumber);
        packet.skip(23);

        const encoding = this.encoding;
        packet.writeNullTerminatedString(this.user, encoding);

        if (isSet("PLUGIN_AUTH_LENENC_CLIENT_DATA")) {
            packet.writeLengthCodedNumber(this.authToken.length);
            packet.writeBuffer(this.authToken);
        } else if (isSet("SECURE_CONNECTION")) {
            packet.writeInt8(this.authToken.length);
            packet.writeBuffer(this.authToken);
        } else {
            packet.writeBuffer(this.authToken);
            packet.writeInt8(0);
        } if (isSet("CONNECT_WITH_DB")) {
            packet.writeNullTerminatedString(this.database, encoding);
        }
        if (isSet("PLUGIN_AUTH")) {
            // TODO: pass from config
            packet.writeNullTerminatedString("mysql_native_password", "latin1");
        }
        if (isSet("CONNECT_ATTRS")) {
            const connectAttributes = this.connectAttributes || {};
            const attrNames = Object.keys(connectAttributes);
            let keysLength = 0;
            for (let k = 0; k < attrNames.length; ++k) {
                keysLength += Packet.lengthCodedStringLength(attrNames[k], encoding);
                keysLength += Packet.lengthCodedStringLength(
                    connectAttributes[attrNames[k]],
                    encoding
                );
            }
            packet.writeLengthCodedNumber(keysLength);
            for (let k = 0; k < attrNames.length; ++k) {
                packet.writeLengthCodedString(attrNames[k], encoding);
                packet.writeLengthCodedString(connectAttributes[attrNames[k]], encoding);
            }
        }
        return packet;
    }

    toPacket() {
        if (!is.string(this.user)) {
            throw new x.IllegalState('"user" connection config prperty must be a string');
        }
        if (!is.string(this.database)) {
            throw new x.IllegalState('"database" connection config prperty must be a string');
        }
        // dry run: calculate resulting packet length
        const p = this.serializeResponse(Packet.mockBuffer());
        return this.serializeResponse(Buffer.allocUnsafe(p.offset));
    }

    static fromPacket(packet) {
        const args = {};
        args.clientFlags = packet.readInt32();

        const isSet = (flag) => args.clientFlags & c.client[flag];

        args.maxPacketSize = packet.readInt32();
        args.charsetNumber = packet.readInt8();
        const encoding = c.charsetEncoding[args.charsetNumber];
        args.encoding = encoding;
        packet.skip(23);
        args.user = packet.readNullTerminatedString(encoding);
        let authTokenLength;
        if (isSet("PLUGIN_AUTH_LENENC_CLIENT_DATA")) {
            authTokenLength = packet.readLengthCodedNumber(encoding);
            args.authToken = packet.readBuffer(authTokenLength);
        } else if (isSet("SECURE_CONNECTION")) {
            authTokenLength = packet.readInt8();
            args.authToken = packet.readBuffer(authTokenLength);
        } else {
            args.authToken = packet.readNullTerminatedString(encoding);
        } if (isSet("CONNECT_WITH_DB")) {
            args.database = packet.readNullTerminatedString(encoding);
        }
        if (isSet("PLUGIN_AUTH")) {
            args.authPluginName = packet.readNullTerminatedString(encoding);
        }
        if (isSet("CONNECT_ATTRS")) {
            const keysLength = packet.readLengthCodedNumber(encoding);
            const keysEnd = packet.offset + keysLength;
            const attrs = {};
            while (packet.offset < keysEnd) {
                const t = packet.readLengthCodedString(encoding);
                attrs[t] = packet.readLengthCodedString(encoding);
            }
            args.connectAttributes = attrs;
        }
        return args;
    }
}