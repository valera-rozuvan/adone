import adone from "adone";
import EventEmitter from "events";
import assert from "assert";
import * as path from "path";

const { shani: { Engine } } = adone;

// a minimal engine

const blocks = [];  // top-level blocks
const stack = [];  // describe's stack

function describe(name, callback) {
    const block = { name, tests: [], nested: [] };

    if (!stack.length) {
        blocks.push(block);
    } else {
        stack[stack.length - 1].nested.push(block);
    }
    stack.push(block);
    callback();
    stack.pop();
}

function it(description, callback) {
    stack[stack.length - 1].tests.push({ description, callback });
}

function run() {
    const emitter = new EventEmitter();

    async function runner(block, level = 0) {
        emitter.emit("header", { name: block.name, level });
        for (const test of block.tests) {
            try {
                await test.callback();
            } catch (err) {
                emitter.emit("result", {
                    description: test.description,
                    ok: false,
                    err,
                    level
                });
                continue;
            }
            emitter.emit("result", {
                description: test.description,
                ok: true,
                level
            });
        }
        for (const nested of block.nested) {
            await runner(nested, level + 1);
        }
    }

    process.nextTick(() => {
        emitter.emit("start");
        runner(blocks.shift()).then(() => emitter.emit("end")).catch((err) => console.error(err));
    });

    return emitter;
}

// tests

const nop = adone.noop;

const waitFor = (emitter, event) => new Promise((resolve) => emitter.once(event, resolve));

