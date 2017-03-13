import check from "../helpers/check_redis";

skip(check);

describe("glosses", "databases", "redis", "ready_check", () => {
    const { database: { redis: { Redis } } } = adone;

    afterEach((done) => {
        const redis = new Redis();
        redis.flushall(() => {
            redis.script("flush", () => {
                redis.disconnect();
                done();
            });
        });
    });

    it("should retry when redis is not ready", (done) => {
        const redis = new Redis({ lazyConnect: true });

        stub(redis, "info").callsFake((callback) => {
            callback(null, "loading:1\r\nloading_eta_seconds:7");
        });
        stub(global, "setTimeout").callsFake((body, ms) => {
            if (ms === 7000) {
                redis.info.restore();
                global.setTimeout.restore();
                redis.disconnect();
                done();
            }
        });
        redis.connect();
    });

    it("should reconnect when info return a error", (done) => {
        const redis = new Redis({
            lazyConnect: true,
            retryStrategy () {
                redis.disconnect();
                done();
                return;
            }
        });

        stub(redis, "info").callsFake((callback) => {
            callback(new Error("info error"));
        });

        redis.connect();
    });
});
