describe("datetime", "getters and setters", () => {
    before(() => {
        adone.datetime.locale("en");
    });

    it("getters", () => {
        const a = adone.datetime([2011, 9, 12, 6, 7, 8, 9]);
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
        assert.equal(a.milliseconds(), 9, "milliseconds");
    });

    it("getters programmatic", () => {
        const a = adone.datetime([2011, 9, 12, 6, 7, 8, 9]);
        assert.equal(a.get("year"), 2011, "year");
        assert.equal(a.get("month"), 9, "month");
        assert.equal(a.get("date"), 12, "date");
        assert.equal(a.get("day"), 3, "day");
        assert.equal(a.get("hour"), 6, "hour");
        assert.equal(a.get("minute"), 7, "minute");
        assert.equal(a.get("second"), 8, "second");
        assert.equal(a.get("milliseconds"), 9, "milliseconds");

        //actual getters tested elsewhere
        assert.equal(a.get("weekday"), a.weekday(), "weekday");
        assert.equal(a.get("isoWeekday"), a.isoWeekday(), "isoWeekday");
        assert.equal(a.get("week"), a.week(), "week");
        assert.equal(a.get("isoWeek"), a.isoWeek(), "isoWeek");
        assert.equal(a.get("dayOfYear"), a.dayOfYear(), "dayOfYear");

        //getter no longer sets values when passed an object
        assert.equal(adone.datetime([2016, 0, 1]).get({ year: 2015 }).year(), 2016, "getter no longer sets values when passed an object");
    });

    it("setters plural", () => {
        const a = adone.datetime([2011, 9, 12]);

        a.hours(6);
        a.minutes(7);
        a.seconds(8);
        a.milliseconds(9);
        assert.equal(a.days(), 3, "days");
        assert.equal(a.hours(), 6, "hours");
        assert.equal(a.minutes(), 7, "minutes");
        assert.equal(a.seconds(), 8, "seconds");
        assert.equal(a.milliseconds(), 9, "milliseconds");
    });

    it("setters singular", () => {
        const a = adone.datetime();
        a.year(2011);
        a.month(9);
        a.date(12);
        a.hour(6);
        a.minute(7);
        a.second(8);
        a.millisecond(9);
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hour(), 6, "hour");
        assert.equal(a.minute(), 7, "minute");
        assert.equal(a.second(), 8, "second");
        assert.equal(a.millisecond(), 9, "milliseconds");
    });

    it("setters", () => {
        let a = adone.datetime();
        a.year(2011);
        a.month(9);
        a.date(12);
        a.hours(6);
        a.minutes(7);
        a.seconds(8);
        a.milliseconds(9);
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
        assert.equal(a.milliseconds(), 9, "milliseconds");

        // Test month() behavior. See https://github.com/timrwood/adone.datetime/pull/822
        a = adone.datetime("20130531", "YYYYMMDD");
        a.month(3);
        assert.equal(a.month(), 3, "month edge case");
    });

    it("setter programmatic", () => {
        let a = adone.datetime();
        a.set("year", 2011);
        a.set("month", 9);
        a.set("date", 12);
        a.set("hours", 6);
        a.set("minutes", 7);
        a.set("seconds", 8);
        a.set("milliseconds", 9);
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
        assert.equal(a.milliseconds(), 9, "milliseconds");

        // Test month() behavior. See https://github.com/timrwood/adone.datetime/pull/822
        a = adone.datetime("20130531", "YYYYMMDD");
        a.month(3);
        assert.equal(a.month(), 3, "month edge case");
    });

    it("setters programatic with weeks", () => {
        const a = adone.datetime();
        a.set("weekYear", 2001);
        a.set("week", 49);
        a.set("day", 4);

        assert.equal(a.weekYear(), 2001, "weekYear");
        assert.equal(a.week(), 49, "week");
        assert.equal(a.day(), 4, "day");

        a.set("weekday", 1);
        assert.equal(a.weekday(), 1, "weekday");
    });

    it("setters programatic with weeks ISO", () => {
        const a = adone.datetime();
        a.set("isoWeekYear", 2001);
        a.set("isoWeek", 49);
        a.set("isoWeekday", 4);

        assert.equal(a.isoWeekYear(), 2001, "isoWeekYear");
        assert.equal(a.isoWeek(), 49, "isoWeek");
        assert.equal(a.isoWeekday(), 4, "isoWeekday");
    });

    it("setters strings", () => {
        const a = adone.datetime([2012]).locale("en");
        assert.equal(a.clone().day(0).day("Wednesday").day(), 3, "day full name");
        assert.equal(a.clone().day(0).day("Wed").day(), 3, "day short name");
        assert.equal(a.clone().day(0).day("We").day(), 3, "day minimal name");
        assert.equal(a.clone().day(0).day("invalid").day(), 0, "invalid day name");
        assert.equal(a.clone().month(0).month("April").month(), 3, "month full name");
        assert.equal(a.clone().month(0).month("Apr").month(), 3, "month short name");
        assert.equal(a.clone().month(0).month("invalid").month(), 0, "invalid month name");
    });

    it("setters - falsey values", () => {
        const a = adone.datetime();
        // ensure minutes wasn't coincidentally 0 already
        a.minutes(1);
        a.minutes(0);
        assert.equal(a.minutes(), 0, "falsey value");
    });

    it("chaining setters", () => {
        const a = adone.datetime();
        a.year(2011)
         .month(9)
         .date(12)
         .hours(6)
         .minutes(7)
         .seconds(8);
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
    });

    it("setter with multiple unit values", () => {
        const a = adone.datetime();
        a.set({
            year: 2011,
            month: 9,
            date: 12,
            hours: 6,
            minutes: 7,
            seconds: 8,
            milliseconds: 9
        });
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
        assert.equal(a.milliseconds(), 9, "milliseconds");

        const c = adone.datetime([2016, 0, 1]);
        assert.equal(c.set({ weekYear: 2016 }).weekYear(), 2016, "week year correctly sets with object syntax");
        assert.equal(c.set({ quarter: 3 }).quarter(), 3, "quarter sets correctly with object syntax");
    });

    it("day setter", () => {
        let a = adone.datetime([2011, 0, 15]);
        assert.equal(adone.datetime(a).day(0).date(), 9, "set from saturday to sunday");
        assert.equal(adone.datetime(a).day(6).date(), 15, "set from saturday to saturday");
        assert.equal(adone.datetime(a).day(3).date(), 12, "set from saturday to wednesday");

        a = adone.datetime([2011, 0, 9]);
        assert.equal(adone.datetime(a).day(0).date(), 9, "set from sunday to sunday");
        assert.equal(adone.datetime(a).day(6).date(), 15, "set from sunday to saturday");
        assert.equal(adone.datetime(a).day(3).date(), 12, "set from sunday to wednesday");

        a = adone.datetime([2011, 0, 12]);
        assert.equal(adone.datetime(a).day(0).date(), 9, "set from wednesday to sunday");
        assert.equal(adone.datetime(a).day(6).date(), 15, "set from wednesday to saturday");
        assert.equal(adone.datetime(a).day(3).date(), 12, "set from wednesday to wednesday");

        assert.equal(adone.datetime(a).day(-7).date(), 2, "set from wednesday to last sunday");
        assert.equal(adone.datetime(a).day(-1).date(), 8, "set from wednesday to last saturday");
        assert.equal(adone.datetime(a).day(-4).date(), 5, "set from wednesday to last wednesday");

        assert.equal(adone.datetime(a).day(7).date(), 16, "set from wednesday to next sunday");
        assert.equal(adone.datetime(a).day(13).date(), 22, "set from wednesday to next saturday");
        assert.equal(adone.datetime(a).day(10).date(), 19, "set from wednesday to next wednesday");

        assert.equal(adone.datetime(a).day(14).date(), 23, "set from wednesday to second next sunday");
        assert.equal(adone.datetime(a).day(20).date(), 29, "set from wednesday to second next saturday");
        assert.equal(adone.datetime(a).day(17).date(), 26, "set from wednesday to second next wednesday");
    });

    it("object set ordering", () => {
        const a = adone.datetime([2016, 3, 30]);
        assert.equal(a.set({ date: 31, month: 4 }).date(), 31, "setter order automatically arranged by size");
        const b = adone.datetime([2015, 1, 28]);
        assert.equal(b.set({ date: 29, year: 2016 }).format("YYYY-MM-DD"), "2016-02-29", "year is prioritized over date");
        //check a nonexistent time in US isn't set
        const c = adone.datetime([2016, 2, 13]);
        c.set({
            hour: 2,
            minutes: 30,
            date: 14
        });
        assert.equal(c.format("YYYY-MM-DDTHH:mm"), "2016-03-14T02:30", "setting hours, minutes date puts date first allowing time set to work");
    });

    it("string setters", () => {
        const a = adone.datetime();
        a.year("2011");
        a.month("9");
        a.date("12");
        a.hours("6");
        a.minutes("7");
        a.seconds("8");
        a.milliseconds("9");
        assert.equal(a.year(), 2011, "year");
        assert.equal(a.month(), 9, "month");
        assert.equal(a.date(), 12, "date");
        assert.equal(a.day(), 3, "day");
        assert.equal(a.hours(), 6, "hour");
        assert.equal(a.minutes(), 7, "minute");
        assert.equal(a.seconds(), 8, "second");
        assert.equal(a.milliseconds(), 9, "milliseconds");
    });

    it("setters across DST +1", () => {
        const oldUpdateOffset = adone.datetime.updateOffset;
        // Based on a real story somewhere in America/Los_Angeles
        const dstAt = adone.datetime("2014-03-09T02:00:00-08:00").parseZone();
        let m;

        adone.datetime.updateOffset = function (mom, keepTime) {
            if (mom.isBefore(dstAt)) {
                mom.utcOffset(-8, keepTime);
            } else {
                mom.utcOffset(-7, keepTime);
            }
        };

        m = adone.datetime("2014-03-15T00:00:00-07:00").parseZone();
        m.year(2013);
        assert.equal(m.format(), "2013-03-15T00:00:00-08:00", "year across +1");

        m = adone.datetime("2014-03-15T00:00:00-07:00").parseZone();
        m.month(0);
        assert.equal(m.format(), "2014-01-15T00:00:00-08:00", "month across +1");

        m = adone.datetime("2014-03-15T00:00:00-07:00").parseZone();
        m.date(1);
        assert.equal(m.format(), "2014-03-01T00:00:00-08:00", "date across +1");

        m = adone.datetime("2014-03-09T03:05:00-07:00").parseZone();
        m.hour(0);
        assert.equal(m.format(), "2014-03-09T00:05:00-08:00", "hour across +1");

        adone.datetime.updateOffset = oldUpdateOffset;
    });

    it("setters across DST -1", () => {
        const oldUpdateOffset = adone.datetime.updateOffset;
        // Based on a real story somewhere in America/Los_Angeles
        const dstAt = adone.datetime("2014-11-02T02:00:00-07:00").parseZone();
        let m;

        adone.datetime.updateOffset = function (mom, keepTime) {
            if (mom.isBefore(dstAt)) {
                mom.utcOffset(-7, keepTime);
            } else {
                mom.utcOffset(-8, keepTime);
            }
        };

        m = adone.datetime("2014-11-15T00:00:00-08:00").parseZone();
        m.year(2013);
        assert.equal(m.format(), "2013-11-15T00:00:00-07:00", "year across -1");

        m = adone.datetime("2014-11-15T00:00:00-08:00").parseZone();
        m.month(0);
        assert.equal(m.format(), "2014-01-15T00:00:00-07:00", "month across -1");

        m = adone.datetime("2014-11-15T00:00:00-08:00").parseZone();
        m.date(1);
        assert.equal(m.format(), "2014-11-01T00:00:00-07:00", "date across -1");

        m = adone.datetime("2014-11-02T03:30:00-08:00").parseZone();
        m.hour(0);
        assert.equal(m.format(), "2014-11-02T00:30:00-07:00", "hour across -1");

        adone.datetime.updateOffset = oldUpdateOffset;
    });
});
