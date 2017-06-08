import commonLocaleTests from "../helpers/common-locale";
describe("datetime", "locale", "pt-br", () => {
    commonLocaleTests("pt-br");

    beforeEach(() => {
        adone.datetime.locale("pt-br");
    });

    it("parse", () => {
        const tests = "janeiro jan_fevereiro fev_março mar_abril abr_maio mai_junho jun_julho jul_agosto ago_setembro set_outubro out_novembro nov_dezembro dez".split("_");
        let i;

        function equalTest(input, mmm, i) {
            assert.equal(adone.datetime(input, mmm).month(), i, `${input} should be month ${i + 1}`);
        }

        for (i = 0; i < 12; i++) {
            tests[i] = tests[i].split(" ");
            equalTest(tests[i][0], "MMM", i);
            equalTest(tests[i][1], "MMM", i);
            equalTest(tests[i][0], "MMMM", i);
            equalTest(tests[i][1], "MMMM", i);
            equalTest(tests[i][0].toLocaleLowerCase(), "MMMM", i);
            equalTest(tests[i][1].toLocaleLowerCase(), "MMMM", i);
            equalTest(tests[i][0].toLocaleUpperCase(), "MMMM", i);
            equalTest(tests[i][1].toLocaleUpperCase(), "MMMM", i);
        }
    });

    it("format", () => {
        const a = [
            ["dddd, MMMM Do YYYY, h:mm:ss a", "Domingo, Fevereiro 14º 2010, 3:25:50 pm"],
            ["ddd, hA", "Dom, 3PM"],
            ["M Mo MM MMMM MMM", "2 2º 02 Fevereiro Fev"],
            ["YYYY YY", "2010 10"],
            ["D Do DD", "14 14º 14"],
            ["d do dddd ddd", "0 0º Domingo Dom"],
            ["DDD DDDo DDDD", "45 45º 045"],
            ["w wo ww", "8 8º 08"],
            ["h hh", "3 03"],
            ["H HH", "15 15"],
            ["m mm", "25 25"],
            ["s ss", "50 50"],
            ["a A", "pm PM"],
            ["[the] DDDo [day of the year]", "the 45º day of the year"],
            ["LTS", "15:25:50"],
            ["L", "14/02/2010"],
            ["LL", "14 de Fevereiro de 2010"],
            ["LLL", "14 de Fevereiro de 2010 às 15:25"],
            ["LLLL", "Domingo, 14 de Fevereiro de 2010 às 15:25"],
            ["l", "14/2/2010"],
            ["ll", "14 de Fev de 2010"],
            ["lll", "14 de Fev de 2010 às 15:25"],
            ["llll", "Dom, 14 de Fev de 2010 às 15:25"]
        ];
        const b = adone.datetime(new Date(2010, 1, 14, 15, 25, 50, 125));
        let i;

        for (i = 0; i < a.length; i++) {
            assert.equal(b.format(a[i][0]), a[i][1], `${a[i][0]} ---> ${a[i][1]}`);
        }
    });

    it("format ordinal", () => {
        assert.equal(adone.datetime([2011, 0, 1]).format("DDDo"), "1º", "1º");
        assert.equal(adone.datetime([2011, 0, 2]).format("DDDo"), "2º", "2º");
        assert.equal(adone.datetime([2011, 0, 3]).format("DDDo"), "3º", "3º");
        assert.equal(adone.datetime([2011, 0, 4]).format("DDDo"), "4º", "4º");
        assert.equal(adone.datetime([2011, 0, 5]).format("DDDo"), "5º", "5º");
        assert.equal(adone.datetime([2011, 0, 6]).format("DDDo"), "6º", "6º");
        assert.equal(adone.datetime([2011, 0, 7]).format("DDDo"), "7º", "7º");
        assert.equal(adone.datetime([2011, 0, 8]).format("DDDo"), "8º", "8º");
        assert.equal(adone.datetime([2011, 0, 9]).format("DDDo"), "9º", "9º");
        assert.equal(adone.datetime([2011, 0, 10]).format("DDDo"), "10º", "10º");

        assert.equal(adone.datetime([2011, 0, 11]).format("DDDo"), "11º", "11º");
        assert.equal(adone.datetime([2011, 0, 12]).format("DDDo"), "12º", "12º");
        assert.equal(adone.datetime([2011, 0, 13]).format("DDDo"), "13º", "13º");
        assert.equal(adone.datetime([2011, 0, 14]).format("DDDo"), "14º", "14º");
        assert.equal(adone.datetime([2011, 0, 15]).format("DDDo"), "15º", "15º");
        assert.equal(adone.datetime([2011, 0, 16]).format("DDDo"), "16º", "16º");
        assert.equal(adone.datetime([2011, 0, 17]).format("DDDo"), "17º", "17º");
        assert.equal(adone.datetime([2011, 0, 18]).format("DDDo"), "18º", "18º");
        assert.equal(adone.datetime([2011, 0, 19]).format("DDDo"), "19º", "19º");
        assert.equal(adone.datetime([2011, 0, 20]).format("DDDo"), "20º", "20º");

        assert.equal(adone.datetime([2011, 0, 21]).format("DDDo"), "21º", "21º");
        assert.equal(adone.datetime([2011, 0, 22]).format("DDDo"), "22º", "22º");
        assert.equal(adone.datetime([2011, 0, 23]).format("DDDo"), "23º", "23º");
        assert.equal(adone.datetime([2011, 0, 24]).format("DDDo"), "24º", "24º");
        assert.equal(adone.datetime([2011, 0, 25]).format("DDDo"), "25º", "25º");
        assert.equal(adone.datetime([2011, 0, 26]).format("DDDo"), "26º", "26º");
        assert.equal(adone.datetime([2011, 0, 27]).format("DDDo"), "27º", "27º");
        assert.equal(adone.datetime([2011, 0, 28]).format("DDDo"), "28º", "28º");
        assert.equal(adone.datetime([2011, 0, 29]).format("DDDo"), "29º", "29º");
        assert.equal(adone.datetime([2011, 0, 30]).format("DDDo"), "30º", "30º");

        assert.equal(adone.datetime([2011, 0, 31]).format("DDDo"), "31º", "31º");
    });

    it("format month", () => {
        const expected = "Janeiro Jan_Fevereiro Fev_Março Mar_Abril Abr_Maio Mai_Junho Jun_Julho Jul_Agosto Ago_Setembro Set_Outubro Out_Novembro Nov_Dezembro Dez".split("_");
        let i;

        for (i = 0; i < expected.length; i++) {
            assert.equal(adone.datetime([2011, i, 1]).format("MMMM MMM"), expected[i], expected[i]);
        }
    });

    it("format week", () => {
        const expected = "Domingo Dom Do_Segunda-feira Seg 2ª_Terça-feira Ter 3ª_Quarta-feira Qua 4ª_Quinta-feira Qui 5ª_Sexta-feira Sex 6ª_Sábado Sáb Sá".split("_");
        let i;

        for (i = 0; i < expected.length; i++) {
            assert.equal(adone.datetime([2011, 0, 2 + i]).format("dddd ddd dd"), expected[i], expected[i]);
        }
    });

    it("from", () => {
        const start = adone.datetime([2007, 1, 28]);
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            s: 44
        }), true), "poucos segundos", "44 seconds = seconds");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            s: 45
        }), true), "um minuto", "45 seconds = a minute");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            s: 89
        }), true), "um minuto", "89 seconds = a minute");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            s: 90
        }), true), "2 minutos", "90 seconds = 2 minutes");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            m: 44
        }), true), "44 minutos", "44 minutes = 44 minutes");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            m: 45
        }), true), "uma hora", "45 minutes = an hour");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            m: 89
        }), true), "uma hora", "89 minutes = an hour");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            m: 90
        }), true), "2 horas", "90 minutes = 2 hours");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            h: 5
        }), true), "5 horas", "5 hours = 5 hours");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            h: 21
        }), true), "21 horas", "21 hours = 21 hours");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            h: 22
        }), true), "um dia", "22 hours = a day");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            h: 35
        }), true), "um dia", "35 hours = a day");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            h: 36
        }), true), "2 dias", "36 hours = 2 days");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 1
        }), true), "um dia", "1 day = a day");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 5
        }), true), "5 dias", "5 days = 5 days");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 25
        }), true), "25 dias", "25 days = 25 days");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 26
        }), true), "um mês", "26 days = a month");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 30
        }), true), "um mês", "30 days = a month");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 43
        }), true), "um mês", "43 days = a month");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 46
        }), true), "2 meses", "46 days = 2 months");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 74
        }), true), "2 meses", "75 days = 2 months");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 76
        }), true), "3 meses", "76 days = 3 months");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            M: 1
        }), true), "um mês", "1 month = a month");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            M: 5
        }), true), "5 meses", "5 months = 5 months");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 345
        }), true), "um ano", "345 days = a year");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            d: 548
        }), true), "2 anos", "548 days = 2 years");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            y: 1
        }), true), "um ano", "1 year = a year");
        assert.equal(start.from(adone.datetime([2007, 1, 28]).add({
            y: 5
        }), true), "5 anos", "5 years = 5 years");
    });

    it("suffix", () => {
        assert.equal(adone.datetime(30000).from(0), "em poucos segundos", "prefix");
        assert.equal(adone.datetime(0).from(30000), "poucos segundos atrás", "suffix");
    });

    it("fromNow", () => {
        assert.equal(adone.datetime().add({
            s: 30
        }).fromNow(), "em poucos segundos", "in seconds");
        assert.equal(adone.datetime().add({
            d: 5
        }).fromNow(), "em 5 dias", "in 5 days");
    });

    it("calendar day", () => {
        const a = adone.datetime().hours(12).minutes(0).seconds(0);

        assert.equal(adone.datetime(a).calendar(), "Hoje às 12:00", "today at the same time");
        assert.equal(adone.datetime(a).add({
            m: 25
        }).calendar(), "Hoje às 12:25", "Now plus 25 min");
        assert.equal(adone.datetime(a).add({
            h: 1
        }).calendar(), "Hoje às 13:00", "Now plus 1 hour");
        assert.equal(adone.datetime(a).add({
            d: 1
        }).calendar(), "Amanhã às 12:00", "tomorrow at the same time");
        assert.equal(adone.datetime(a).subtract({
            h: 1
        }).calendar(), "Hoje às 11:00", "Now minus 1 hour");
        assert.equal(adone.datetime(a).subtract({
            d: 1
        }).calendar(), "Ontem às 12:00", "yesterday at the same time");
    });

    it("calendar next week", () => {
        let i;
        let m;

        for (i = 2; i < 7; i++) {
            m = adone.datetime().add({
                d: i
            });
            assert.equal(m.calendar(), m.format("dddd [às] LT"), `Today + ${i} days current time`);
            m.hours(0).minutes(0).seconds(0).milliseconds(0);
            assert.equal(m.calendar(), m.format("dddd [às] LT"), `Today + ${i} days beginning of day`);
            m.hours(23).minutes(59).seconds(59).milliseconds(999);
            assert.equal(m.calendar(), m.format("dddd [às] LT"), `Today + ${i} days end of day`);
        }
    });

    it("calendar last week", () => {
        let i;
        let m;

        for (i = 2; i < 7; i++) {
            m = adone.datetime().subtract({
                d: i
            });
            assert.equal(m.calendar(), m.format(m.day() === 0 || m.day() === 6 ? "[Último] dddd [às] LT" : "[Última] dddd [às] LT"), `Today - ${i} days current time`);
            m.hours(0).minutes(0).seconds(0).milliseconds(0);
            assert.equal(m.calendar(), m.format(m.day() === 0 || m.day() === 6 ? "[Último] dddd [às] LT" : "[Última] dddd [às] LT"), `Today - ${i} days beginning of day`);
            m.hours(23).minutes(59).seconds(59).milliseconds(999);
            assert.equal(m.calendar(), m.format(m.day() === 0 || m.day() === 6 ? "[Último] dddd [às] LT" : "[Última] dddd [às] LT"), `Today - ${i} days end of day`);
        }
    });

    it("calendar all else", () => {
        let weeksAgo = adone.datetime().subtract({
            w: 1
        });
        let weeksFromNow = adone.datetime().add({
            w: 1
        });

        assert.equal(weeksAgo.calendar(), weeksAgo.format("L"), "1 week ago");
        assert.equal(weeksFromNow.calendar(), weeksFromNow.format("L"), "in 1 week");

        weeksAgo = adone.datetime().subtract({
            w: 2
        });
        weeksFromNow = adone.datetime().add({
            w: 2
        });

        assert.equal(weeksAgo.calendar(), weeksAgo.format("L"), "2 weeks ago");
        assert.equal(weeksFromNow.calendar(), weeksFromNow.format("L"), "in 2 weeks");
    });

    it("weeks year starting sunday format", () => {
        assert.equal(adone.datetime([2012, 0, 1]).format("w ww wo"), "1 01 1º", "Jan  1 2012 should be week 1");
        assert.equal(adone.datetime([2012, 0, 7]).format("w ww wo"), "1 01 1º", "Jan  7 2012 should be week 1");
        assert.equal(adone.datetime([2012, 0, 8]).format("w ww wo"), "2 02 2º", "Jan  8 2012 should be week 2");
        assert.equal(adone.datetime([2012, 0, 14]).format("w ww wo"), "2 02 2º", "Jan 14 2012 should be week 2");
        assert.equal(adone.datetime([2012, 0, 15]).format("w ww wo"), "3 03 3º", "Jan 15 2012 should be week 3");
    });
});