describe("Engine", () => {
    it("should execute tests", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        const calls = [];
        describe("/", () => {
            it("test1", () => {
                calls.push(1);
            });

            it("test2", () => {
                calls.push(2);
            });
        });

        await waitFor(start(), "done");

        assert.deepEqual(calls, [1, 2]);
    });

    it("should execute tests in the right order", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        const calls = [];
        describe("/", () => {
            it("test1", () => {
                calls.push(1);
            });

            it("test2", () => {
                calls.push(2);
            });
        });

        await waitFor(start(), "done");

        assert.deepEqual(calls, [1, 2]);
    });

    it("should work with async functions", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        const calls = [];
        describe("/", () => {
            it("test1", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                calls.push(1);
            });

            it("test2", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                calls.push(2);
            });
        });

        await waitFor(start(), "done");

        assert.deepEqual(calls, [1, 2]);
    });

    it("should work with 'done' callback", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        const calls = [];
        describe("/", () => {
            it("test1", (done) => {
                setTimeout(done, 100);
                calls.push(1);
            });

            it("test2", (done) => {
                setTimeout(done, 100);
                calls.push(2);
            });
        });

        await waitFor(start(), "done");

        assert.deepEqual(calls, [1, 2]);
    });

    it("should emit events for blocks", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        describe("/", () => {
            it("test1", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            describe("nested", () => {
                it("test2", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                });
            });

        });

        const results = [];

        const e = start();

        e.on("enter block", ({ block }) => {
            results.push(["enter", block.name]);
        });

        e.on("exit block", ({ block }) => {
            results.push(["exit", block.name]);
        });

        await waitFor(e, "done");

        assert.equal(results.length, 4);
        assert.deepEqual(results, [
            ["enter", "/"],
            ["enter", "nested"],
            ["exit", "nested"],
            ["exit", "/"]
        ]);
    });

    it("should emit events for tests", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        describe("/", () => {
            it("test1", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            it("test2", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });
        });

        const results = [];

        const e = start();

        e.on("start test", ({ block, test }) => {
            results.push(["start", block.name, test.description]);
        });

        e.on("end test", ({ block, test, meta }) => {
            results.push(["end", block.name, test.description, meta.err, typeof meta.elapsed === "number"]);
        });

        await waitFor(e, "done");

        assert.equal(results.length, 4);
        assert.deepEqual(results, [
            ["start", "/", "test1"],
            ["end", "/", "test1", null, true],
            ["start", "/", "test2"],
            ["end", "/", "test2", null, true]
        ]);
    });

    it("should set the err property if a test fails", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        describe("/", () => {
            it("test1", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            it("test2", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            it("test3", async () => {
                throw new Error("123");
            });
        });

        const results = [];
        const e = start();

        e.on("end test", ({ test, meta }) => {
            results.push([test.description, meta.err && meta.err.message]);
        });

        await waitFor(e, "done");

        assert.equal(results.length, 3);
        assert.deepEqual(results, [["test1", null], ["test2", null], ["test3", "123"]]);
    });

    it("should set the elapsed proeprty", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        describe("/", () => {
            it("test1", async () => {
                await new Promise((resolve) => setTimeout(resolve, 123));
            });

            it("test2", async () => {
                await new Promise((resolve) => setTimeout(resolve, 456));
            });

            it("test3", async () => {
                throw new Error("123");
            });
        });

        const results = [];
        const e = start();

        e.on("end test", ({ meta }) => {
            results.push(meta.elapsed);
        });

        await waitFor(e, "done");

        assert.equal(results.length, 3);

        assert.ok(results[0] > 113 && results[0] < 133);
        assert.ok(results[1] > 446 && results[1] < 466);
        assert.ok(results[2] < 10);
    });

    // it("should emit a special event for skipped tests", async function () {
    //     const engine = new Engine();
    //     const { describe, it, start } = engine.context();

    //     describe("/", () => {
    //         it.skip("test1", async function () {
    //             await new Promise((resolve) => setTimeout(resolve, 123));
    //         });

    //         it("test2", async function () {
    //             await new Promise((resolve) => setTimeout(resolve, 456));
    //         });

    //         it.skip("test3", async function () {
    //             throw new Error("123");
    //         });
    //     });

    //     const results = [];
    //     const e = run();

    //     e.on("skip", ({ test }) => {
    //         results.push(test.description);
    //     });

    //     await waitFor(e, "done");

    //     assert.equal(results.length, 1);
    //     assert.deepEqual(results, ["test3"]);
    // });

    describe("nested", () => {
        it("should work with nested describes", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];
            describe("/", () => {
                it("test1", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    calls.push(1);
                });

                it("test2", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    calls.push(2);
                });

                describe("nested", () => {
                    it("test3", () => {
                        calls.push(3);
                    });

                    it("test4", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push(4);
                    });
                });
            });

            await waitFor(start(), "done");
            assert.deepEqual(calls, [1, 2, 3, 4]);
        });

        it("should execute nested blocks and the current level tests in the right order", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];
            describe("/", () => {
                it("test1", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    calls.push("1");
                });

                describe("nested", () => {
                    it("test3", () => {
                        calls.push("3");
                    });

                    it("test4", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push("4");
                    });
                });

                it("test2", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    calls.push("2");
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["1", "3", "4", "2"]);
        });

        it("should execute nested blocks in the right order", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];
            describe("/", () => {
                describe("nested#1", () => {
                    it("1", () => calls.push("1"));
                });

                describe("nested#2", () => {
                    it("2", () => calls.push("2"));
                });

                describe("nested#2", () => {
                    it("3", () => calls.push("3"));

                    describe("nested#3", () => {
                        it("4", () => calls.push("4"));
                    });
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["1", "2", "3", "4"]);
        });
    });

    describe("inclusive", () => {
        it("should execute only one test", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));
                it.only("test2", () => calls.push("test2"));
                it("test3", () => calls.push("test3"));
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test2"]);
        });

        it("should execute only the deepest describe", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));
                it("test2", () => calls.push("test2"));

                describe("nested#1", () => {
                    it("test3", () => calls.push("test3"));

                    describe.only("nested#2", () => {
                        it("test4", () => calls.push("test4"));
                    });
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test4"]);
        });

        it("should work with many top-level describes", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/1", () => {
                it("test1", () => calls.push("test1"));
            });

            describe.only("/2", () => {
                it("test2", () => calls.push("test2"));
            });

            describe("/3", () => {
                it("test3", () => calls.push("test3"));
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test2"]);
        });

        it("should not execute all the tests if the parent is marked and some nested children too", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/1", () => {
                describe.only("/2", () => {
                    it("test1", () => calls.push("test1"));
                    describe("/3", () => {
                        it("test2", () => calls.push("test2"));
                        it.only("test3", () => calls.push("test3"));
                    });
                });
            });
            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test3"]);
        });

        it("should correcly execute tests when .only on different levels", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/1", () => {
                describe("/1.5", () => {
                    describe("", () => {
                        it.only("hello", () => calls.push("hello"));
                    });
                });

                describe("/2", () => {
                    it("test1", () => calls.push("test1"));
                    describe("/3", () => {
                        it("test2", () => calls.push("test2"));
                        it.only("test3", () => calls.push("test3"));
                    });
                });
            });
            await waitFor(start(), "done");

            assert.deepEqual(calls, ["hello", "test3"]);
        });
    });

    describe("exclusive", () => {
        it("should skip tests", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));
                it.skip("test2", () => calls.push("test2"));
                it("test3", () => calls.push("test3"));
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test1", "test3"]);
        });

        it("should skip blocks", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));

                describe.skip("nested#1", () => {
                    it("test2", () => calls.push("test2"));
                    describe("nested#2", () => {
                        it("test3", () => calls.push("test3"));
                    });
                });

                describe("nested#3", () => {
                    it("test4", () => calls.push("test4"));
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["test1", "test4"]);
        });

        it("should skip tests in runtime", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));
                it("test2", function () {
                    calls.push("test2");
                    this.skip();
                });
                it("test3", () => calls.push("test3"));
            });
            const res = [];
            const e = start();

            e.on("skip test", ({ test, runtime }) => {
                res.push([test.description, runtime]);
            });

            await waitFor(e, "done");
            assert.deepEqual(calls, ["test1", "test2", "test3"]);
            assert.deepEqual(res, [["test2", true]]);
        });

        it("the runner must not consider inclusive tests if the parent is skipped", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", () => calls.push("test1"));

                describe.skip("nested#1", () => {
                    it.only("test2", () => calls.push("test2"));
                    describe("nested#2", () => {
                        it("test3", () => calls.push("test3"));
                    });
                    it("test5", () => calls.push("test5"));

                    describe.only("nested#1#1", () => {
                        it("test6", () => calls.push("test6"));
                    });
                });

                describe.skip("a new one", () => {
                    describe.only("a nested one", () => {
                        it("test7", () => calls.push("test7"));
                        it("test8", () => calls.push("test7"));
                    });
                });

                describe("nested#3", () => {
                    it("test4", () => calls.push("test4"));
                });
            });
            const skipped = [];

            const e = start();

            e.on("skip test", ({ test }) => {
                skipped.push(test.description);
            });

            await waitFor(e, "done");

            assert.deepEqual(calls, ["test1", "test4"]);
            assert.deepEqual(skipped, ["test2", "test3", "test5", "test6", "test7", "test8"]);
        });
    });

    describe("hooks", () => {
        describe("before", () => {
            it("should be invoked only once in the beginning", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(() => {
                        calls.push("before");
                    });

                    it("test1", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push("1");
                    });

                    it("test2", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push("2");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1", "2"]);
            });

            it("should invoke the hook only once even if there are nested blocks", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(() => {
                        calls.push("before");
                    });

                    it("test1", async () => {
                        calls.push("1");
                    });

                    it("test2", async () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        it("test3", () => {
                            calls.push("3");
                        });

                        it("test4", () => {
                            calls.push("4");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1", "2", "3", "4"]);
            });

            it("should invoke nested hooks", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(() => {
                        calls.push("before");
                    });

                    it("test1", async () => {
                        calls.push("1");
                    });

                    it("test2", async () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        before(() => {
                            calls.push("before#1");
                        });
                        it("test3", () => {
                            calls.push("3");
                        });

                        it("test4", () => {
                            calls.push("4");
                        });
                    });

                    describe("nested#2", () => {
                        before(() => {
                            calls.push("before#2");
                        });

                        it("test5", () => {
                            calls.push("5");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1", "2", "before#1", "3", "4", "before#2", "5"]);
            });

            it("should not invoke the hook if there are not tests", async () => {
                const engine = new Engine();
                const { describe, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(() => {
                        calls.push("before");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should invoke the hook if a nested describe has a test but the current level has not", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(() => {
                        calls.push("before");
                    });

                    describe("nested", () => {
                        it("test1", () => calls.push("1"));
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1"]);
            });

            it("should work with async functions", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                describe("/", () => {
                    before(async () => {
                        calls.push("before");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1"]);
            });

            it("top-level hook", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];
                before(() => {
                    calls.push("top");
                });
                describe("/", () => {
                    before(async () => {
                        calls.push("before");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["top", "before", "1"]);
            });

            it("should not invoke in case of skip", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const calls = [];

                describe.skip("/", () => {
                    before(async () => {
                        calls.push("before");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should emit event for before hook", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const results = [];

                describe("/", () => {
                    before("before", adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });
                });

                const e = start();

                e.on("start before hook", ({ block, hook }) => {
                    results.push(["start", block.name, hook.description]);
                });

                e.on("end before hook", ({ block, hook }) => {
                    results.push(["end", block.name, hook.description]);
                });

                await waitFor(e, "done");
                assert.deepEqual([["start", "/", "before"], ["end", "/", "before"], "1"], results);
            });

            it("should set the error property and stop executing", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const results = [];

                describe("/", () => {
                    before(() => {
                        throw new Error("123");
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["123"]);
            });

            it("should set the elapsed property", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const results = [];

                describe("/", () => {
                    before(() => {
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before hook", ({ meta }) => {
                    results.push(typeof meta.elapsed);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["number", "1", "2"]);
            });

            it("should throw a timeout error", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const results = [];

                describe("/", () => {
                    before(function (done) {
                        this.timeout(240);
                        setTimeout(done, 500);
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["Timeout of 240ms exceeded"], results);
            });

            it("should throw a timeout error (sync)", async () => {
                const engine = new Engine();
                const { describe, it, start, before } = engine.context();

                const results = [];

                describe("/", () => {
                    before(function () {
                        this.timeout(240);
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["Timeout of 240ms exceeded"], results);
            });

            it("should trigger even if doesnt resolve", async () => {
                const engine = new Engine();
                const { describe, it, start, before, after } = engine.context();

                const results = [];

                describe("/", () => {
                    let timer = null;

                    before(function (done) {
                        this.timeout(240);
                        timer = setTimeout(done, 1010100);
                    });

                    after(() => {
                        clearTimeout(timer);
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["Timeout of 240ms exceeded"], results);
            });

            for (const val of [0, null, false, Infinity]) {
                it(`should set value to ${val}`, async () => {
                    const engine = new Engine();
                    const { describe, it, start, before, after } = engine.context();

                    const results = [];

                    describe("/", () => {
                        let timer = null;

                        before(function (done) {
                            this.timeout(val);
                            timer = setTimeout(done, 500);
                        });

                        after(() => {
                            clearTimeout(timer);
                        });

                        it("test1", () => {
                            results.push("1");
                        });

                        describe("nested", () => {
                            it("test2", () => {
                                results.push("2");
                            });
                        });
                    });

                    const e = start();

                    e.on("end before hook", ({ meta }) => {
                        results.push(meta.err && meta.err.message);
                    });

                    await waitFor(e, "done");
                    assert.deepEqual([null, "1", "2"], results);
                });
            }
        });

        describe("after", () => {
            it("should be invoked only once in the end", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(() => {
                        calls.push("after");
                    });

                    it("test1", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push("1");
                    });

                    it("test2", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        calls.push("2");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "2", "after"]);
            });

            it("should invoke the hook only once even if there are nested blocks", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(() => {
                        calls.push("after");
                    });

                    it("test1", async () => {
                        calls.push("1");
                    });

                    it("test2", async () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        it("test3", () => {
                            calls.push("3");
                        });

                        it("test4", () => {
                            calls.push("4");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "2", "3", "4", "after"]);
            });

            it("should invoke nested hooks", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(() => {
                        calls.push("after");
                    });

                    it("test1", async () => {
                        calls.push("1");
                    });

                    it("test2", async () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        after(() => {
                            calls.push("after#1");
                        });
                        it("test3", () => {
                            calls.push("3");
                        });

                        it("test4", () => {
                            calls.push("4");
                        });
                    });

                    describe("nested#2", () => {
                        after(() => {
                            calls.push("after#2");
                        });

                        it("test4", () => {
                            calls.push("5");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "2", "3", "4", "after#1", "5", "after#2", "after"]);
            });

            it("should not invoke the hook if there are not tests", async () => {
                const engine = new Engine();
                const { describe, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(() => {
                        calls.push("after");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should invoke the hook if a nested describe has a test but the current level has not", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(() => {
                        calls.push("after");
                    });

                    describe("nested", () => {
                        it("test", () => calls.push("1"));
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after"]);
            });

            it("should work with async functions", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                describe("/", () => {
                    after(async () => {
                        calls.push("after");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after"]);
            });

            it("top-level hook", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];
                after(() => {
                    calls.push("top");
                });
                describe("/", () => {
                    after(async () => {
                        calls.push("after");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after", "top"]);
            });

            it("should not invoke in case of skip", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const calls = [];

                describe.skip("/", () => {
                    after(async () => {
                        calls.push("after");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should emit event for after hook", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const results = [];

                describe("/", () => {
                    after("after", adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });
                });

                const e = start();

                e.on("start after hook", ({ block, hook }) => {
                    results.push(["start", block.name, hook.description]);
                });

                e.on("end after hook", ({ block, hook }) => {
                    results.push(["end", block.name, hook.description]);
                });

                await waitFor(e, "done");
                assert.deepEqual(["1", ["start", "/", "after"], ["end", "/", "after"]], results);
            });

            it("should set the error property and stop executing", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const results = [];

                describe("/", () => {
                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });

                        after(() => {
                            throw new Error("123");
                        });
                    });

                    it("test3", () => {
                        results.push("3");
                    });
                });

                const e = start();

                e.on("end after hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["1", "2", "123"]);
            });

            it("should set the elapsed property", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const results = [];

                describe("/", () => {
                    after(() => {
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after hook", ({ meta }) => {
                    results.push(typeof meta.elapsed);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["1", "2", "number"]);
            });

            it("should throw a timeout error", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const results = [];

                describe("/", () => {
                    after(function (done) {
                        this.timeout(240);
                        setTimeout(done, 500);
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["1", "2", "Timeout of 240ms exceeded"], results);
            });

            it("should throw a timeout error (sync)", async () => {
                const engine = new Engine();
                const { describe, it, start, after } = engine.context();

                const results = [];

                describe("/", () => {
                    after(function () {
                        this.timeout(240);
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["1", "2", "Timeout of 240ms exceeded"], results);
            });
        });

        describe("beforeEach", () => {
            it("should work with tests", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    beforeEach(() => {
                        calls.push("before");
                    });

                    it("1", () => {
                        calls.push("1");
                    });

                    it("2", () => {
                        calls.push("2");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1", "before", "2"]);
            });

            it("should work with nested blocks", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    beforeEach(() => {
                        calls.push("before");
                    });

                    it("1", () => {
                        calls.push("1");
                    });

                    it("2", () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        it("3", () => {
                            calls.push("3");
                        });

                        describe("nested#1#2", () => {
                            it("5", () => {
                                calls.push("5");
                            });
                        });
                    });

                    describe("nested#2", () => {
                        it("4", () => {
                            calls.push("4");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, [
                    "before", "1",
                    "before", "2",
                    "before", "3",
                    "before", "5",
                    "before", "4"
                ]);
            });

            it("should work with async functions", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    beforeEach(async () => {
                        calls.push("before");
                    });

                    it("1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["before", "1"]);
            });

            it("top-level hook", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const calls = [];
                beforeEach(() => {
                    calls.push("top");
                });
                describe("/", () => {
                    beforeEach(async () => {
                        calls.push("before");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["top", "before", "1"]);
            });

            it("should not invoke in case of skip", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const calls = [];

                describe.skip("/", () => {
                    beforeEach(async () => {
                        calls.push("beforeEach");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should emit event for before each hooks", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const results = [];

                describe("/", () => {
                    beforeEach("before each", adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });


                    it("test3", () => {
                        results.push("3");
                    });
                });

                const e = start();

                e.on("start before each hook", ({ block, hook }) => {
                    results.push(["start", block.name, hook.description]);
                });

                e.on("end before each hook", ({ block, hook }) => {
                    results.push(["end", block.name, hook.description]);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, [
                    ["start", "/", "before each"],
                    ["end", "/", "before each"],
                    "1",
                    ["start", "nested", "before each"],
                    ["end", "nested", "before each"],
                    "2",
                    ["start", "/", "before each"],
                    ["end", "/", "before each"],
                    "3"
                ]);
            });

            it("should set the error property and stop executing", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const results = [];

                describe("/", () => {
                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        beforeEach(() => {
                            throw new Error("123");
                        });

                        it("test2", () => {
                            results.push("2");
                        });
                    });

                    it("test3", () => {
                        results.push("3");
                    });
                });

                const e = start();

                e.on("end before each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["1", "123"]);
            });

            it("should set the elapsed property", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const results = [];

                describe("/", () => {
                    beforeEach(adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before each hook", ({ meta }) => {
                    results.push(typeof meta.elapsed);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["number", "1", "number", "2"]);
            });

            it("should throw a timeout error", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const results = [];

                describe("/", () => {
                    beforeEach(function (done) {
                        this.timeout(240);
                        setTimeout(done, 500);
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["Timeout of 240ms exceeded"], results);
            });

            it("should throw a timeout error (sync)", async () => {
                const engine = new Engine();
                const { describe, it, start, beforeEach } = engine.context();

                const results = [];

                describe("/", () => {
                    beforeEach(function () {
                        this.timeout(240);
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end before each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["Timeout of 240ms exceeded"], results);
            });
        });

        describe("afterEach", () => {
            it("should work with tests", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    afterEach(() => {
                        calls.push("after");
                    });

                    it("1", () => {
                        calls.push("1");
                    });

                    it("2", () => {
                        calls.push("2");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after", "2", "after"]);
            });

            it("should work with nested blocks", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    afterEach(() => {
                        calls.push("after");
                    });

                    it("1", () => {
                        calls.push("1");
                    });

                    it("2", () => {
                        calls.push("2");
                    });

                    describe("nested", () => {
                        it("3", () => {
                            calls.push("3");
                        });

                        describe("nested#1#2", () => {
                            it("5", () => {
                                calls.push("5");
                            });
                        });
                    });

                    describe("nested#2", () => {
                        it("4", () => {
                            calls.push("4");
                        });
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, [
                    "1", "after",
                    "2", "after",
                    "3", "after",
                    "5", "after",
                    "4", "after"
                ]);
            });

            it("should work with async functions", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const calls = [];
                describe("/", () => {
                    afterEach(async () => {
                        calls.push("after");
                    });

                    it("1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after"]);
            });

            it("top-level hook", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const calls = [];
                afterEach(() => {
                    calls.push("top");
                });
                describe("/", () => {
                    afterEach(async () => {
                        calls.push("after");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.deepEqual(calls, ["1", "after", "top"]);
            });

            it("should not invoke in case of skip", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const calls = [];

                describe.skip("/", () => {
                    afterEach(async () => {
                        calls.push("afterEach");
                    });

                    it("test1", () => {
                        calls.push("1");
                    });
                });

                await waitFor(start(), "done");

                assert.equal(calls.length, 0);
            });

            it("should emit event for after each hooks", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const results = [];

                describe("/", () => {
                    afterEach("after each", adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });


                    it("test3", () => {
                        results.push("3");
                    });
                });

                const e = start();

                e.on("start after each hook", ({ block, hook }) => {
                    results.push(["start", block.name, hook.description]);
                });

                e.on("end after each hook", ({ block, hook }) => {
                    results.push(["end", block.name, hook.description]);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, [
                    "1",
                    ["start", "/", "after each"],
                    ["end", "/", "after each"],
                    "2",
                    ["start", "nested", "after each"],
                    ["end", "nested", "after each"],
                    "3",
                    ["start", "/", "after each"],
                    ["end", "/", "after each"]
                ]);
            });

            it("should set the error property and stop executing", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const results = [];

                describe("/", () => {
                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        afterEach(() => {
                            throw new Error("123");
                        });

                        it("test2", () => {
                            results.push("2");
                        });
                    });

                    it("test3", () => {
                        results.push("3");
                    });
                });

                const e = start();

                e.on("end after each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["1", "2", "123"]);
            });

            it("should set the elapsed property", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const results = [];

                describe("/", () => {
                    afterEach(adone.noop);

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after each hook", ({ meta }) => {
                    results.push(typeof meta.elapsed);
                });

                await waitFor(e, "done");
                assert.deepEqual(results, ["1", "number", "2", "number"]);
            });

            it("should throw a timeout error", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const results = [];

                describe("/", () => {
                    afterEach(function (done) {
                        this.timeout(240);
                        setTimeout(done, 500);
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["1", "Timeout of 240ms exceeded"], results);
            });

            it("should throw a timeout error (sync)", async () => {
                const engine = new Engine();
                const { describe, it, start, afterEach } = engine.context();

                const results = [];

                describe("/", () => {
                    afterEach(function () {
                        this.timeout(240);
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });

                    it("test1", () => {
                        results.push("1");
                    });

                    describe("nested", () => {
                        it("test2", () => {
                            results.push("2");
                        });
                    });
                });

                const e = start();

                e.on("end after each hook", ({ meta }) => {
                    results.push(meta.err && meta.err.message);
                });

                await waitFor(e, "done");
                assert.deepEqual(["1", "Timeout of 240ms exceeded"], results);
            });
        });

        it("should invoke an after hook on the same level if a before hook fails", async () => {
            const engine = new Engine();
            const { describe, it, start, before, after } = engine.context();

            const calls = [];
            describe("/", () => {
                before(() => {
                    calls.push("before");
                    throw new Error("fail");
                });

                it("test1", async () => {
                    calls.push("shouldn't be called");
                });

                after(() => {
                    calls.push("after");
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["before", "after"]);
        });

        it("should invoke an after each hook on the same level if a before hook fails", async () => {
            const engine = new Engine();
            const { describe, it, start, beforeEach, afterEach } = engine.context();

            const calls = [];
            describe("/", () => {
                beforeEach(() => {
                    calls.push("before");
                    throw new Error("fail");
                });

                it("test1", async () => {
                    calls.push("shouldn't be called");
                });

                afterEach(() => {
                    calls.push("after");
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["before", "after"]);
        });

        it("should invoke the after hook if a before hook fails", async () => {
            const engine = new Engine();
            const { describe, it, start, before, after, afterEach } = engine.context();

            const calls = [];
            describe("/", () => {
                describe("nested", () => {
                    before(() => {
                        calls.push("before");
                        throw new Error("fail");
                    });

                    it("test1", async () => {
                        calls.push("shouldn't be called");
                    });
                });

                after(() => {
                    calls.push("after");
                });

                afterEach(() => {
                    calls.push("after each");
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["before", "after"]);
        });

        it("should invoke after each hooks if a before each hook fails", async () => {
            const engine = new Engine();
            const { describe, it, start, beforeEach, afterEach } = engine.context();

            const calls = [];
            describe("/", () => {
                describe("nested", () => {
                    beforeEach(() => {
                        calls.push("before each");
                        throw new Error("fail");
                    });

                    it("test1", async () => {
                        calls.push("shouldn't be called");
                    });
                });

                afterEach(() => {
                    calls.push("after each");
                });
            });

            await waitFor(start(), "done");

            assert.deepEqual(calls, ["before each", "after each"]);
        });

        it("should call hooks if tests fails", async () => {
            const engine = new Engine();
            const { describe, it, start, before, after, beforeEach, afterEach } = engine.context();

            const results = [];

            describe("/", () => {
                before(() => {
                    results.push("before");
                });

                after(() => {
                    results.push("after");
                });

                beforeEach(() => {
                    results.push("beforeEach");
                });

                afterEach(() => {
                    results.push("afterEach");
                });

                it("test1", () => {
                    throw new Error();
                });

                describe("nested", () => {
                    before(() => {
                        results.push("before2");
                    });

                    after(() => {
                        results.push("after2");
                    });

                    it("test2", () => {
                        throw new Error();
                    });

                    it("test3", () => {
                        results.push("test3");
                    });

                    it("test4", async () => {
                        throw new Error();
                    });
                });
            });

            await waitFor(start(), "done");
            assert.deepEqual([
                "before",
                // test1
                "beforeEach",
                "afterEach",
                "before2",
                // test2
                "beforeEach",
                "afterEach",
                //test3
                "beforeEach",
                "test3",
                "afterEach",
                // test4
                "beforeEach",
                "afterEach",
                "after2",
                "after"
            ], results);
        });
    });

    describe("timeout", () => {
        it("should work", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                it("test", async () => {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                });
            });

            const results = [];

            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should work (sync)", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                it("test", () => {
                    const t = new Date();
                    while (new Date() - t < 300) { }
                });
            });

            const results = [];

            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should set timeout in runtime", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", () => {
                it("test", async function () {
                    this.timeout(240);
                    await new Promise((resolve) => setTimeout(resolve, 250));
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should set timeout in runtime (sync)", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", () => {
                it("test", function () {
                    this.timeout(240);
                    const t = new Date();
                    while (new Date() - t < 300) { }
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should inherit the timeout value", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                describe("nested", () => {
                    it("test", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should inherit the timeout value (sync)", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                describe("nested", () => {
                    it("test", () => {
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        it("should rewrite the timeout value", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                describe("nested", () => {
                    this.timeout(245);
                    it("test", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 245ms exceeded");
        });

        it("should rewrite the timeout value (sync)", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            describe("/", function () {
                this.timeout(240);

                describe("nested", () => {
                    this.timeout(245);
                    it("test", () => {
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 245ms exceeded");
        });

        it("should set the default value if no one set the timeout value", async () => {
            const engine = new Engine({ defaultTimeout: 245 });
            const { describe, it, start } = engine.context();

            describe("/", () => {
                describe("nested", () => {
                    it("test", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 245ms exceeded");
        });

        it("should set the default value if no one set the timeout value (sync)", async () => {
            const engine = new Engine({ defaultTimeout: 245 });
            const { describe, it, start } = engine.context();

            describe("/", () => {
                describe("nested", () => {
                    it("test", () => {
                        const t = new Date();
                        while (new Date() - t < 300) { }
                    });
                });
            });

            const results = [];
            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 245ms exceeded");
        });

        it("should should trigger even if doesnt resolve", async () => {
            const engine = new Engine();
            const { describe, it, start, after } = engine.context();

            describe("/", function () {
                this.timeout(240);

                let timer = null;

                after(() => clearTimeout(timer));

                it("test", async () => {
                    await new Promise((resolve) => timer = setTimeout(resolve, 2501012));
                });
            });

            const results = [];

            const e = start();

            e.on("end test", ({ meta }) => {
                results.push(meta.err);
            });

            await waitFor(e, "done");

            assert.equal(results.length, 1);
            assert(results[0]);
            assert.equal(results[0].message, "Timeout of 240ms exceeded");
        });

        for (const val of [0, null, false, Infinity]) {
            it(`should set value to ${val}`, async () => {
                const engine = new Engine();
                const { describe, it, start } = engine.context();

                describe("/", function () {
                    this.timeout(val);

                    it("test", async () => {
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    });
                });

                const results = [];

                const e = start();

                e.on("end test", ({ meta }) => {
                    results.push(meta.err);
                });

                await waitFor(e, "done");

                assert.equal(results.length, 1);
                assert(!results[0]);
            });
        }

        for (const val of [0, null, false, Infinity]) {
            it(`should set value to ${val} in runtime`, async () => {
                const engine = new Engine();
                const { describe, it, start } = engine.context();

                describe("/", () => {

                    it("test", async function () {
                        this.timeout(val);
                        await new Promise((resolve) => setTimeout(resolve, 250));
                    });
                });

                const results = [];

                const e = start();

                e.on("end test", ({ meta }) => {
                    results.push(meta.err);
                });

                await waitFor(e, "done");

                assert.equal(results.length, 1);
                assert(!results[0]);
            });
        }
    });

    // describe("firstFailExit option", () => {
    //     it("should not run further tests", async function () {
    //         const engine = new Engine({ firstFailExit: true });
    //         const { describe, it, start } = engine.context();

    //         const calls = [];
    //         describe("/", () => {
    //             it("test1", async function () {
    //                 calls.push("1");
    //                 throw new Error;
    //             });

    //             it("test2", async function () {
    //                 calls.push("2");
    //             });

    //             describe("nested", () => {
    //                 it("test3", () => {
    //                     calls.push("3");
    //                 });

    //                 it("test4", () => {
    //                     calls.push("4");
    //                 });
    //             });
    //         });

    //         await waitFor(start(), "done");

    //         assert.deepEqual(calls, ["1"]);
    //     });

    //     it("should not run further tests if a test of the nested block is failed", async function () {
    //         const engine = new Engine({ firstFailExit: true });
    //         const { describe, it, start } = engine.context();

    //         const calls = [];
    //         describe("/", () => {
    //             it("test1", async function () {
    //                 calls.push("1");
    //             });

    //             it("test2", async function () {
    //                 calls.push("2");
    //             });

    //             describe("nested", () => {
    //                 it("test3", () => {
    //                     calls.push("3");
    //                 });

    //                 it("test4", () => {
    //                     throw new Error;
    //                 });

    //                 describe("nested", () => {
    //                     it("test5", () => {
    //                         calls.push("5");
    //                     });

    //                     it("test6", () => {
    //                         throw new Error;
    //                     });
    //                 });
    //             });

    //             describe("nested2", () => {
    //                 it("test7", () => {
    //                     calls.push("7");
    //                 });

    //                 it("test8", () => {
    //                     throw new Error;
    //                 });
    //             });

    //             it("test9", () => {
    //                 calls.push("9");
    //             });
    //         });

    //         await waitFor(start(), "done");

    //         assert.deepEqual(calls, ["1", "2", "3"]);
    //     });
    // });

    const script = (p) => path.join(__dirname, "_test", p);

    describe("reading from files", () => {

        it("should work", async () => {
            const engine = new Engine();
            engine.include(script("simple.js"));

            const results = [];
            const emitter = engine.start();

            emitter.on("enter block", ({ block }) => {
                results.push(`enter ${block.name}`);
            });

            emitter.on("end test", ({ test }) => {
                results.push(test.description);
            });

            emitter.on("exit block", ({ block }) => {
                results.push(`exit ${block.name}`);
            });

            await waitFor(emitter, "done");

            assert.deepEqual(results, [
                "enter /",
                "test1",
                "test2",
                "enter nested",
                "test3",
                "test4",
                "exit nested",
                "exit /"
            ]);
        });

        it("check default context", async () => {
            const engine = new Engine({ firstFailExit: true });
            engine.include(script("default_context.js"));

            const errors = [];

            const emitter = engine.start();

            emitter.on("end test", ({ test, meta }) => {
                if (meta.err) {
                    errors.push([test.description, meta.err.stack || meta.err.message || meta.err]);
                }
            });
            await waitFor(emitter, "done");
            assert.equal(errors.length, 0);
        });

        it("should not swallow errors in describe's", async () => {
            const engine = new Engine({ firstFailExit: true });
            engine.include(script("invalid_describe.js"));
            const emitter = engine.start();

            let e = null;
            emitter.on("error", (err) => {
                e = err;
            });
            await waitFor(emitter, "done");
            assert.ok(e);
        });

        it("should throw an error if an async function is passed to a describe", async () => {
            const engine = new Engine();
            engine.include(script("invalid_async_describe.js"));
            const emitter = engine.start();
            let e = null;
            emitter.on("error", (err) => {
                e = err;
            });
            await waitFor(emitter, "done");
            assert.ok(e);
        });

        // it("should not fall down if someone calls process.exit", async () => {
        //     const engine = new Engine({ firstFailExit: true });
        //     engine.include(script("explicit_exit.js"));
        //     let err = null;
        //     try {
        //         await engine.run().promise;
        //     } catch (_err) {
        //         err = _err;
        //     }

        //     assert.ok(err);
        //     assert.equal(err.message, "[shani] Don't even try to call process.exit");
        // });

        it("should pass aliases", async () => {
            const engine = new Engine();
            engine.include(script("simple_a.js"));

            const results = [];
            const emitter = engine.start();

            emitter.on("enter block", ({ block }) => {
                results.push(`enter ${block.name}`);
            });

            emitter.on("end test", ({ test }) => {
                results.push(test.description);
            });

            emitter.on("exit block", ({ block }) => {
                results.push(`exit ${block.name}`);
            });

            await waitFor(emitter, "done");
            assert.deepEqual(results, [
                "enter /",
                "test1_a",
                "test2_a",
                "enter nested",
                "test3_a",
                "test4_a",
                "exit nested",
                "exit /"
            ]);
        });
    });

    it("should catch 'uncaughtException'", async () => {
        const engine = new Engine();
        const { describe, it, start } = engine.context();

        const calls = [];

        describe("/1", () => {
            it("test1", (done) => {
                process.nextTick(() => {
                    throw new Error("error1");
                });
            });

            it("test2", async () => {
                const p = new Promise(() => {
                    setTimeout(() => {
                        throw new Error("error2");
                    });
                });
                await p;
            });
        });

        const e = start();

        e.on("end test", ({ test, meta }) => {
            calls.push([test.description, meta.err && meta.err.message]);
        });

        await waitFor(e, "done");

        assert.deepEqual(calls, [["test1", "error1"], ["test2", "error2"]]);
    });

    // describe("retries", () => {
    //     it("should try to run the test at least 2 times", async function () {
    //         const engine = new Engine();
    //         const { describe, it, start } = engine.context();

    //         const calls = [];

    //         describe("/", () => {
    //             it("test1", function () {
    //                 calls.push("1");
    //                 this.retries(2);
    //                 throw new Error;
    //             });
    //         });

    //         await run({
    //             result: (test, { err }) => {
    //                 if (err) {
    //                     calls.push(test.description);
    //                 }
    //             }
    //         }).promise;

    //         assert.deepEqual(calls, ["1", "1", "test1"]);
    //     });

    //     it("should run only once", async function () {
    //         const engine = new Engine();
    //         const { describe, it, start } = engine.context();

    //         const calls = [];

    //         describe("/", () => {
    //             it("test1", function () {
    //                 calls.push("1");
    //                 this.retries(5);
    //             });
    //         });

    //         await waitFor(start(), "done");

    //         assert.deepEqual(calls, ["1"]);
    //     });

    //     it("should pass the test", async function () {
    //         const engine = new Engine();
    //         const { describe, it, start } = engine.context();

    //         const calls = [];
    //         let i = 0;
    //         describe("/", () => {
    //             it("test1", function () {
    //                 this.retries(10);
    //                 calls.push("1");
    //                 if (i++ < 5) {
    //                     throw new Error;
    //                 }
    //             });
    //         });

    //         await run({
    //             result: (test, { err }) => {
    //                 calls.push([test.description, err]);
    //             }
    //         }).promise;

    //         assert.deepEqual(calls, ["1", "1", "1", "1", "1", "1", ["test1", null]]);
    //     });

    //     it("should inhertit the value", async function () {
    //         const engine = new Engine();
    //         const { describe, it, start } = engine.context();

    //         const calls = [];
    //         describe("/", function () {
    //             this.retries(3);
    //             it("test1", () => {
    //                 calls.push("1");
    //                 throw new Error;
    //             });
    //         });

    //         await waitFor(start(), "done");

    //         assert.deepEqual(calls, ["1", "1", "1"]);
    //     });

    //     it("should inherit the value deeper", async function () {
    //         const engine = new Engine();
    //         const { describe, it, start } = engine.context();

    //         const calls = [];
    //         describe("/", function () {
    //             this.retries(3);
    //             describe("opachki", () => {
    //                 it("test1", () => {
    //                     calls.push("1");
    //                     throw new Error;
    //                 });
    //             });
    //         });

    //         await waitFor(start(), "done");

    //         assert.deepEqual(calls, ["1", "1", "1"]);
    //     });
    // });

    it("should not swallow errors in describe's", async () => {
        const engine = new Engine();
        const { describe } = engine.context();

        let err = null;
        try {
            describe("/1", () => {
                throw new Error();
            });
        } catch (_err) {
            err = _err;
        }

        assert.ok(err);
    });

    it("should throw an error if an async function is passed to a describe", async () => {
        const engine = new Engine();
        const { describe } = engine.context();

        let err = null;
        try {
            describe("/1", async () => {
            });
        } catch (_err) {
            err = _err;
        }

        assert.ok(err);
    });

    describe("should correctly enter and exit", () => {
        it("common", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("test1", nop);

                describe("/home", () => {
                    it("test2", () => nop);
                    it("test3", nop);
                });

                describe("/tmp", () => {
                    it("test4", nop);

                    describe("/tmp/smth", () => {
                        it("test5", nop);
                    });
                });
            });

            const emitter = start();

            emitter.on("enter block", ({ block }) => {
                calls.push(`enter ${block.name}`);
            });

            emitter.on("exit block", ({ block }) => {
                calls.push(`exit ${block.name}`);
            });

            emitter.on("end test", ({ test }) => {
                calls.push(test.description);
            });

            await waitFor(emitter, "done");

            assert.deepEqual(calls, [
                "enter /",
                "test1",
                "enter /home",
                "test2",
                "test3",
                "exit /home",
                "enter /tmp",
                "test4",
                "enter /tmp/smth",
                "test5",
                "exit /tmp/smth",
                "exit /tmp",
                "exit /"
            ]);
        });

        it("should visit a block if it has only exclusive tests", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it.skip("test1", nop);

                describe("/home", () => {
                    it.skip("test2", nop);
                    it.skip("test3", nop);
                });
            });

            const emitter = start();

            emitter.on("enter block", ({ block }) => {
                calls.push(`enter ${block.name}`);
            });

            emitter.on("exit block", ({ block }) => {
                calls.push(`exit ${block.name}`);
            });

            emitter.on("skip test", ({ test }) => {
                calls.push(test.description);
            });

            await waitFor(emitter, "done");

            assert.deepEqual(calls, [
                "enter /",
                "test1",
                "enter /home",
                "test2",
                "test3",
                "exit /home",
                "exit /"
            ]);
        });

        it("should not enter blocks in inclusive mode", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it.only("test1", nop);

                describe("/home", () => {
                    it("test2", nop);
                    it("test3", nop);
                });

                describe.only("/tmp", () => {
                    it.only("test4", nop);

                    describe("/tmp/smtp", () => {
                        it("test5", nop);
                    });
                });
            });

            const emitter = start();

            emitter.on("enter block", ({ block }) => {
                calls.push(`enter ${block.name}`);
            });

            emitter.on("exit block", ({ block }) => {
                calls.push(`exit ${block.name}`);
            });

            emitter.on("end test", ({ test }) => {
                calls.push(test.description);
            });

            await waitFor(emitter, "done");

            assert.deepEqual(calls, [
                "enter /",
                "test1",
                "enter /tmp",
                "test4",
                "exit /tmp",
                "exit /"
            ]);
        });
    });

    describe("stopping", () => {
        it("should stop executing", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                it("", () => {
                    calls.push(1);
                    return sleep(100);
                });

                it("", () => {
                    calls.push(2);
                    return sleep(100);
                });

                it("", () => {
                    calls.push(3);
                    return sleep(100);
                });
            });
            const emitter = start();
            setTimeout(() => {
                emitter.stop();
            }, 150);
            await waitFor(emitter, "done");
            assert.deepEqual(calls, [1, 2]);
        });

        it("should work with nested blocks", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            const calls = [];

            describe("/", () => {
                describe("", () => {
                    it("", () => {
                        calls.push(1);
                        return sleep(100);
                    });
                });

                describe("", () => {
                    it("", () => {
                        calls.push(2);
                        return sleep(100);
                    });
                });

                describe("", () => {
                    it("", () => {
                        calls.push(3);
                        return sleep(100);
                    });
                });
            });
            const emitter = start();
            setTimeout(() => {
                emitter.stop();
            }, 150);
            await waitFor(emitter, "done");
            assert.deepEqual(calls, [1, 2]);
        });

        it("should invoke all the hooks", async () => {
            const engine = new Engine();
            const { describe, it, start, before, after, beforeEach, afterEach } = engine.context();

            const calls = [];

            describe("/", () => {
                before(() => {
                    calls.push("before");
                });

                after(() => {
                    calls.push("after");
                });

                beforeEach(() => {
                    calls.push("beforeEach");
                });

                afterEach(() => {
                    calls.push("afterEach");
                });

                describe("", () => {
                    it("", () => {
                        calls.push(1);
                        return sleep(100);
                    });
                });

                describe("", () => {
                    it("", () => {
                        calls.push(2);
                        return sleep(100);
                    });
                });

                describe("", () => {
                    it("", () => {
                        calls.push(3);
                        return sleep(100);
                    });
                });
            });
            const emitter = start();
            setTimeout(() => {
                emitter.stop();
            }, 150);
            await waitFor(emitter, "done");
            assert.deepEqual(calls, [
                "before",
                "beforeEach", 1, "afterEach",
                "beforeEach", 2, "afterEach",
                "after"
            ]);
        });
    });

    describe("aliases", () => {
        it("describe = context", () => {
            const engine = new Engine();
            const { describe, context } = engine.context();
            assert.equal(describe, context);
        });

        it("it = specify", () => {
            const engine = new Engine();
            const { it, specify } = engine.context();
            assert.equal(it, specify);
        });
    });

    describe("root skipping", () => {
        it("should skip the root describe", async () => {
            const engine = new Engine();
            const { root, skip } = engine.context();
            skip(() => true);
            await skip.promise;
            assert.ok(root.isExclusive());
        });

        it("should not skip the root describe", async () => {
            const engine = new Engine();
            const { root, skip } = engine.context();
            skip(() => false);
            await skip.promise;
            assert.ok(!root.isExclusive());
        });

        it("should support promises", async () => {
            const engine = new Engine();
            const { root, skip } = engine.context();
            skip(() => Promise.resolve(true));
            await skip.promise;
            assert.ok(root.isExclusive());
        });

        it("should not be skipped by default", () => {
            const engine = new Engine();
            const { root } = engine.context();
            assert.ok(!root.isExclusive());
        });

        it("should pass the skip function into contexts", async () => {
            const engine = new Engine();
            engine.include(script("skipping.js"));
            const results = [];
            const emitter = engine.start();
            emitter.on("end test", () => {
                results.push(1);
            });
            await waitFor(emitter, "done");
            assert.equal(results.length, 0);
        });

        it("should wait and only then run the tests", async () => {
            const engine = new Engine();
            engine.include(script("skipping_2.js"));
            let t1 = null;
            const t = new Date();
            const emitter = engine.start();
            emitter.on("end test", () => {
                t1 = new Date();
            });
            await waitFor(emitter, "done");
            assert.ok(t1 - t >= 1000);
        });
    });

    describe("multiple describe names", () => {
        it("should push appropriate blocks into the stack", () => {
            const engine = new Engine();
            const { root, describe, it } = engine.context();
            describe("a", "b", "c", "d", () => {
                it("e", adone.noop);
            });
            assert.equal(root.children.length, 1);
            assert.equal(root.children[0].name, "a");

            const a = root.children[0];
            assert.equal(a.children.length, 1);
            assert.equal(a.children[0].name, "b");

            const b = a.children[0];
            assert.equal(b.children.length, 1);
            assert.equal(b.children[0].name, "c");

            const c = b.children[0];
            assert.equal(c.children.length, 1);
            assert.equal(c.children[0].name, "d");

            const d = c.children[0];
            assert.equal(d.children.length, 1);
            assert.equal(d.children[0].description, "e");
        });

        it("should return the last block", () => {
            const engine = new Engine();
            const { describe, it } = engine.context();
            const c = describe("a", "b", "c", adone.noop);

            assert.equal(c.name, "c");
        });
    });

    describe("runtime context", () => {
        it("should have same context", async () => {
            const engine = new Engine();
            const { describe, it, start } = engine.context();

            let context = null;
            describe("/", function () {
                context = this;

                before(function () {
                    assert.equal(this, context, "before");
                });

                beforeEach(function () {
                    assert.equal(this, context, "beforeEach");
                });

                after(function () {
                    assert.equal(this, context, "after");
                });

                afterEach(function () {
                    assert.equal(this, context, "afterEach");
                });

                it("", function () {
                    assert.equal(this, context, "it");
                });

                before(function (done) {
                    assert.equal(this, context, "cb before");
                    done();
                });

                beforeEach(function (done) {
                    assert.equal(this, context, "cb beforeEach");
                    done();
                });

                after(function (done) {
                    assert.equal(this, context, "cb after");
                    done();
                });

                afterEach(function (done) {
                    assert.equal(this, context, "cb afterEach");
                    done();
                });

                it("", function (done) {
                    assert.equal(this, context, "cb it");
                    done();
                });

                describe("a", function () {
                    assert.equal(this, context, "nested describe");

                    before(function () {
                        assert.equal(this, context, "nested before");
                    });

                    beforeEach(function () {
                        assert.equal(this, context, "nested beforeEach");
                    });

                    after(function () {
                        assert.equal(this, context, "nested after");
                    });

                    afterEach(function () {
                        assert.equal(this, context, "nested afterEach");
                    });

                    it("", function () {
                        assert.equal(this, context, "nested it");
                    });

                    before(function (done) {
                        assert.equal(this, context, "nested cb before");
                        done();
                    });

                    beforeEach(function (done) {
                        assert.equal(this, context, "nested cb beforeEach");
                        done();
                    });

                    after(function (done) {
                        assert.equal(this, context, "nested cb after");
                        done();
                    });

                    afterEach(function (done) {
                        assert.equal(this, context, "nested cb afterEach");
                        done();
                    });

                    it("", function (done) {
                        assert.equal(this, context, "nested cb it");
                        done();
                    });
                });
            });
            const emitter = start();
            const errs = [];
            const cb = ({ meta }) => {
                if (meta.err) {
                    errs.push(meta.err);
                }
            };
            emitter
                .on("end test", cb)
                .on("end before hook", cb)
                .on("end before each hook", cb)
                .on("end after hook", cb)
                .on("end after each hook", cb);

            await waitFor(emitter, "done");
            assert.equal(errs.length, 0);

        });
    });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// process
const emitter = run();

const errors = [];
let passed = 0;

emitter.on("start", () => {
    console.log();
});

emitter.on("header", ({ name, level }) => {
    console.log("    ".repeat(level), name);
});

emitter.on("result", ({ description, ok, err = null, level } = {}) => {
    let msg = "    ".repeat(level + 1);
    if (ok) {
        msg = `${msg}\x1b[32m\u2713\x1b[90m ${description}\x1b[0m`;
        ++passed;
    } else {
        msg = `${msg}\x1b[31m\u2717 ${errors.length + 1}) ${description}\x1b[0m`;
        errors.push([description, err]);
    }
    console.log(msg);
});

emitter.on("end", () => {
    if (errors.length) {
        console.log();
        let i = 1;
        for (const [description, err] of errors) {
            console.log(`${i++})`, description);
            console.log(err);
        }
    }
    console.log();
    if (passed) {
        console.log(`    \x1b[32m${passed} passing\x1b[39;49m`);
    }
    if (errors.length) {
        console.log(`    \x1b[31m${errors.length} failing\x1b[39;49m`);
    }
    console.log();
    if (errors.length > 0) {
        process.exit(1);
    }
});
