import generateFixtures from "./generate_fixtures";

describe("fast", "transform", "angular", "fileSort", () => {
    const { std: { path, fs }, fast } = adone;
    const { File, transform: { angularFilesort } } = fast;

    const sort = (files, checkResults, handleError) => {
        const resultFiles = [];

        const stream = angularFilesort();

        stream.on("error", handleError);

        stream.on("data", (file) => {
            resultFiles.push(file.relative);
        });

        stream.on("end", () => {
            checkResults(resultFiles);
        });

        stream.resume();
        files.forEach((file) => {
            stream.write(file);
        });
        stream.end();
    };

    let root;

    before(async () => {
        root = await adone.fs.Directory.createTmp();
        await generateFixtures(root);
    });

    after(async () => {
        await root.unlink();
    });

    const fixture = (file, config) => {
        const filepath = path.join(root.path(), file);
        return new File({
            path: filepath,
            cwd: root.path(),
            base: root.path(),
            contents: config && config.withoutContents ? undefined : fs.readFileSync(filepath)
        });
    };


    it("should sort file with a module definition before files that uses it", (done) => {
        const files = [
            fixture("another-factory.js"),
            fixture("another.js"),
            fixture("module-controller.js"),
            fixture("no-deps.js"),
            fixture("module.js"),
            fixture("dep-on-non-declared.js"),
            fixture("yet-another.js")
        ];

        sort(files, (resultFiles) => {
            expect(resultFiles.length).to.be.equal(7);
            expect(resultFiles.indexOf("module-controller.js")).to.be.above(resultFiles.indexOf("module.js"));
            expect(resultFiles.indexOf("yet-another.js")).to.be.above(resultFiles.indexOf("another.js"));
            expect(resultFiles.indexOf("another-factory.js")).to.be.above(resultFiles.indexOf("another.js"));
            done();
        }, done);
    });

    it("should sort files alphabetically when no ordering is required", (done) => {
        const files = [
            fixture("module.js"),
            fixture("circular3.js"),
            fixture("module-controller.js"),
            fixture("circular.js"),
            fixture("circular2.js")
        ];

        sort(files, (resultFiles) => {
            expect(resultFiles.length).to.be.equal(5);
            expect(resultFiles.indexOf("module-controller.js")).to.be.above(resultFiles.indexOf("module.js"));
            expect(resultFiles.indexOf("module.js")).to.be.above(resultFiles.indexOf("circular.js"));
            expect(resultFiles.indexOf("circular3.js")).to.be.above(resultFiles.indexOf("circular2.js"));
            expect(resultFiles.indexOf("circular3.js")).to.be.above(resultFiles.indexOf("circular.js"));
            done();
        }, done);
    });

    it("should not crash when a module is both declared and used in the same file (Issue #5)", (done) => {
        const files = [
            fixture("circular.js")
        ];

        sort(files, (resultFiles) => {
            expect(resultFiles.length).to.be.equal(1);
            expect(resultFiles[0]).to.be.equal("circular.js");
            done();
        }, done);
    });

    it("should not crash when a module is used inside a declaration even though it's before that module's declaration (Issue #7)", (done) => {
        const files = [
            fixture("circular2.js"),
            fixture("circular3.js")
        ];

        sort(files, (resultFiles) => {
            expect(resultFiles.length).to.be.equal(2);
            expect(resultFiles).to.contain("circular2.js");
            expect(resultFiles).to.contain("circular3.js");
            done();
        }, done);
    });

    it("fails for not read file", (done) => {
        const files = [
            fixture("fake.js", { withoutContents: true })
        ];

        sort(files, () => {
        }, (err) => {
            expect(err).to.be.ok;
            done();
        }, done);
    });

    it("does not fail for empty file", (done) => {
        const files = [
            fixture("empty.js")
        ];

        sort(files, (resultFiles) => {
            expect(resultFiles).to.be.deep.equal(["empty.js"]);
            done();
        }, done);
    });

    describe("integration", () => {
        it("should sort files alphabetically when no ordering is required", async () => {
            const files = await fast.src(root.getVirtualFile("{module,circular3,module-controller,circular,circular2}.js").path())
                .angularFilesort();
            expect(files).to.have.lengthOf(5);
            const resultFiles = files.map((x) => x.basename);
            expect(resultFiles.indexOf("module-controller.js")).to.be.above(resultFiles.indexOf("module.js"));
            expect(resultFiles.indexOf("module.js")).to.be.above(resultFiles.indexOf("circular.js"));
            expect(resultFiles.indexOf("circular3.js")).to.be.above(resultFiles.indexOf("circular2.js"));
            expect(resultFiles.indexOf("circular3.js")).to.be.above(resultFiles.indexOf("circular.js"));
        });
    });
});
