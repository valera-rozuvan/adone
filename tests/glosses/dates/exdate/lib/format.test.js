describe("format", () => {
    before(() => {
        adone.date.locale("en");
    });

    it("format YY", () => {
        const b = adone.date(new Date(2009, 1, 14, 15, 25, 50, 125));
        assert.equal(b.format("YY"), "09", "YY ---> 09");
    });

    it("format escape brackets", () => {
        adone.date.locale("en");

        const b = adone.date(new Date(2009, 1, 14, 15, 25, 50, 125));
        assert.equal(b.format("[day]"), "day", "Single bracket");
        assert.equal(b.format("[day] YY [YY]"), "day 09 YY", "Double bracket");
        assert.equal(b.format("[YY"), "[09", "Un-ended bracket");
        assert.equal(b.format("[[YY]]"), "[YY]", "Double nested brackets");
        assert.equal(b.format("[[]"), "[", "Escape open bracket");
        assert.equal(b.format("[Last]"), "Last", "localized tokens");
        assert.equal(b.format("[L] L"), "L 02/14/2009", "localized tokens with escaped localized tokens");
        assert.equal(b.format("[L LL LLL LLLL aLa]"), "L LL LLL LLLL aLa", "localized tokens with escaped localized tokens");
        assert.equal(b.format("[LLL] LLL"), "LLL February 14, 2009 3:25 PM", "localized tokens with escaped localized tokens (recursion)");
        assert.equal(b.format("YYYY[\n]DD[\n]"), "2009\n14\n", "Newlines");
    });

    it("handle negative years", () => {
        adone.date.locale("en");
        assert.equal(adone.date.utc().year(-1).format("YY"), "-01", "YY with negative year");
        assert.equal(adone.date.utc().year(-1).format("YYYY"), "-0001", "YYYY with negative year");
        assert.equal(adone.date.utc().year(-12).format("YY"), "-12", "YY with negative year");
        assert.equal(adone.date.utc().year(-12).format("YYYY"), "-0012", "YYYY with negative year");
        assert.equal(adone.date.utc().year(-123).format("YY"), "-23", "YY with negative year");
        assert.equal(adone.date.utc().year(-123).format("YYYY"), "-0123", "YYYY with negative year");
        assert.equal(adone.date.utc().year(-1234).format("YY"), "-34", "YY with negative year");
        assert.equal(adone.date.utc().year(-1234).format("YYYY"), "-1234", "YYYY with negative year");
        assert.equal(adone.date.utc().year(-12345).format("YY"), "-45", "YY with negative year");
        assert.equal(adone.date.utc().year(-12345).format("YYYY"), "-12345", "YYYY with negative year");
    });

    it("format milliseconds", () => {
        const b = adone.date(new Date(2009, 1, 14, 15, 25, 50, 123));
        assert.equal(b.format("S"), "1", "Deciseconds");
        assert.equal(b.format("SS"), "12", "Centiseconds");
        assert.equal(b.format("SSS"), "123", "Milliseconds");
        b.milliseconds(789);
        assert.equal(b.format("S"), "7", "Deciseconds");
        assert.equal(b.format("SS"), "78", "Centiseconds");
        assert.equal(b.format("SSS"), "789", "Milliseconds");
    });

    it("format timezone", () => {
        const b = adone.date(new Date(2010, 1, 14, 15, 25, 50, 125));
        assert.ok(b.format("Z").match(/^[\+\-]\d\d:\d\d$/), b.format("Z") + " should be something like '+07:30'");
        assert.ok(b.format("ZZ").match(/^[\+\-]\d{4}$/), b.format("ZZ") + " should be something like '+0700'");
    });

    it("format multiple with utc offset", () => {
        const b = adone.date("2012-10-08 -1200", ["YYYY-MM-DD HH:mm ZZ", "YYYY-MM-DD ZZ", "YYYY-MM-DD"]);
        assert.equal(b.format("YYYY-MM"), "2012-10", "Parsing multiple formats should not crash with different sized formats");
    });

    it("isDST", () => {
        const janOffset = new Date(2011, 0, 1).getTimezoneOffset();
        const julOffset = new Date(2011, 6, 1).getTimezoneOffset();
        const janIsDst = janOffset < julOffset;
        const julIsDst = julOffset < janOffset;
        const jan1 = adone.date([2011]);
        const jul1 = adone.date([2011, 6]);

        if (janIsDst && julIsDst) {
            assert.ok(0, "January and July cannot both be in DST");
            assert.ok(0, "January and July cannot both be in DST");
        } else if (janIsDst) {
            assert.ok(jan1.isDST(), "January 1 is DST");
            assert.ok(!jul1.isDST(), "July 1 is not DST");
        } else if (julIsDst) {
            assert.ok(!jan1.isDST(), "January 1 is not DST");
            assert.ok(jul1.isDST(), "July 1 is DST");
        } else {
            assert.ok(!jan1.isDST(), "January 1 is not DST");
            assert.ok(!jul1.isDST(), "July 1 is not DST");
        }
    });

    it("unix timestamp", () => {
        let m = adone.date("1234567890.123", "X");
        assert.equal(m.format("X"), "1234567890", "unix timestamp without milliseconds");
        assert.equal(m.format("X.S"), "1234567890.1", "unix timestamp with deciseconds");
        assert.equal(m.format("X.SS"), "1234567890.12", "unix timestamp with centiseconds");
        assert.equal(m.format("X.SSS"), "1234567890.123", "unix timestamp with milliseconds");

        m = adone.date(1234567890.123, "X");
        assert.equal(m.format("X"), "1234567890", "unix timestamp as integer");
    });

    it("unix offset milliseconds", () => {
        let m = adone.date("1234567890123", "x");
        assert.equal(m.format("x"), "1234567890123", "unix offset in milliseconds");

        m = adone.date(1234567890123, "x");
        assert.equal(m.format("x"), "1234567890123", "unix offset in milliseconds as integer");
    });

    it("utcOffset sanity checks", () => {
        assert.equal(adone.date().utcOffset() % 15, 0,
                "utc offset should be a multiple of 15 (was " + adone.date().utcOffset() + ")");

        assert.equal(adone.date().utcOffset(), -(new Date()).getTimezoneOffset(),
            "utcOffset should return the opposite of getTimezoneOffset");
    });

    it("default format", () => {
        const isoRegex = /\d{4}.\d\d.\d\dT\d\d.\d\d.\d\d[\+\-]\d\d:\d\d/;
        assert.ok(isoRegex.exec(adone.date().format()), "default format (" + adone.date().format() + ") should match ISO");
    });

    it("default UTC format", () => {
        const isoRegex = /\d{4}.\d\d.\d\dT\d\d.\d\d.\d\dZ/;
        assert.ok(isoRegex.exec(adone.date.utc().format()), "default UTC format (" + adone.date.utc().format() + ") should match ISO");
    });

    it("toJSON", () => {
        const supportsJson = typeof JSON !== "undefined" && JSON.stringify && JSON.stringify.call;
        const date = adone.date("2012-10-09T21:30:40.678+0100");

        assert.equal(date.toJSON(), "2012-10-09T20:30:40.678Z", "should output ISO8601 on adone.date.fn.toJSON");

        if (supportsJson) {
            assert.equal(JSON.stringify({
                date
            }), "{\"date\":\"2012-10-09T20:30:40.678Z\"}", "should output ISO8601 on JSON.stringify");
        }
    });

    it("toISOString", () => {
        let date = adone.date.utc("2012-10-09T20:30:40.678");

        assert.equal(date.toISOString(), "2012-10-09T20:30:40.678Z", "should output ISO8601 on adone.date.fn.toISOString");

        // big years
        date = adone.date.utc("+020123-10-09T20:30:40.678");
        assert.equal(date.toISOString(), "+020123-10-09T20:30:40.678Z", "ISO8601 format on big positive year");
        // negative years
        date = adone.date.utc("-000001-10-09T20:30:40.678");
        assert.equal(date.toISOString(), "-000001-10-09T20:30:40.678Z", "ISO8601 format on negative year");
        // big negative years
        date = adone.date.utc("-020123-10-09T20:30:40.678");
        assert.equal(date.toISOString(), "-020123-10-09T20:30:40.678Z", "ISO8601 format on big negative year");
    });

    // See https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
    it("inspect", () => {
        function roundtrip(m) {
            /*jshint evil:true */
            return adone.std.vm.runInNewContext(m.inspect(), { adone });
        }
        function testInspect(date, string) {
            const inspected = date.inspect();
            assert.equal(inspected, string);
            assert.ok(date.isSame(roundtrip(date)), "Tried to parse " + inspected);
        }

        testInspect(
            adone.date("2012-10-09T20:30:40.678"),
            "adone.date(\"2012-10-09T20:30:40.678\")"
        );
        testInspect(
            adone.date("+020123-10-09T20:30:40.678"),
            "adone.date(\"+020123-10-09T20:30:40.678\")"
        );
        testInspect(
            adone.date.utc("2012-10-09T20:30:40.678"),
            "adone.date.utc(\"2012-10-09T20:30:40.678+00:00\")"
        );
        testInspect(
            adone.date.utc("+020123-10-09T20:30:40.678"),
            "adone.date.utc(\"+020123-10-09T20:30:40.678+00:00\")"
        );
        testInspect(
            adone.date.utc("+020123-10-09T20:30:40.678+01:00"),
            "adone.date.utc(\"+020123-10-09T19:30:40.678+00:00\")"
        );
        testInspect(
            adone.date.parseZone("2016-06-11T17:30:40.678+0430"),
            "adone.date.parseZone(\"2016-06-11T17:30:40.678+04:30\")"
        );
        testInspect(
            adone.date.parseZone("+112016-06-11T17:30:40.678+0430"),
            "adone.date.parseZone(\"+112016-06-11T17:30:40.678+04:30\")"
        );

        assert.equal(
            adone.date(new Date("nope")).inspect(),
            "adone.date.invalid(/* Invalid Date */)"
        );
        assert.equal(
            adone.date("blah", "YYYY").inspect(),
            "adone.date.invalid(/* blah */)"
        );
    });

    it("long years", () => {
        assert.equal(adone.date.utc().year(2).format("YYYYYY"), "+000002", "small year with YYYYYY");
        assert.equal(adone.date.utc().year(2012).format("YYYYYY"), "+002012", "regular year with YYYYYY");
        assert.equal(adone.date.utc().year(20123).format("YYYYYY"), "+020123", "big year with YYYYYY");

        assert.equal(adone.date.utc().year(-1).format("YYYYYY"), "-000001", "small negative year with YYYYYY");
        assert.equal(adone.date.utc().year(-2012).format("YYYYYY"), "-002012", "negative year with YYYYYY");
        assert.equal(adone.date.utc().year(-20123).format("YYYYYY"), "-020123", "big negative year with YYYYYY");
    });

    it("iso week formats", () => {
        // http://en.wikipedia.org/wiki/ISO_week_date
        const cases = {
            "2005-01-02": "2004-53",
            "2005-12-31": "2005-52",
            "2007-01-01": "2007-01",
            "2007-12-30": "2007-52",
            "2007-12-31": "2008-01",
            "2008-01-01": "2008-01",
            "2008-12-28": "2008-52",
            "2008-12-29": "2009-01",
            "2008-12-30": "2009-01",
            "2008-12-31": "2009-01",
            "2009-01-01": "2009-01",
            "2009-12-31": "2009-53",
            "2010-01-01": "2009-53",
            "2010-01-02": "2009-53",
            "2010-01-03": "2009-53",
            "404-12-31": "0404-53",
            "405-12-31": "0405-52"
        };

        let isoWeek;
        let formatted2;
        let formatted1;

        for (const i in cases) {
            isoWeek = cases[i].split("-").pop();
            formatted2 = adone.date(i, "YYYY-MM-DD").format("WW");
            assert.equal(isoWeek, formatted2, i + ": WW should be " + isoWeek + ", but " + formatted2);
            isoWeek = isoWeek.replace(/^0+/, "");
            formatted1 = adone.date(i, "YYYY-MM-DD").format("W");
            assert.equal(isoWeek, formatted1, i + ": W should be " + isoWeek + ", but " + formatted1);
        }
    });

    it("iso week year formats", () => {
        // http://en.wikipedia.org/wiki/ISO_week_date
        const cases = {
            "2005-01-02": "2004-53",
            "2005-12-31": "2005-52",
            "2007-01-01": "2007-01",
            "2007-12-30": "2007-52",
            "2007-12-31": "2008-01",
            "2008-01-01": "2008-01",
            "2008-12-28": "2008-52",
            "2008-12-29": "2009-01",
            "2008-12-30": "2009-01",
            "2008-12-31": "2009-01",
            "2009-01-01": "2009-01",
            "2009-12-31": "2009-53",
            "2010-01-01": "2009-53",
            "2010-01-02": "2009-53",
            "2010-01-03": "2009-53",
            "404-12-31": "0404-53",
            "405-12-31": "0405-52"
        };

        let isoWeekYear;
        let formatted5;
        let formatted4;
        let formatted2;

        for (const i in cases) {
            isoWeekYear = cases[i].split("-")[0];
            formatted5 = adone.date(i, "YYYY-MM-DD").format("GGGGG");
            assert.equal("0" + isoWeekYear, formatted5, i + ": GGGGG should be " + isoWeekYear + ", but " + formatted5);
            formatted4 = adone.date(i, "YYYY-MM-DD").format("GGGG");
            assert.equal(isoWeekYear, formatted4, i + ": GGGG should be " + isoWeekYear + ", but " + formatted4);
            formatted2 = adone.date(i, "YYYY-MM-DD").format("GG");
            assert.equal(isoWeekYear.slice(2, 4), formatted2, i + ": GG should be " + isoWeekYear + ", but " + formatted2);
        }
    });

    it("week year formats", () => {
        // http://en.wikipedia.org/wiki/ISO_week_date
        const cases = {
            "2005-01-02": "2004-53",
            "2005-12-31": "2005-52",
            "2007-01-01": "2007-01",
            "2007-12-30": "2007-52",
            "2007-12-31": "2008-01",
            "2008-01-01": "2008-01",
            "2008-12-28": "2008-52",
            "2008-12-29": "2009-01",
            "2008-12-30": "2009-01",
            "2008-12-31": "2009-01",
            "2009-01-01": "2009-01",
            "2009-12-31": "2009-53",
            "2010-01-01": "2009-53",
            "2010-01-02": "2009-53",
            "2010-01-03": "2009-53",
            "404-12-31": "0404-53",
            "405-12-31": "0405-52"
        };

        let isoWeekYear;
        let formatted5;
        let formatted4;
        let formatted2;

        adone.date.defineLocale("dow:1,doy:4", {week: {dow: 1, doy: 4}});

        for (const i in cases) {
            isoWeekYear = cases[i].split("-")[0];
            formatted5 = adone.date(i, "YYYY-MM-DD").format("ggggg");
            assert.equal("0" + isoWeekYear, formatted5, i + ": ggggg should be " + isoWeekYear + ", but " + formatted5);
            formatted4 = adone.date(i, "YYYY-MM-DD").format("gggg");
            assert.equal(isoWeekYear, formatted4, i + ": gggg should be " + isoWeekYear + ", but " + formatted4);
            formatted2 = adone.date(i, "YYYY-MM-DD").format("gg");
            assert.equal(isoWeekYear.slice(2, 4), formatted2, i + ": gg should be " + isoWeekYear + ", but " + formatted2);
        }
        adone.date.defineLocale("dow:1,doy:4", null);
    });

    it("iso weekday formats", () => {
        assert.equal(adone.date([1985, 1,  4]).format("E"), "1", "Feb  4 1985 is Monday    -- 1st day");
        assert.equal(adone.date([2029, 8, 18]).format("E"), "2", "Sep 18 2029 is Tuesday   -- 2nd day");
        assert.equal(adone.date([2013, 3, 24]).format("E"), "3", "Apr 24 2013 is Wednesday -- 3rd day");
        assert.equal(adone.date([2015, 2,  5]).format("E"), "4", "Mar  5 2015 is Thursday  -- 4th day");
        assert.equal(adone.date([1970, 0,  2]).format("E"), "5", "Jan  2 1970 is Friday    -- 5th day");
        assert.equal(adone.date([2001, 4, 12]).format("E"), "6", "May 12 2001 is Saturday  -- 6th day");
        assert.equal(adone.date([2000, 0,  2]).format("E"), "7", "Jan  2 2000 is Sunday    -- 7th day");
    });

    it("weekday formats", () => {
        adone.date.defineLocale("dow: 3,doy: 5", {week: {dow: 3, doy: 5}});
        assert.equal(adone.date([1985, 1,  6]).format("e"), "0", "Feb  6 1985 is Wednesday -- 0th day");
        assert.equal(adone.date([2029, 8, 20]).format("e"), "1", "Sep 20 2029 is Thursday  -- 1st day");
        assert.equal(adone.date([2013, 3, 26]).format("e"), "2", "Apr 26 2013 is Friday    -- 2nd day");
        assert.equal(adone.date([2015, 2,  7]).format("e"), "3", "Mar  7 2015 is Saturday  -- 3nd day");
        assert.equal(adone.date([1970, 0,  4]).format("e"), "4", "Jan  4 1970 is Sunday    -- 4th day");
        assert.equal(adone.date([2001, 4, 14]).format("e"), "5", "May 14 2001 is Monday    -- 5th day");
        assert.equal(adone.date([2000, 0,  4]).format("e"), "6", "Jan  4 2000 is Tuesday   -- 6th day");
        adone.date.defineLocale("dow: 3,doy: 5", null);
    });

    it("toString is just human readable format", () => {
        const b = adone.date(new Date(2009, 1, 5, 15, 25, 50, 125));
        assert.equal(b.toString(), b.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ"));
    });

    it("toJSON skips postformat", () => {
        adone.date.defineLocale("postformat", {
            postformat (s) {
                s.replace(/./g, "X");
            }
        });
        assert.equal(adone.date.utc([2000, 0, 1]).toJSON(), "2000-01-01T00:00:00.000Z", "toJSON doesn't postformat");
        adone.date.defineLocale("postformat", null);
    });

    it("calendar day timezone", () => {
        adone.date.locale("en");
        const zones = [60, -60, 90, -90, 360, -360, 720, -720];
        const b = adone.date().utc().startOf("day").subtract({m: 1});
        const c = adone.date().local().startOf("day").subtract({m: 1});
        const d = adone.date().local().startOf("day").subtract({d: 2});

        for (let i = 0; i < zones.length; ++i) {
            const z = zones[i];
            const a = adone.date().utcOffset(z).startOf("day").subtract({m: 1});
            assert.equal(adone.date(a).utcOffset(z).calendar(), "Yesterday at 11:59 PM",
                         "Yesterday at 11:59 PM, not Today, or the wrong time, tz = " + z);
        }

        assert.equal(adone.date(b).utc().calendar(), "Yesterday at 11:59 PM", "Yesterday at 11:59 PM, not Today, or the wrong time");
        assert.equal(adone.date(c).local().calendar(), "Yesterday at 11:59 PM", "Yesterday at 11:59 PM, not Today, or the wrong time");
        assert.equal(adone.date(c).local().calendar(d), "Tomorrow at 11:59 PM", "Tomorrow at 11:59 PM, not Yesterday, or the wrong time");
    });

    it("calendar with custom formats", () => {
        assert.equal(adone.date().calendar(null, {sameDay: "[Today]"}), "Today", "Today");
        assert.equal(adone.date().add(1, "days").calendar(null, {nextDay: "[Tomorrow]"}), "Tomorrow", "Tomorrow");
        assert.equal(adone.date([1985, 1, 4]).calendar(null, {sameElse: "YYYY-MM-DD"}), "1985-02-04", "Else");
    });

    it("invalid", () => {
        assert.equal(adone.date.invalid().format(), "Invalid date");
        assert.equal(adone.date.invalid().format("YYYY-MM-DD"), "Invalid date");
    });

    it("quarter formats", () => {
        assert.equal(adone.date([1985, 1,  4]).format("Q"), "1", "Feb  4 1985 is Q1");
        assert.equal(adone.date([2029, 8, 18]).format("Q"), "3", "Sep 18 2029 is Q3");
        assert.equal(adone.date([2013, 3, 24]).format("Q"), "2", "Apr 24 2013 is Q2");
        assert.equal(adone.date([2015, 2,  5]).format("Q"), "1", "Mar  5 2015 is Q1");
        assert.equal(adone.date([1970, 0,  2]).format("Q"), "1", "Jan  2 1970 is Q1");
        assert.equal(adone.date([2001, 11, 12]).format("Q"), "4", "Dec 12 2001 is Q4");
        assert.equal(adone.date([2000, 0,  2]).format("[Q]Q-YYYY"), "Q1-2000", "Jan  2 2000 is Q1");
    });

    it("quarter ordinal formats", () => {
        assert.equal(adone.date([1985, 1, 4]).format("Qo"), "1st", "Feb 4 1985 is 1st quarter");
        assert.equal(adone.date([2029, 8, 18]).format("Qo"), "3rd", "Sep 18 2029 is 3rd quarter");
        assert.equal(adone.date([2013, 3, 24]).format("Qo"), "2nd", "Apr 24 2013 is 2nd quarter");
        assert.equal(adone.date([2015, 2,  5]).format("Qo"), "1st", "Mar  5 2015 is 1st quarter");
        assert.equal(adone.date([1970, 0,  2]).format("Qo"), "1st", "Jan  2 1970 is 1st quarter");
        assert.equal(adone.date([2001, 11, 12]).format("Qo"), "4th", "Dec 12 2001 is 4th quarter");
        assert.equal(adone.date([2000, 0,  2]).format("Qo [quarter] YYYY"), "1st quarter 2000", "Jan  2 2000 is 1st quarter");
    });

    it("milliseconds", () => {
        const m = adone.date("123", "SSS");

        assert.equal(m.format("S"), "1");
        assert.equal(m.format("SS"), "12");
        assert.equal(m.format("SSS"), "123");
        assert.equal(m.format("SSSS"), "1230");
        assert.equal(m.format("SSSSS"), "12300");
        assert.equal(m.format("SSSSSS"), "123000");
        assert.equal(m.format("SSSSSSS"), "1230000");
        assert.equal(m.format("SSSSSSSS"), "12300000");
        assert.equal(m.format("SSSSSSSSS"), "123000000");
    });

    it("hmm and hmmss", () => {
        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("hmm"), "1234");
        assert.equal(adone.date("01:34:56", "HH:mm:ss").format("hmm"), "134");
        assert.equal(adone.date("13:34:56", "HH:mm:ss").format("hmm"), "134");

        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("hmmss"), "123456");
        assert.equal(adone.date("01:34:56", "HH:mm:ss").format("hmmss"), "13456");
        assert.equal(adone.date("13:34:56", "HH:mm:ss").format("hmmss"), "13456");
    });

    it("Hmm and Hmmss", () => {
        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("Hmm"), "1234");
        assert.equal(adone.date("01:34:56", "HH:mm:ss").format("Hmm"), "134");
        assert.equal(adone.date("13:34:56", "HH:mm:ss").format("Hmm"), "1334");

        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("Hmmss"), "123456");
        assert.equal(adone.date("01:34:56", "HH:mm:ss").format("Hmmss"), "13456");
        assert.equal(adone.date("08:34:56", "HH:mm:ss").format("Hmmss"), "83456");
        assert.equal(adone.date("18:34:56", "HH:mm:ss").format("Hmmss"), "183456");
    });

    it("k and kk", () => {
        assert.equal(adone.date("01:23:45", "HH:mm:ss").format("k"), "1");
        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("k"), "12");
        assert.equal(adone.date("01:23:45", "HH:mm:ss").format("kk"), "01");
        assert.equal(adone.date("12:34:56", "HH:mm:ss").format("kk"), "12");
        assert.equal(adone.date("00:34:56", "HH:mm:ss").format("kk"), "24");
        assert.equal(adone.date("00:00:00", "HH:mm:ss").format("kk"), "24");
    });

    it("Y token", () => {
        assert.equal(adone.date("2010-01-01", "YYYY-MM-DD", true).format("Y"), "2010", "format 2010 with Y");
        assert.equal(adone.date("-123-01-01", "Y-MM-DD", true).format("Y"), "-123", "format -123 with Y");
        assert.equal(adone.date("12345-01-01", "Y-MM-DD", true).format("Y"), "+12345", "format 12345 with Y");
        assert.equal(adone.date("0-01-01", "Y-MM-DD", true).format("Y"), "0", "format 0 with Y");
        assert.equal(adone.date("1-01-01", "Y-MM-DD", true).format("Y"), "1", "format 1 with Y");
        assert.equal(adone.date("9999-01-01", "Y-MM-DD", true).format("Y"), "9999", "format 9999 with Y");
        assert.equal(adone.date("10000-01-01", "Y-MM-DD", true).format("Y"), "+10000", "format 10000 with Y");
    });
});
