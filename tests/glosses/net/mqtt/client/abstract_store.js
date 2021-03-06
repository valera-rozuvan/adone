module.exports = function abstractStoreTest(build) {
    let store;

    beforeEach((done) => {
        build((err, _store) => {
            store = _store;
            done(err);
        });
    });

    afterEach((done) => {
        store.close(done);
    });

    it("should put and stream in-flight packets", (done) => {
        const packet = {
            topic: "hello",
            payload: "world",
            qos: 1,
            messageId: 42
        };

        store.put(packet, () => {
            store
                .createStream()
                .on("data", (data) => {
                    assert.deepEqual(data, packet);
                    done();
                });
        });
    });

    it("should support destroying the stream", (done) => {
        const packet = {
            topic: "hello",
            payload: "world",
            qos: 1,
            messageId: 42
        };

        store.put(packet, () => {
            const stream = store.createStream();
            stream.on("close", done);
            stream.destroy();
        });
    });

    it("should add and del in-flight packets", (done) => {
        const packet = {
            topic: "hello",
            payload: "world",
            qos: 1,
            messageId: 42
        };

        store.put(packet, () => {
            store.del(packet, () => {
                store
                    .createStream()
                    .on("data", () => {
                        done(new Error("this should never happen"));
                    })
                    .on("end", done);
            });
        });
    });

    it("should replace a packet when doing put with the same messageId", (done) => {
        const packet1 = {
            topic: "hello",
            payload: "world",
            qos: 2,
            messageId: 42
        };
        const packet2 = {
            qos: 2,
            messageId: 42
        };

        store.put(packet1, () => {
            store.put(packet2, () => {
                store
                    .createStream()
                    .on("data", (data) => {
                        assert.deepEqual(data, packet2);
                        done();
                    });
            });
        });
    });

    it("should return the original packet on del", (done) => {
        const packet = {
            topic: "hello",
            payload: "world",
            qos: 1,
            messageId: 42
        };

        store.put(packet, () => {
            store.del({ messageId: 42 }, (err, deleted) => {
                if (err) {
                    throw err;
                }
                assert.deepEqual(deleted, packet);
                done();
            });
        });
    });

    it("should get a packet with the same messageId", (done) => {
        const packet = {
            topic: "hello",
            payload: "world",
            qos: 1,
            messageId: 42
        };

        store.put(packet, () => {
            store.get({ messageId: 42 }, (err, fromDb) => {
                if (err) {
                    throw err;
                }
                assert.deepEqual(fromDb, packet);
                done();
            });
        });
    });
};
