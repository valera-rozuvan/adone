import { createConnection } from "../../common";

describe("database", "mysql", "functional", "connection", "datetime", () => {
    const date = new Date("1990-01-01 08:15:11");
    const date1 = new Date("2000-03-03 08:15:11");
    const date2 = "2010-12-10 14:12:09.019473";
    const date3 = null;

    let connection = null;
    let connection1 = null;

    before(async () => {
        connection = await createConnection();
        await connection.query(`set time_zone = '${adone.datetime().format("Z")}'`);
        await connection.query("CREATE TEMPORARY TABLE t (d1 DATE, d2 DATETIME)");
        await connection.query("INSERT INTO t set d1=?, d2=?", [date, date]);

        connection1 = await createConnection({ dateStrings: true });
        await connection1.query("CREATE TEMPORARY TABLE t (d1 DATE, d2 TIMESTAMP, d3 DATETIME, d4 DATETIME)");
        await connection1.query("INSERT INTO t set d1=?, d2=?, d3=?, d4=?", [date, date1, date2, date3]);
    });

    after(async () => {
        if (connection) {
            await connection.end();
        }
        if (connection1) {
            await connection1.end();
        }
    });

    it("should return a date", async () => {
        const t = adone.datetime.unix(234125434);
        const [rows] = await connection.execute("select from_unixtime(?) t", [t.unix()]);
        expect(rows[0].t - t.toDate()).to.be.equal(0);
    });

    it("should pass a date and return a date", async () => {
        const [rows] = await connection.execute(
            "select from_unixtime(?) t",
            [(Number(date)).valueOf() / 1000]
        );
        expect(rows[0].t).to.be.a("date");
        expect(rows[0].t.getDate()).to.be.equal(date.getDate());
        expect(rows[0].t.getHours()).to.be.equal(date.getHours());
        expect(rows[0].t.getMinutes()).to.be.equal(date.getMinutes());
        expect(rows[0].t.getSeconds()).to.be.equal(date.getSeconds());
    });

    it("should return stored date as an object", async () => {
        const [rows] = await connection.execute("select * from t");
        const d = new Date(date);
        // should be a date
        d.setHours(0);
        d.setMinutes(0);
        d.setSeconds(0);
        expect(rows[0].d1.getTime()).to.be.equal(d.getTime());
        expect(rows[0].d2.getTime()).to.be.equal(date.getTime());
    });

    it("should return date(time)s as string or nulls", async () => {
        const [rows] = await connection1.execute("select * from t");
        expect(rows).to.be.deep.equal([{
            d1: "1990-01-01",
            d2: "2000-03-03 08:15:11",
            d3: "2010-12-10 14:12:09",
            d4: null
        }]);
    });
});
