"use string";

const { objects, canonicalizeObject, convertChangesToXML } = adone.diff;

describe("diff/object", function () {
    describe("#objects", function () {
        it("should accept objects", function () {
            expect(objects({ a: 123, b: 456, c: 789 }, { a: 123, b: 456 })).to.eql([{ count: 3, value: "{\n  \"a\": 123,\n  \"b\": 456,\n" }, { count: 1, value: "  \"c\": 789\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
        });
        it("should accept objects with different order", function () {
            expect(objects({ a: 123, b: 456, c: 789 }, { b: 456, a: 123 })).to.eql([{ count: 3, value: "{\n  \"a\": 123,\n  \"b\": 456,\n" }, { count: 1, value: "  \"c\": 789\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
        });

        it("should accept objects with nested structures", function () {
            expect(objects({ a: 123, b: 456, c: [1, 2, { foo: "bar" }, 4] }, { a: 123, b: 456, c: [1, { foo: "bar" }, 4] })).to.eql([{ count: 5, value: "{\n  \"a\": 123,\n  \"b\": 456,\n  \"c\": [\n    1,\n" }, { count: 1, value: "    2,\n", added: undefined, removed: true }, { count: 6, value: "    {\n      \"foo\": \"bar\"\n    },\n    4\n  ]\n}" }]);
        });

        it("should accept dates", function () {
            expect(objects({ a: new Date(123), b: new Date(456), c: new Date(789) }, { a: new Date(124), b: new Date(456) })).to.eql([{ count: 1, value: "{\n" }, { count: 1, value: "  \"a\": \"1970-01-01T00:00:00.123Z\",\n", added: undefined, removed: true }, { count: 1, value: "  \"a\": \"1970-01-01T00:00:00.124Z\",\n", added: true, removed: undefined }, { count: 1, value: "  \"b\": \"1970-01-01T00:00:00.456Z\",\n" }, { count: 1, value: "  \"c\": \"1970-01-01T00:00:00.789Z\"\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
        });

        it("should accept undefined keys", function () {
            expect(objects({ a: 123, b: 456, c: null }, { a: 123, b: 456 })).to.eql([{ count: 3, value: "{\n  \"a\": 123,\n  \"b\": 456,\n" }, { count: 1, value: "  \"c\": null\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
            expect(objects({ a: 123, b: 456, c: undefined }, { a: 123, b: 456 })).to.eql([{ count: 4, value: "{\n  \"a\": 123,\n  \"b\": 456\n}" }]);
            expect(objects({ a: 123, b: 456, c: undefined }, { a: 123, b: 456 }, { undefinedReplacement: null })).to.eql([{ count: 3, value: "{\n  \"a\": 123,\n  \"b\": 456,\n" }, { count: 1, value: "  \"c\": null\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
        });

        it("should accept already stringified JSON", function () {
            expect(objects(JSON.stringify({ a: 123, b: 456, c: 789 }, undefined, "  "), JSON.stringify({ a: 123, b: 456 }, undefined, "  "))).to.eql([{ count: 3, value: "{\n  \"a\": 123,\n  \"b\": 456,\n" }, { count: 1, value: "  \"c\": 789\n", added: undefined, removed: true }, { count: 1, value: "}" }]);
        });

        it("should ignore trailing comma on the previous line when the property has been removed", function () {
            const diffResult = objects({ a: 123, b: 456, c: 789 }, { a: 123, b: 456 });
            expect(convertChangesToXML(diffResult)).to.equal("{\n  &quot;a&quot;: 123,\n  &quot;b&quot;: 456,\n<del>  &quot;c&quot;: 789\n</del>}");
        });

        it("should ignore the missing trailing comma on the last line when a property has been added after it", function () {
            const diffResult = objects({ a: 123, b: 456 }, { a: 123, b: 456, c: 789 });
            expect(convertChangesToXML(diffResult)).to.equal("{\n  &quot;a&quot;: 123,\n  &quot;b&quot;: 456,\n<ins>  &quot;c&quot;: 789\n</ins>}");
        });

        it("should throw an error if one of the objects being diffed has a circular reference", function () {
            const circular = { foo: 123 };
            circular.bar = circular;
            expect(function () {
                objects(circular, { foo: 123, bar: {} });
            }).to["throw"](/circular|cyclic/i);
        });
    });

    describe("#canonicalizeObject", function () {
        it("should put the keys in canonical order", function () {
            expect(getKeys(canonicalizeObject({ b: 456, a: 123 }))).to.eql(["a", "b"]);
        });

        it("should dive into nested objects", function () {
            const canonicalObj = canonicalizeObject({ b: 456, a: { d: 123, c: 456 } });
            expect(getKeys(canonicalObj.a)).to.eql(["c", "d"]);
        });

        it("should dive into nested arrays", function () {
            const canonicalObj = canonicalizeObject({ b: 456, a: [789, { d: 123, c: 456 }] });
            expect(getKeys(canonicalObj.a[1])).to.eql(["c", "d"]);
        });

        it("should handle circular references correctly", function () {
            const obj = { b: 456 };
            obj.a = obj;
            const canonicalObj = canonicalizeObject(obj);
            expect(getKeys(canonicalObj)).to.eql(["a", "b"]);
            expect(getKeys(canonicalObj.a)).to.eql(["a", "b"]);
        });
    });
});

function getKeys(obj) {
    const keys = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
}