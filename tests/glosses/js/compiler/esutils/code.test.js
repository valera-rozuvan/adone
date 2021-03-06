const { esutils } = adone.js.compiler;

const __range__ = (left, right, inclusive) => {
    const range = [];
    const ascending = left < right;
    const end = !inclusive ? right : ascending ? right + 1 : right - 1;
    for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
        range.push(i);
    }
    return range;
};

describe("js", "compiler", "esutils", "code", () => {
    describe("isDecimalDigit", () => {
        it("returns true if provided code is decimal digit", () =>
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ch) =>
                expect(esutils.code.isDecimalDigit((String(ch)).charCodeAt(0))).to.be.true)
        );

        return it("returns false if provided code is not decimal digit", () => {
            for (const code of __range__("a".charCodeAt(0), "z".charCodeAt(0), true)) {
                expect(esutils.code.isDecimalDigit(code)).to.be.false;
            }

            return __range__("A".charCodeAt(0), "Z".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isDecimalDigit(code)).to.be.false);
        });
    });

    describe("isHexDigit", () => {
        it("returns true if provided code is hexadecimal digit", () => {
            for (let ch = 0; ch <= 9; ch++) {
                expect(esutils.code.isHexDigit((`${ch}`).charCodeAt(0))).to.be.true;
            }

            for (const code of __range__("a".charCodeAt(0), "f".charCodeAt(0), true)) {
                expect(esutils.code.isHexDigit(code)).to.be.true;
            }

            return __range__("A".charCodeAt(0), "F".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isHexDigit(code)).to.be.true);
        });

        return it("returns false if provided code is not hexadecimal digit", () => {
            for (const code of __range__("g".charCodeAt(0), "z".charCodeAt(0), true)) {
                expect(esutils.code.isHexDigit(code)).to.be.false;
            }

            return __range__("G".charCodeAt(0), "Z".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isHexDigit(code)).to.be.false);
        });
    });

    describe("isOctalDigit", () => {
        it("returns true if provided code is octal digit", () =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((ch) =>
                expect(esutils.code.isOctalDigit((`${ch}`).charCodeAt(0))).to.be.true)
        );

        return it("returns false if provided code is not octal digit", () => {
            for (let ch = 8; ch <= 9; ch++) {
                expect(esutils.code.isOctalDigit((String(ch)).charCodeAt(0))).to.be.false;
            }

            for (const code of __range__("a".charCodeAt(0), "z".charCodeAt(0), true)) {
                expect(esutils.code.isOctalDigit(code)).to.be.false;
            }

            return __range__("A".charCodeAt(0), "Z".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isOctalDigit(code)).to.be.false);
        });
    });

    describe("isWhiteSpace", () => {
        it("returns true if provided code is white space", () => {
            const codes = [
                0x0009,  // TAB
                0x000B,  // VT
                0x000C,  // FF
                0x0020,  // SP
                0x00A0,  // NBSP
                0xFEFF,  // BOM

                // Zs
                0x1680,
                0x2000,
                0x2001,
                0x2002,
                0x2003,
                0x2004,
                0x2005,
                0x2006,
                0x2007,
                0x2008,
                0x2009,
                0x200A,
                0x202F,
                0x205F,
                0x3000
            ];
            for (const code of codes) {
                expect(esutils.code.isWhiteSpace(code)).to.be.true;
            }

            return expect(esutils.code.isWhiteSpace(0x180E)).to.be.false;
        });

        return it("returns false if provided code is not white space", () => {
            for (let ch = 0; ch <= 9; ch++) {
                expect(esutils.code.isWhiteSpace((`${ch}`).charCodeAt(0))).to.be.false;
            }

            for (const code of __range__("a".charCodeAt(0), "z".charCodeAt(0), true)) {
                expect(esutils.code.isWhiteSpace(code)).to.be.false;
            }

            return __range__("A".charCodeAt(0), "Z".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isWhiteSpace(code)).to.be.false);
        });
    });

    describe("isLineTerminator", () => {
        it("returns true if provided code is line terminator", () => {
            const codes = [
                0x000A,
                0x000D,
                0x2028,
                0x2029
            ];
            return codes.map((code) =>
                expect(esutils.code.isLineTerminator(code)).to.be.true);
        });

        return it("returns false if provided code is not line terminator", () => {
            for (let ch = 0; ch <= 9; ch++) {
                expect(esutils.code.isLineTerminator((String(ch)).charCodeAt(0))).to.be.false;
            }

            for (const code of __range__("a".charCodeAt(0), "z".charCodeAt(0), true)) {
                expect(esutils.code.isLineTerminator(code)).to.be.false;
            }

            return __range__("A".charCodeAt(0), "Z".charCodeAt(0), true).map((code) =>
                expect(esutils.code.isLineTerminator(code)).to.be.false);
        });
    });

    describe("isIdentifierStartES5", () => {
        it("returns true if provided code can be a start of Identifier in ES5", () => {
            const characters = ["a", "_", "$", "ゆ"];
            return characters.map((ch) => ch.charCodeAt(0)).map((code) =>
                expect(esutils.code.isIdentifierStartES5(code)).to.be.true);
        });

        return it("returns false if provided code cannot be a start of Identifier in ES5", () =>
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ch) =>
                expect(esutils.code.isIdentifierStartES5((String(ch)).charCodeAt(0))).to.be.false)
        );
    });

    describe("isIdentifierPartES5", () => {
        it("returns true if provided code can be a part of Identifier in ES5", () => {
            const characters = ["a", "_", "$", "ゆ"];
            for (const code of characters.map((ch) => ch.charCodeAt(0))) {
                expect(esutils.code.isIdentifierPartES5(code)).to.be.true;
            }

            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ch) =>
                expect(esutils.code.isIdentifierPartES5((`${ch}`).charCodeAt(0))).to.be.true);
        });

        return it("returns false if provided code cannot be a part of Identifier in ES5", () => {
            expect(esutils.code.isIdentifierPartES5("+".charCodeAt(0))).to.be.false;
            return expect(esutils.code.isIdentifierPartES5("-".charCodeAt(0))).to.be.false;
        });
    });

    describe("isIdentifierStartES6", () => {
        it("returns true if provided code can be a start of Identifier in ES6", () => {
            const characters = ["a", "_", "$", "ゆ", "\u0AF9"];
            return characters.map((ch) => ch.charCodeAt(0)).map((code) =>
                expect(esutils.code.isIdentifierStartES6(code)).to.be.true);
        });

        return it("returns false if provided code cannot be a start of Identifier in ES6", () =>
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ch) =>
                expect(esutils.code.isIdentifierStartES6((`${ch}`).charCodeAt(0))).to.be.false)
        );
    });

    return describe("isIdentifierPartES6", () => {
        it("returns true if provided code can be a part of Identifier in ES6", () => {
            const characters = ["a", "_", "$", "ゆ"];
            for (const code of characters.map((ch) => ch.charCodeAt(0))) {
                expect(esutils.code.isIdentifierPartES6(code)).to.be.true;
            }

            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ch) =>
                expect(esutils.code.isIdentifierPartES6((String(ch)).charCodeAt(0))).to.be.true);
        });

        it("supports astral symbols", () => expect(esutils.code.isIdentifierPartES6(0xE01D5)).to.be.true);

        return it("returns false if provided code cannot be a part of Identifier in ES6", () => {
            expect(esutils.code.isIdentifierPartES6("+".charCodeAt(0))).to.be.false;
            return expect(esutils.code.isIdentifierPartES6("-".charCodeAt(0))).to.be.false;
        });
    });
});
