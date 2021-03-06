describe("net", "mime", () => {
    const { mime } = adone.net;

    describe(".charset(type)", () => {
        it('should return "UTF-8" for "application/json"', () => {
            assert.equal(mime.charset("application/json"), "UTF-8");
        });

        it('should return "UTF-8" for "application/json; foo=bar"', () => {
            assert.equal(mime.charset("application/json; foo=bar"), "UTF-8");
        });

        it('should return "UTF-8" for "application/javascript"', () => {
            assert.equal(mime.charset("application/javascript"), "UTF-8");
        });

        it('should return "UTF-8" for "application/JavaScript"', () => {
            assert.equal(mime.charset("application/JavaScript"), "UTF-8");
        });

        it('should return "UTF-8" for "text/html"', () => {
            assert.equal(mime.charset("text/html"), "UTF-8");
        });

        it('should return "UTF-8" for "TEXT/HTML"', () => {
            assert.equal(mime.charset("TEXT/HTML"), "UTF-8");
        });

        it('should return "UTF-8" for any text/*', () => {
            assert.equal(mime.charset("text/x-bogus"), "UTF-8");
        });

        it("should return false for unknown types", () => {
            assert.strictEqual(mime.charset("application/x-bogus"), false);
        });

        it("should return false for any application/octet-stream", () => {
            assert.strictEqual(mime.charset("application/octet-stream"), false);
        });

        it("should return false for invalid arguments", () => {
            assert.strictEqual(mime.charset({}), false);
            assert.strictEqual(mime.charset(null), false);
            assert.strictEqual(mime.charset(true), false);
            assert.strictEqual(mime.charset(42), false);
        });
    });

    describe(".contentType(extension)", () => {
        it('should return content-type for "html"', () => {
            assert.equal(mime.contentType("html"), "text/html; charset=utf-8");
        });

        it('should return content-type for ".html"', () => {
            assert.equal(mime.contentType(".html"), "text/html; charset=utf-8");
        });

        it('should return content-type for "jade"', () => {
            assert.equal(mime.contentType("jade"), "text/jade; charset=utf-8");
        });

        it('should return content-type for "json"', () => {
            assert.equal(mime.contentType("json"), "application/json; charset=utf-8");
        });

        it("should return false for unknown extensions", () => {
            assert.strictEqual(mime.contentType("bogus"), false);
        });

        it("should return false for invalid arguments", () => {
            assert.strictEqual(mime.contentType({}), false);
            assert.strictEqual(mime.contentType(null), false);
            assert.strictEqual(mime.contentType(true), false);
            assert.strictEqual(mime.contentType(42), false);
        });
    });

    describe(".contentType(type)", () => {
        it('should attach charset to "application/json"', () => {
            assert.equal(mime.contentType("application/json"), "application/json; charset=utf-8");
        });

        it('should attach charset to "application/json; foo=bar"', () => {
            assert.equal(mime.contentType("application/json; foo=bar"), "application/json; foo=bar; charset=utf-8");
        });

        it('should attach charset to "TEXT/HTML"', () => {
            assert.equal(mime.contentType("TEXT/HTML"), "TEXT/HTML; charset=utf-8");
        });

        it('should attach charset to "text/html"', () => {
            assert.equal(mime.contentType("text/html"), "text/html; charset=utf-8");
        });

        it('should not alter "text/html; charset=iso-8859-1"', () => {
            assert.equal(mime.contentType("text/html; charset=iso-8859-1"), "text/html; charset=iso-8859-1");
        });

        it("should return type for unknown types", () => {
            assert.equal(mime.contentType("application/x-bogus"), "application/x-bogus");
        });
    });

    describe(".extension(type)", () => {
        it("should return extension for mime type", () => {
            assert.equal(mime.extension("text/html"), "html");
            assert.equal(mime.extension(" text/html"), "html");
            assert.equal(mime.extension("text/html "), "html");
        });

        it("should return false for unknown type", () => {
            assert.strictEqual(mime.extension("application/x-bogus"), false);
        });

        it("should return false for non-type string", () => {
            assert.strictEqual(mime.extension("bogus"), false);
        });

        it("should return false for non-strings", () => {
            assert.strictEqual(mime.extension(null), false);
            assert.strictEqual(mime.extension(undefined), false);
            assert.strictEqual(mime.extension(42), false);
            assert.strictEqual(mime.extension({}), false);
        });

        it("should return extension for mime type with parameters", () => {
            assert.equal(mime.extension("text/html;charset=UTF-8"), "html");
            assert.equal(mime.extension("text/HTML; charset=UTF-8"), "html");
            assert.equal(mime.extension("text/html; charset=UTF-8"), "html");
            assert.equal(mime.extension("text/html; charset=UTF-8 "), "html");
            assert.equal(mime.extension("text/html ; charset=UTF-8"), "html");
        });
    });

    describe(".lookup(extension)", () => {
        it('should return mime type for ".html"', () => {
            assert.equal(mime.lookup(".html"), "text/html");
        });

        it('should return mime type for ".js"', () => {
            assert.equal(mime.lookup(".js"), "application/javascript");
        });

        it('should return mime type for ".json"', () => {
            assert.equal(mime.lookup(".json"), "application/json");
        });

        it('should return mime type for ".rtf"', () => {
            assert.equal(mime.lookup(".rtf"), "application/rtf");
        });

        it('should return mime type for ".txt"', () => {
            assert.equal(mime.lookup(".txt"), "text/plain");
        });

        it('should return mime type for ".xml"', () => {
            assert.equal(mime.lookup(".xml"), "application/xml");
        });

        it("should work without the leading dot", () => {
            assert.equal(mime.lookup("html"), "text/html");
            assert.equal(mime.lookup("xml"), "application/xml");
        });

        it("should be case insensitive", () => {
            assert.equal(mime.lookup("HTML"), "text/html");
            assert.equal(mime.lookup(".Xml"), "application/xml");
        });

        it("should return false for unknown extension", () => {
            assert.strictEqual(mime.lookup(".bogus"), false);
            assert.strictEqual(mime.lookup("bogus"), false);
        });

        it("should return false for non-strings", () => {
            assert.strictEqual(mime.lookup(null), false);
            assert.strictEqual(mime.lookup(undefined), false);
            assert.strictEqual(mime.lookup(42), false);
            assert.strictEqual(mime.lookup({}), false);
        });
    });

    describe(".lookup(path)", () => {
        it("should return mime type for file name", () => {
            assert.equal(mime.lookup("page.html"), "text/html");
        });

        it("should return mime type for relative path", () => {
            assert.equal(mime.lookup("path/to/page.html"), "text/html");
            assert.equal(mime.lookup("path\\to\\page.html"), "text/html");
        });

        it("should return mime type for absolute path", () => {
            assert.equal(mime.lookup("/path/to/page.html"), "text/html");
            assert.equal(mime.lookup("C:\\path\\to\\page.html"), "text/html");
        });

        it("should be case insensitive", () => {
            assert.equal(mime.lookup("/path/to/PAGE.HTML"), "text/html");
            assert.equal(mime.lookup("C:\\path\\to\\PAGE.HTML"), "text/html");
        });

        it("should return false for unknown extension", () => {
            assert.strictEqual(mime.lookup("/path/to/file.bogus"), false);
        });

        it("should return false for path without extension", () => {
            assert.strictEqual(mime.lookup("/path/to/json"), false);
        });

        describe("path with dotfile", () => {
            it("should return false when extension-less", () => {
                assert.strictEqual(mime.lookup("/path/to/.json"), false);
            });

            it("should return mime type when there is extension", () => {
                assert.strictEqual(mime.lookup("/path/to/.config.json"), "application/json");
            });

            it("should return mime type when there is extension, but no path", () => {
                assert.strictEqual(mime.lookup(".config.json"), "application/json");
            });
        });
    });
});
