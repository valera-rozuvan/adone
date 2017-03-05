const { fast } = adone;
const { File } = fast;

const fixture = "Hello old world!\nHello new world!\nHello kind world!\nHello cruel world!";

const expected = {
    "helloperson": "Hello old person!\nHello new person!\nHello kind person!\nHello cruel person!",
    "hellofarm": "Hello old cow!\nHello new chicken!\nHello kind duck!\nHello cruel person!",
    "multreplace": "Hello dlo cow!\nHello new chicken!\nHello kind duck!\nHello cruel person!",
    "multreplace2": "Hello dlo person!\nHello new person!\nHello kind person!\nHello cruel person!"
};

describe("Fast", function () {
    describe("transforms", function () {
        describe("replace", function () {
            let replacements;
            let file;
            let check;

            beforeEach(function () {
                replacements = [
                    "cow",
                    "chicken",
                    "duck",
                    "person"
                ];

                file = new File({
                    path: "test/fixtures/helloworld.txt",
                    contents: new Buffer(fixture)
                });

                check = function (stream, done, cb) {
                    stream.on("data", function (newFile) {
                        cb(newFile);
                        done();
                    });

                    stream.write(file);
                    stream.resume();
                    stream.end();
                };
            });

            describe("buffered input", function () {

                it("should replace string on a buffer", function(done) {
                    const stream = fast.plugin.replace("world", "person");

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["helloperson"]);
                    });
                });

                it("should replace regex on a buffer", function(done) {
                    const stream = fast.plugin.replace(/world/g, "person");

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["helloperson"]);
                    });
                });

                it("should replace regex on a buffer with a function", function(done) {
                    const stream = fast.plugin.replace(/world/g, () => "person");

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["helloperson"]);
                    });
                });

                it("should replace string on a buffer with a function", function(done) {
                    const stream = fast.plugin.replace("world", () => "person");

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["helloperson"]);
                    });
                });

                it("should call function once for each replacement when replacing a string on a buffer", function(done) {
                    const stream = fast.plugin.replace("world", () => replacements.shift());
                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["hellofarm"]);
                    });
                });

                it("should call function once for each replacement when replacing a regex on a buffer", function(done) {
                    const stream = fast.plugin.replace(/world/g, () => replacements.shift());

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["hellofarm"]);
                    });
                });

                it("should trigger events on a buffer", function(done) {
                    const stream = fast.plugin.replace("world", "elephant");
                    stream.on("end", function() {
                        // No assertion required, we should end up here, if we don"t the test will time out
                        done();
                    });

                    stream.write(file);
                    stream.resume();
                    stream.end();
                });

                it("should replace in multiple files", (done) => {
                    const file1 = new File({
                        contents: Buffer.from("Hello, World!")
                    });
                    const file2 = new File({
                        contents: Buffer.from("Hello, Yell!")
                    });
                    const stream = fast.plugin.replace({
                        World: "Person",
                        Yell: "Person"
                    });
                    stream.on("data", (file) => {
                        assert.equal(file.contents.toString(), "Hello, Person!");
                        done();
                    });
                    stream.write(file1);
                    stream.write(file2);
                    stream.resume().end();
                });
            });

            describe("streamed input", function () {
                it("should throw an error", function() {
                    const file = new File({
                        path: "test/fixtures/helloworld.txt",
                        contents: new adone.std.stream.Stream.Readable
                    });

                    const stream = fast.plugin.replace("world", "person");

                    try {
                        stream.write(file);
                    } catch (e) {
                        assert.instanceOf(e, adone.x.NotSupported);
                        return;
                    }
                    throw new Error("Didn't throw any error!");
                });
            });

            describe("multiple replacements", function () {
                it("should throw an error if first argument is array, but second aren't", function() {
                    try {
                        fast.plugin.replace(["world"], "person");
                    } catch (e) {
                        assert.instanceOf(e, adone.x.InvalidArgument);
                        return;
                    }
                    throw new Error("Didn't throw any error!");
                });

                it("should throw an error if lengths didn't match", function() {
                    try {
                        fast.plugin.replace(["world"], ["person", "world"]);
                    } catch (e) {
                        assert.instanceOf(e, adone.x.InvalidArgument);
                        return;
                    }
                    throw new Error("Didn't throw any error!");
                });

                it("should replace by arrays", function(done) {
                    const stream = fast.plugin.replace(["old", /world/g], ["dlo", () => replacements.shift()]);

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["multreplace"]);
                    });
                });

                it("should replace by objects", function(done) {
                    const stream = fast.plugin.replace({
                        "old": "dlo",
                        world: "person"
                    });

                    check(stream, done, function (newFile) {
                        assert.equal(String(newFile.contents), expected["multreplace2"]);
                    });
                });

                it("should properly replace cases with prefixes", (done) => {
                    const file = new File({
                        contents: Buffer.from("$$ $$a $$b")
                    });
                    const stream = fast.plugin.replace({
                        $$: "hello",
                        $$a: "world",
                        $$b: "!"
                    });
                    stream.on("data", (file) => {
                        assert.equal(file.contents.toString(), "hello world !");
                        done();
                    });
                    stream.write(file);
                    stream.resume().end();
                });

                it("should properly replace cases with suffixes", (done) => {
                    const file = new File({
                        contents: Buffer.from("$$ a$$ b$$")
                    });
                    const stream = fast.plugin.replace({
                        $$: "hello",
                        a$$: "world",
                        b$$: "!"
                    });
                    stream.on("data", (file) => {
                        assert.equal(file.contents.toString(), "hello world !");
                        done();
                    });
                    stream.write(file);
                    stream.resume().end();
                });
            });
        });
    });
});
