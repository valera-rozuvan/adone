/* global describe it */

import { BinaryParser } from "./binary_parser";

const { BSON } = adone.data.bson;
const Int32 = BSON.Int32;
const Double = BSON.Double;

function createBSON() {
    return new BSON([BSON.Binary, BSON.Code, BSON.DBRef, BSON.Decimal128,
    BSON.Double, BSON.Int32, BSON.Long, BSON.Map, BSON.MaxKey, BSON.MinKey,
    BSON.ObjectId, BSON.BSONRegExp, BSON.Symbol, BSON.Timestamp]);
}

// for tests
BSON.BSON_BINARY_SUBTYPE_DEFAULT = 0;
BSON.BSON_BINARY_SUBTYPE_FUNCTION = 1;
BSON.BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
BSON.BSON_BINARY_SUBTYPE_UUID = 3;
BSON.BSON_BINARY_SUBTYPE_MD5 = 4;
BSON.BSON_BINARY_SUBTYPE_USER_DEFINED = 128;

BSON.BSON_BINARY_SUBTYPE_DEFAULT = 0;
BSON.BSON_BINARY_SUBTYPE_FUNCTION = 1;
BSON.BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
BSON.BSON_BINARY_SUBTYPE_UUID = 3;
BSON.BSON_BINARY_SUBTYPE_MD5 = 4;
BSON.BSON_BINARY_SUBTYPE_USER_DEFINED = 128;

describe("bson", () => {
    describe("promote values", () => {
        it("Should Correctly Deserialize object with all wrapper types", function () {
            const bytes = [26, 1, 0, 0, 7, 95, 105, 100, 0, 161, 190, 98, 75, 118, 169, 3, 0, 0, 3, 0, 0, 4, 97, 114, 114, 97, 121, 0, 26, 0, 0, 0, 16, 48, 0, 1, 0, 0, 0, 16, 49, 0, 2, 0, 0, 0, 16, 50, 0, 3, 0, 0, 0, 0, 2, 115, 116, 114, 105, 110, 103, 0, 6, 0, 0, 0, 104, 101, 108, 108, 111, 0, 3, 104, 97, 115, 104, 0, 19, 0, 0, 0, 16, 97, 0, 1, 0, 0, 0, 16, 98, 0, 2, 0, 0, 0, 0, 9, 100, 97, 116, 101, 0, 161, 190, 98, 75, 0, 0, 0, 0, 7, 111, 105, 100, 0, 161, 190, 98, 75, 90, 217, 18, 0, 0, 1, 0, 0, 5, 98, 105, 110, 97, 114, 121, 0, 7, 0, 0, 0, 2, 3, 0, 0, 0, 49, 50, 51, 16, 105, 110, 116, 0, 42, 0, 0, 0, 1, 102, 108, 111, 97, 116, 0, 223, 224, 11, 147, 169, 170, 64, 64, 11, 114, 101, 103, 101, 120, 112, 0, 102, 111, 111, 98, 97, 114, 0, 105, 0, 8, 98, 111, 111, 108, 101, 97, 110, 0, 1, 15, 119, 104, 101, 114, 101, 0, 25, 0, 0, 0, 12, 0, 0, 0, 116, 104, 105, 115, 46, 120, 32, 61, 61, 32, 51, 0, 5, 0, 0, 0, 0, 3, 100, 98, 114, 101, 102, 0, 37, 0, 0, 0, 2, 36, 114, 101, 102, 0, 5, 0, 0, 0, 116, 101, 115, 116, 0, 7, 36, 105, 100, 0, 161, 190, 98, 75, 2, 180, 1, 0, 0, 2, 0, 0, 0, 10, 110, 117, 108, 108, 0, 0];
            let serialized_data = "";

            // Convert to chars
            for (let i = 0; i < bytes.length; i++) {
                serialized_data = serialized_data + BinaryParser.fromByte(bytes[i]);
            }

            const object = createBSON().deserialize(new Buffer(serialized_data, "binary"), { promoteValues: false });
            // Perform tests
            expect("hello").to.be.equal(object.string);
            expect([new Int32(1), new Int32(2), new Int32(3)]).to.be.deep.equal(object.array);
            expect(new Int32(1)).to.be.deep.equal(object.hash.a);
            expect(new Int32(2)).to.be.deep.equal(object.hash.b);
            expect(object.date !== null).to.be.ok;
            expect(object.oid !== null).to.be.ok;
            expect(object.binary !== null).to.be.ok;
            expect(new Int32(42)).to.be.deep.equal(object.int);
            expect(new Double(33.3333)).to.be.deep.equal(object.float);
            expect(object.regexp !== null).to.be.ok;
            expect(true).to.be.equal(object.boolean);
            expect(object.where !== null).to.be.ok;
            expect(object.dbref !== null).to.be.ok;
            expect(object[null] == null).to.be.ok;
        });
    });
});