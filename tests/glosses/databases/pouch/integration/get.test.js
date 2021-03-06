require("./node.setup");

const adapters = ["http", "local"];

adapters.forEach((adapter) => {
    describe(`test.get.js-${adapter}`, () => {

        const dbs = {};

        beforeEach((done) => {
            dbs.name = testUtils.adapterUrl(adapter, "testdb");
            testUtils.cleanup([dbs.name], done);
        });

        after((done) => {
            testUtils.cleanup([dbs.name], done);
        });


        const origDocs = [
            { _id: "0", a: 1, b: 1 },
            { _id: "3", a: 4, b: 16 },
            { _id: "1", a: 2, b: 4 },
            { _id: "2", a: 3, b: 9 }
        ];

        it("Get doc", (done) => {
            const db = new PouchDB(dbs.name);
            db.post({ test: "somestuff" }, (err, info) => {
                db.get(info.id, (err, doc) => {
                    assert.property(doc, "test");
                    db.get(`${info.id}asdf`, (err) => {
                        assert.equal(err.status, testUtils.errors.MISSING_DOC.status, "correct error status returned");
                        assert.equal(err.name, testUtils.errors.MISSING_DOC.name, "correct error name returned");
                        assert.equal(err.message, testUtils.errors.MISSING_DOC.message, "correct error message returned");
                        // todo: does not work in pouchdb-server.
                        // err.reason.should.equal(testUtils.errors.MISSING_DOC.reason,
                        //                           'correct error reason returned');
                        done();
                    });
                });
            });
        });

        it("Get design doc", (done) => {
            const db = new PouchDB(dbs.name);
            db.put({
                _id: "_design/someid",
                test: "somestuff"
            }, (err, info) => {
                db.get(info.id, () => {
                    db.get(`${info.id}asdf`, (err) => {
                        assert.equal(err.status, testUtils.errors.MISSING_DOC.status, "correct error status returned");
                        assert.equal(err.name, testUtils.errors.MISSING_DOC.name, "correct error name returned");
                        assert.equal(err.message, testUtils.errors.MISSING_DOC.message, "correct error message returned");
                        // todo: does not work in pouchdb-server.
                        // err.reason.should.equal(testUtils.errors.MISSING_DOC.reason,
                        //                           'correct error reason returned');
                        done();
                    });
                });
            });
        });

        it("Check error of deleted document", (done) => {
            const db = new PouchDB(dbs.name);
            db.post({ test: "somestuff" }, (err, info) => {
                db.remove({
                    _id: info.id,
                    _rev: info.rev
                }, () => {
                    db.get(info.id, (err) => {
                        assert.equal(err.status, testUtils.errors.MISSING_DOC.status, "correct error status returned");
                        assert.equal(err.name, testUtils.errors.MISSING_DOC.name, "correct error name returned");
                        done();
                    });
                });
            });
        });

        it("Get revisions of removed doc", (done) => {
            const db = new PouchDB(dbs.name, { auto_compaction: false });
            db.post({ test: "somestuff" }, (err, info) => {
                const rev = info.rev;
                db.remove({
                    test: "somestuff",
                    _id: info.id,
                    _rev: info.rev
                }, () => {
                    db.get(info.id, { rev }, (err) => {
                        assert.isNull(err);
                        done();
                    });
                });
            });
        });

        it("Testing get with rev", (done) => {
            const db = new PouchDB(dbs.name);
            const docs = JSON.parse(JSON.stringify(origDocs));
            testUtils.writeDocs(db, docs, () => {
                db.get("3", (err, parent) => {
                    // add conflicts
                    const pRevId = parent._rev.split("-")[1];
                    const conflicts = [
                        {
                            _id: "3",
                            _rev: "2-aaa",
                            value: "x",
                            _revisions: {
                                start: 2,
                                ids: [
                                    "aaa",
                                    pRevId
                                ]
                            }
                        },
                        {
                            _id: "3",
                            _rev: "3-bbb",
                            value: "y",
                            _deleted: true,
                            _revisions: {
                                start: 3,
                                ids: [
                                    "bbb",
                                    "some",
                                    pRevId
                                ]
                            }
                        },
                        {
                            _id: "3",
                            _rev: "4-ccc",
                            value: "z",
                            _revisions: {
                                start: 4,
                                ids: [
                                    "ccc",
                                    "even",
                                    "more",
                                    pRevId
                                ]
                            }
                        }
                    ];
                    db.put(conflicts[0], { new_edits: false }, () => {
                        db.put(conflicts[1], { new_edits: false }, () => {
                            db.put(conflicts[2], { new_edits: false }, () => {
                                db.get("3", { rev: "2-aaa" }, (err, doc) => {
                                    assert.equal(doc._rev, "2-aaa");
                                    assert.equal(doc.value, "x");
                                    db.get("3", { rev: "3-bbb" }, (err, doc) => {
                                        assert.equal(doc._rev, "3-bbb");
                                        assert.equal(doc.value, "y");
                                        db.get("3", { rev: "4-ccc" }, (err, doc) => {
                                            assert.equal(doc._rev, "4-ccc");
                                            assert.equal(doc.value, "z");
                                            done();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        it("Testing rev format", (done) => {
            const revs = [];
            const db = new PouchDB(dbs.name);
            db.post({ test: "somestuff" }, (err, info) => {
                revs.unshift(info.rev.split("-")[1]);
                db.put({
                    _id: info.id,
                    _rev: info.rev,
                    another: "test1"
                }, (err, info2) => {
                    revs.unshift(info2.rev.split("-")[1]);
                    db.put({
                        _id: info.id,
                        _rev: info2.rev,
                        last: "test2"
                    }, (err, info3) => {
                        revs.unshift(info3.rev.split("-")[1]);
                        db.get(info.id, { revs: true }, (err, doc) => {
                            assert.equal(doc._revisions.start, 3);
                            assert.deepEqual(revs, doc._revisions.ids);
                            done();
                        });
                    });
                });
            });
        });

        it("Test opts.revs=true with rev other than winning", (done) => {
            const db = new PouchDB(dbs.name, { auto_compaction: false });
            const docs = [
                { _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-b", value: "foo b" },
                { _id: "foo", _rev: "3-c", value: "foo c" },
                { _id: "foo", _rev: "4-d", value: "foo d" }
            ];
            testUtils.putBranch(db, docs, () => {
                db.get("foo", {
                    rev: "3-c",
                    revs: true
                }, (err, doc) => {
                    assert.equal(doc._revisions.ids.length, 3, "correct revisions length");
                    assert.equal(doc._revisions.start, 3, "correct revisions start");
                    assert.equal(doc._revisions.ids[0], "c", "correct rev");
                    assert.equal(doc._revisions.ids[1], "b", "correct rev");
                    assert.equal(doc._revisions.ids[2], "a", "correct rev");
                    done();
                });
            });
        });

        it("Test opts.revs=true return only winning branch", (done) => {
            const db = new PouchDB(dbs.name);
            const simpleTree = [
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-b", value: "foo b" },
                { _id: "foo", _rev: "3-c", value: "foo c" }],
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-d", value: "foo d" },
                { _id: "foo", _rev: "3-e", value: "foo e" },
                { _id: "foo", _rev: "4-f", value: "foo f" }
                ]
            ];
            testUtils.putTree(db, simpleTree, () => {
                db.get("foo", { revs: true }, (err, doc) => {
                    assert.equal(doc._revisions.ids.length, 4, "correct revisions length");
                    assert.equal(doc._revisions.start, 4, "correct revisions start");
                    assert.equal(doc._revisions.ids[0], "f", "correct rev");
                    assert.equal(doc._revisions.ids[1], "e", "correct rev");
                    assert.equal(doc._revisions.ids[2], "d", "correct rev");
                    assert.equal(doc._revisions.ids[3], "a", "correct rev");
                    done();
                });
            });
        });

        it("Test get with simple revs_info", (done) => {
            const db = new PouchDB(dbs.name);
            db.post({ test: "somestuff" }, (err, info) => {
                db.put({
                    _id: info.id,
                    _rev: info.rev,
                    another: "test"
                }, (err, info) => {
                    db.put({
                        _id: info.id,
                        _rev: info.rev,
                        a: "change"
                    }, () => {
                        db.get(info.id, { revs_info: true }, (err, doc) => {
                            assert.equal(doc._revs_info.length, 3, "updated a doc with put");
                            done();
                        });
                    });
                });
            });
        });

        it("Test get with revs_info on tree", (done) => {
            const db = new PouchDB(dbs.name);
            const simpleTree = [
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-b", value: "foo b" },
                { _id: "foo", _rev: "3-c", value: "foo c" }],
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-d", value: "foo d" },
                { _id: "foo", _rev: "3-e", _deleted: true }]
            ];
            testUtils.putTree(db, simpleTree, () => {
                db.get("foo", { revs_info: true }, (err, doc) => {
                    const revs = doc._revs_info;
                    assert.equal(revs.length, 3, "correct number of revs");
                    assert.equal(revs[0].rev, "3-c", "rev ok");
                    assert.equal(revs[1].rev, "2-b", "rev ok");
                    assert.equal(revs[2].rev, "1-a", "rev ok");
                    done();
                });
            });
        });

        it("Test get with revs_info on compacted tree", (done) => {
            // _compact endpoint is not exposed in CouchDB 2.0
            // (it's exposed via a private port). Skip
            // this test for now
            if (testUtils.isCouchMaster()) {
                return done();
            }

            const db = new PouchDB(dbs.name);
            const simpleTree = [
                [
                    {
                        _id: "foo",
                        _rev: "1-a",
                        value: "foo a"
                    },
                    {
                        _id: "foo",
                        _rev: "2-b",
                        value: "foo d"
                    },
                    {
                        _id: "foo",
                        _rev: "3-c",
                        value: "foo c"
                    }
                ],
                [
                    {
                        _id: "foo",
                        _rev: "1-a",
                        value: "foo a"
                    },
                    {
                        _id: "foo",
                        _rev: "2-d",
                        value: "foo d"
                    },
                    {
                        _id: "foo",
                        _rev: "3-e",
                        _deleted: true
                    }
                ]
            ];
            testUtils.putTree(db, simpleTree, () => {
                db.compact(() => {
                    db.get("foo", { revs_info: true }, (err, doc) => {
                        const revs = doc._revs_info;
                        assert.equal(revs.length, 3, "correct number of revs");
                        assert.equal(revs[0].rev, "3-c", "rev ok");
                        assert.equal(revs[0].status, "available", "not compacted");
                        assert.equal(revs[1].rev, "2-b", "rev ok");
                        assert.equal(revs[1].status, "missing", "compacted");
                        assert.equal(revs[2].rev, "1-a", "rev ok");
                        assert.equal(revs[2].status, "missing", "compacted");
                        done();
                    });
                });
            });
        });

        it("#2951 Parallelized gets with 409s/404s", () => {
            const db = new PouchDB(dbs.name);

            const numSimultaneous = 20;
            const numDups = 3;

            const tasks = [];

            for (let i = 0; i < numSimultaneous; i++) {
                const key = Math.random().toString();
                for (let j = 0; j < numDups; j++) {
                    tasks.push(key);
                }
            }

            function getDocWithDefault(db, id, defaultDoc) {
                return db.get(id).catch((err) => {
                    /* istanbul ignore if */
                    if (err.status !== 404) {
                        throw err;
                    }
                    defaultDoc._id = id;
                    return db.put(defaultDoc).catch((err) => {
                        /* istanbul ignore if */
                        if (err.status !== 409) { // conflict
                            throw err;
                        }
                    }).then(() => {
                        return db.get(id);
                    });
                });
            }

            return testUtils.Promise.all(tasks.map((task) => {
                return getDocWithDefault(db, task, { foo: "bar" });
            }));
        });

        it("#2951 Parallelized _local gets with 409s/404s", () => {
            const db = new PouchDB(dbs.name);

            const numSimultaneous = 20;
            const numDups = 3;

            const tasks = [];

            for (let i = 0; i < numSimultaneous; i++) {
                const key = Math.random().toString();
                for (let j = 0; j < numDups; j++) {
                    tasks.push(`_local/${key}`);
                }
            }

            function getDocWithDefault(db, id, defaultDoc) {
                return db.get(id).catch((err) => {
                    /* istanbul ignore if */
                    if (err.status !== 404) {
                        throw err;
                    }
                    defaultDoc._id = id;
                    return db.put(defaultDoc).catch((err) => {
                        /* istanbul ignore if */
                        if (err.status !== 409) { // conflict
                            throw err;
                        }
                    }).then(() => {
                        return db.get(id);
                    });
                });
            }

            return testUtils.Promise.all(tasks.map((task) => {
                return getDocWithDefault(db, task, { foo: "bar" });
            }));
        });

        it("Test get with conflicts", (done) => {
            const db = new PouchDB(dbs.name);
            const simpleTree = [
                [
                    {
                        _id: "foo",
                        _rev: "1-a",
                        value: "foo a"
                    },
                    {
                        _id: "foo",
                        _rev: "2-b",
                        value: "foo b"
                    }
                ],
                [
                    {
                        _id: "foo",
                        _rev: "1-a",
                        value: "foo a"
                    },
                    {
                        _id: "foo",
                        _rev: "2-c",
                        value: "foo c"
                    }
                ],
                [
                    {
                        _id: "foo",
                        _rev: "1-a",
                        value: "foo a"
                    },
                    {
                        _id: "foo",
                        _rev: "2-d",
                        value: "foo d",
                        _deleted: true
                    }
                ]
            ];
            testUtils.putTree(db, simpleTree, () => {
                db.get("foo", { conflicts: true }, (err, doc) => {
                    assert.equal(doc._rev, "2-c", "correct rev");
                    assert.equal(doc._conflicts.length, 1, "just one conflict");
                    assert.equal(doc._conflicts[0], "2-b", "just one conflict");
                    done();
                });
            });
        });

        it("Retrieve old revision", (done) => {
            const db = new PouchDB(dbs.name, { auto_compaction: false });
            db.post({ version: "first" }, (err, info) => {
                db.put({
                    _id: info.id,
                    _rev: info.rev,
                    version: "second"
                }, (err) => {
                    assert.isNull(err);
                    db.get(info.id, { rev: info.rev }, (err, oldRev) => {
                        assert.equal(oldRev.version, "first", "Fetched old revision");
                        db.get(info.id, { rev: "1-nonexistentRev" }, (err) => {
                            assert.exists(err, "Non existent row error correctly reported");
                            done();
                        });
                    });
                });
            });
        });

        it('Testing get open_revs="all"', (done) => {
            const db = new PouchDB(dbs.name);
            testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)),
                () => {
                    db.get("3", (err, parent) => {
                        // add conflicts
                        const previd = parent._rev.split("-")[1];
                        const conflicts = [
                            {
                                _id: "3",
                                _rev: "2-aaa",
                                value: "x",
                                _revisions: {
                                    start: 2,
                                    ids: [
                                        "aaa",
                                        previd
                                    ]
                                }
                            },
                            {
                                _id: "3",
                                _rev: "3-bbb",
                                value: "y",
                                _deleted: true,
                                _revisions: {
                                    start: 3,
                                    ids: [
                                        "bbb",
                                        "some",
                                        previd
                                    ]
                                }
                            },
                            {
                                _id: "3",
                                _rev: "4-ccc",
                                value: "z",
                                _revisions: {
                                    start: 4,
                                    ids: [
                                        "ccc",
                                        "even",
                                        "more",
                                        previd
                                    ]
                                }
                            }
                        ];
                        db.put(conflicts[0], { new_edits: false }, () => {
                            db.put(conflicts[1], { new_edits: false }, () => {
                                db.put(conflicts[2], { new_edits: false }, () => {
                                    db.get("3", { open_revs: "all" }, (err, res) => {
                                        let i;
                                        res = res.map((row) => {
                                            return row.ok;
                                        });
                                        res.sort((a, b) => {
                                            return a._rev === b._rev ? 0 : a._rev < b._rev ? -1 : 1;
                                        });
                                        assert.equal(res.length, conflicts.length);
                                        for (i = 0; i < conflicts.length; i++) {
                                            assert.equal(conflicts[i]._rev, res[i]._rev, "correct rev");
                                        }
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
        });

        it("Testing get with some open_revs", (done) => {
            // TODO: CouchDB master fails, needs investigation
            if (testUtils.isCouchMaster()) {
                return done();
            }
            const db = new PouchDB(dbs.name);
            testUtils.writeDocs(db, JSON.parse(JSON.stringify(origDocs)),
                () => {
                    db.get("3", (err, parent) => {
                        // add conflicts
                        const previd = parent._rev.split("-")[1];
                        const conflicts = [
                            {
                                _id: "3",
                                _rev: "2-aaa",
                                value: "x",
                                _revisions: {
                                    start: 2,
                                    ids: [
                                        "aaa",
                                        previd
                                    ]
                                }
                            },
                            {
                                _id: "3",
                                _rev: "3-bbb",
                                value: "y",
                                _deleted: true,
                                _revisions: {
                                    start: 3,
                                    ids: [
                                        "bbb",
                                        "some",
                                        previd
                                    ]
                                }
                            },
                            {
                                _id: "3",
                                _rev: "4-ccc",
                                value: "z",
                                _revisions: {
                                    start: 4,
                                    ids: [
                                        "ccc",
                                        "even",
                                        "more",
                                        previd
                                    ]
                                }
                            }
                        ];
                        db.put(conflicts[0], { new_edits: false }, () => {
                            db.put(conflicts[1], { new_edits: false }, () => {
                                db.put(conflicts[2], { new_edits: false }, () => {
                                    db.get("3", {
                                        open_revs: [
                                            "2-aaa",
                                            "5-nonexistent",
                                            "3-bbb"
                                        ]
                                    }, (err, res) => {
                                        res.sort((a, b) => {
                                            if (a.ok) {
                                                if (b.ok) {
                                                    let x = a.ok._rev, y = b.ok._rev;
                                                    return x === y ? 0 : x < y ? -1 : 1;
                                                }
                                                return -1;

                                            }
                                            return 1;
                                        });
                                        assert.equal(res.length, 3, "correct number of open_revs");
                                        assert.equal(res[0].ok._rev, "2-aaa", "ok");
                                        assert.equal(res[1].ok._rev, "3-bbb", "ok");
                                        assert.equal(res[2].missing, "5-nonexistent", "ok");
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
        });

        it("Testing get with open_revs and revs", (done) => {
            const db = new PouchDB(dbs.name);
            const docs = [
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-b", value: "foo b" }
                ],
                [{ _id: "foo", _rev: "1-a", value: "foo a" },
                { _id: "foo", _rev: "2-c", value: "foo c" }]
            ];
            testUtils.putTree(db, docs, () => {
                db.get("foo", {
                    open_revs: ["2-b"],
                    revs: true
                }, (err, res) => {
                    const doc = res[0].ok;
                    assert.equal(doc._revisions.ids.length, 2, "got two revs");
                    assert.equal(doc._revisions.ids[0], "b", "got correct rev");
                    done();
                });
            });
        });

        it("Testing get with open_revs on nonexistent doc", (done) => {
            const db = new PouchDB(dbs.name);
            db.get("nonexistent", { open_revs: ["2-whatever"] }, (err, res) => {
                assert.equal(res.length, 1, "just one result");
                assert.equal(res[0].missing, "2-whatever", "just one result");
                db.get("nonexistent", { open_revs: "all" }, (err) => {
                    // CouchDB 1.X doesn't handle this situation correctly
                    // CouchDB 2.0 fixes it (see COUCHDB-2517)
                    testUtils.isCouchDB((isCouchDB) => {
                        if (isCouchDB && !testUtils.isCouchMaster()) {
                            return done();
                        }

                        assert.equal(err.status, 404);
                        done();
                    });
                });
            });
        });

        it("Testing get with open_revs with wrong params", (done) => {
            const db = new PouchDB(dbs.name);
            db.put({ _id: "foo" }, () => {
                db.get("foo", {
                    open_revs: {
                        whatever: "which is",
                        "not an array": "or all string"
                    }
                }, (err) => {
                    const acceptable_errors = ["unknown_error", "bad_request"];
                    assert.notEqual(acceptable_errors.indexOf(err.name), -1, "correct error");
                    // unfortunately!
                    db.get("foo", {
                        open_revs: [
                            "1-almost",
                            "2-correct",
                            "keys"
                        ]
                    }, (err) => {
                        assert.equal(err.name, "bad_request", "correct error");
                        done();
                    });
                });
            });
        });

        it("#5883 Testing with duplicate rev hash", (done) => {
            const db = new PouchDB(dbs.name);
            db.bulkDocs([
                {
                    _id: "foo",
                    _rev: "3-deleted",
                    _deleted: true,
                    _revisions: {
                        start: 3,
                        ids: ["deleted", "0a21b4bd4399b51e144a06b126031edc", "created"]
                    }
                },
                {
                    _id: "foo",
                    _rev: "3-0a21b4bd4399b51e144a06b126031edc",
                    _revisions: {
                        start: 3,
                        ids: ["0a21b4bd4399b51e144a06b126031edc", "updated", "created"]
                    }
                }
            ], {
                    new_edits: false
                }).then(() => {
                    return db.get("foo", { revs: true });
                }).then((doc) => {
                    assert.equal(doc._revisions.start, 3);
                    assert.deepEqual(doc._revisions.ids, ["0a21b4bd4399b51e144a06b126031edc", "updated", "created"]);
                    done();
                }).catch(done);
        });

        it("5857 - open_revs with latest=true", () => {
            const db = new PouchDB(dbs.name);
            let first = null;
            return db.post({ version: "first" })
                .then((info) => {
                    first = info.rev;
                    return db.put({
                        _id: info.id,
                        _rev: info.rev,
                        version: "second"
                    }).then((info) => {
                        return db.get(info.id, {
                            open_revs: [first],
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result[0].ok.version, "second");
                    });
                });
        });

        it("5857 - multiple open_revs for the same branch with latest=true returns one result", () => {
            const db = new PouchDB(dbs.name);
            let first = null;
            return db.post({ version: "first" })
                .then((info) => {
                    first = info.rev;
                    return db.put({
                        _id: info.id,
                        _rev: info.rev,
                        version: "second"
                    }).then((info) => {
                        return db.get(info.id, {
                            open_revs: [first, info.rev],
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result.length, 1);
                        assert.equal(result[0].ok.version, "second");
                    });
                });
        });

        it("5857 - GET old revision with latest=true", () => {
            const db = new PouchDB(dbs.name);
            let first = null;
            return db.post({ version: "first" })
                .then((info) => {
                    first = info.rev;
                    return db.put({
                        _id: info.id,
                        _rev: info.rev,
                        version: "second"
                    }).then((info) => {
                        return db.get(info.id, {
                            rev: first,
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result.version, "second");
                    });
                });
        });

        it("5857 - GET old revision with latest=true, deleted leaf", () => {
            const db = new PouchDB(dbs.name);
            let first = null;
            return db.post({ version: "first" })
                .then((info) => {
                    first = info.rev;
                    return db.put({
                        _id: info.id,
                        _rev: info.rev,
                        _deleted: true,
                        version: "second"
                    }).then((info) => {
                        return db.get(info.id, {
                            rev: first,
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result._deleted, true);
                        assert.equal(result.version, "second");
                    });
                });
        });

        it("5857 - GET losing, old revision with latest=true", () => {
            const db = new PouchDB(dbs.name);
            const doctree = [
                {
                    _id: "mydoc",
                    _rev: "1-a",
                    value: "first",
                    _revisions: {
                        start: 1,
                        ids: [
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b1",
                    value: "x-winning",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c1",
                    value: "y-winning",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b2",
                    value: "x-losing",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c2",
                    value: "y-losing",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c2",
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "4-d1",
                    value: "z-winning",
                    _revisions: {
                        start: 4,
                        ids: [
                            "d1",
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                }
            ];
            return db.bulkDocs(doctree, { new_edits: false })
                .then(() => {
                    return db.get("mydoc", {
                        rev: "2-b2",
                        latest: true
                    });
                }).then((result) => {
                    assert.equal(result._rev, "3-c2");
                });
        });

        it("5857 - GET open_revs losing, old revision with latest=true", () => {
            const db = new PouchDB(dbs.name);
            const doctree = [
                {
                    _id: "mydoc",
                    _rev: "1-a",
                    value: "first",
                    _revisions: {
                        start: 1,
                        ids: [
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b1",
                    value: "x-winning",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c1",
                    value: "y-winning",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b2",
                    value: "x-losing",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c2",
                    value: "y-losing",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c2",
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "4-d1",
                    value: "z-winning",
                    _revisions: {
                        start: 4,
                        ids: [
                            "d1",
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                }
            ];
            return db.bulkDocs(doctree, { new_edits: false })
                .then(() => {
                    return db.get("mydoc", {
                        open_revs: ["2-b2", "3-c2"],
                        latest: true
                    });
                }).then((result) => {
                    assert.equal(result.length, 1);
                    assert.equal(result[0].ok._rev, "3-c2");
                });
        });

        it("5857 - GET open_revs losing and winning branches with latest=true", () => {
            const db = new PouchDB(dbs.name);
            const doctree = [
                {
                    _id: "mydoc",
                    _rev: "1-a",
                    value: "first",
                    _revisions: {
                        start: 1,
                        ids: [
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b1",
                    value: "x-winning",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c1",
                    value: "y-winning",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "2-b2",
                    value: "x-losing",
                    _revisions: {
                        start: 2,
                        ids: [
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "3-c2",
                    value: "y-losing",
                    _revisions: {
                        start: 3,
                        ids: [
                            "c2",
                            "b2",
                            "a"
                        ]
                    }
                },
                {
                    _id: "mydoc",
                    _rev: "4-d1",
                    value: "z-winning",
                    _revisions: {
                        start: 4,
                        ids: [
                            "d1",
                            "c1",
                            "b1",
                            "a"
                        ]
                    }
                }
            ];

            function findRev(results, rev) {
                for (let i = 0, l = results.length; i < l; i++) {
                    const r = results[i];
                    if (r.ok && r.ok._rev === rev) {
                        return r;
                    }
                }
                return null;
            }
            return db.bulkDocs(doctree, { new_edits: false })
                .then(() => {
                    return db.get("mydoc", {
                        open_revs: ["2-b1", "2-b2"],
                        latest: true
                    });
                }).then((result) => {
                    assert.equal(result.length, 2);
                    // result order is not guaranteed
                    assert.exists(findRev(result, "4-d1"));
                    assert.exists(findRev(result, "3-c2"));
                });
        });

        it.skip("These fail due to COUCHDB-3239 and COUCHDB-3240", () => {
            it("5857 - GET latest=true with conflicting parent revs", () => {
                const db = new PouchDB(dbs.name);
                const doctree = [
                    {
                        _id: "mydoc",
                        _rev: "1-a",
                        value: "first",
                        _revisions: {
                            start: 1,
                            ids: [
                                "a"
                            ]
                        }
                    },
                    {
                        _id: "mydoc",
                        _rev: "2-b1",
                        value: "x-winning",
                        _revisions: {
                            start: 2,
                            ids: [
                                "b1",
                                "a"
                            ]
                        }
                    },
                    {
                        _id: "mydoc",
                        _rev: "3-c1",
                        value: "y-winning",
                        _revisions: {
                            start: 3,
                            ids: [
                                "c1",
                                "b1",
                                "a"
                            ]
                        }
                    },
                    {
                        _id: "mydoc",
                        _rev: "2-b2",
                        value: "x-losing",
                        _revisions: {
                            start: 2,
                            ids: [
                                "b2",
                                "a"
                            ]
                        }
                    }
                ];
                return db.bulkDocs(doctree, { new_edits: false })
                    .then(() => {
                        return db.get("mydoc", {
                            rev: "1-a",
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result.length, 1);
                        assert.equal(result[0].ok._rev, "3-c1");
                    });
            });

            it("5857 - GET latest=true with deleted conflict parent revs", () => {
                const db = new PouchDB(dbs.name);
                const doctree = [
                    {
                        _id: "mydoc",
                        _rev: "1-a",
                        value: "first",
                        _revisions: {
                            start: 1,
                            ids: [
                                "a"
                            ]
                        }
                    },
                    {
                        _id: "mydoc",
                        _rev: "2-b1",
                        value: "x-winning",
                        _revisions: {
                            start: 2,
                            ids: [
                                "b1",
                                "a"
                            ]
                        }
                    },
                    {
                        _id: "mydoc",
                        _rev: "2-b2",
                        _deleted: true,
                        value: "x-losing",
                        _revisions: {
                            start: 2,
                            ids: [
                                "b2",
                                "a"
                            ]
                        }
                    }
                ];
                return db.bulkDocs(doctree, { new_edits: false })
                    .then(() => {
                        return db.get("mydoc", {
                            rev: "1-a",
                            latest: true
                        });
                    }).then((result) => {
                        assert.equal(result.length, 1);
                        assert.equal(result[0].ok._rev, "2-b1");
                    });
            });
        });
    });
});
