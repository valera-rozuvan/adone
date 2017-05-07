//! locale : Luxembourgish [lb]
//! author : mweimerskirch : https://github.com/mweimerskirch
//! author : David Raison : https://github.com/kwisatz

import ExDate from "..";

// eslint-disable-next-line no-unused-vars
function processRelativeTime(number, withoutSuffix, key, isFuture) {
    const format = {
        m: ["eng Minutt", "enger Minutt"],
        h: ["eng Stonn", "enger Stonn"],
        d: ["een Dag", "engem Dag"],
        M: ["ee Mount", "engem Mount"],
        y: ["ee Joer", "engem Joer"]
    };
    return withoutSuffix ? format[key][0] : format[key][1];
}
function processFutureTime(string) {
    const number = string.substr(0, string.indexOf(" "));
    if (eifelerRegelAppliesToNumber(number)) {
        return `a ${string}`;
    }
    return `an ${string}`;
}
function processPastTime(string) {
    const number = string.substr(0, string.indexOf(" "));
    if (eifelerRegelAppliesToNumber(number)) {
        return `viru ${string}`;
    }
    return `virun ${string}`;
}
/**
 * Returns true if the word before the given number loses the '-n' ending.
 * e.g. 'an 10 Deeg' but 'a 5 Deeg'
 *
 * @param number {integer}
 * @returns {boolean}
 */
function eifelerRegelAppliesToNumber(number) {
    number = parseInt(number, 10);
    if (isNaN(number)) {
        return false;
    }
    if (number < 0) {
        // Negative Number --> always true
        return true;
    } else if (number < 10) {
        // Only 1 digit
        if (number >= 4 && number <= 7) {
            return true;
        }
        return false;
    } else if (number < 100) {
        // 2 digits
        const lastDigit = number % 10;
        const firstDigit = number / 10;
        if (lastDigit === 0) {
            return eifelerRegelAppliesToNumber(firstDigit);
        }
        return eifelerRegelAppliesToNumber(lastDigit);
    } else if (number < 10000) {
        // 3 or 4 digits --> recursively check first digit
        while (number >= 10) {
            number = number / 10;
        }
        return eifelerRegelAppliesToNumber(number);
    } 
        // Anything larger than 4 digits: recursively check first n-3 digits
    number = number / 1000;
    return eifelerRegelAppliesToNumber(number);
    
}

export default ExDate.defineLocale("lb", {
    months: "Januar_Februar_Mäerz_Abrëll_Mee_Juni_Juli_August_September_Oktober_November_Dezember".split("_"),
    monthsShort: "Jan._Febr._Mrz._Abr._Mee_Jun._Jul._Aug._Sept._Okt._Nov._Dez.".split("_"),
    monthsParseExact: true,
    weekdays: "Sonndeg_Méindeg_Dënschdeg_Mëttwoch_Donneschdeg_Freideg_Samschdeg".split("_"),
    weekdaysShort: "So._Mé._Dë._Më._Do._Fr._Sa.".split("_"),
    weekdaysMin: "So_Mé_Dë_Më_Do_Fr_Sa".split("_"),
    weekdaysParseExact: true,
    longDateFormat: {
        LT: "H:mm [Auer]",
        LTS: "H:mm:ss [Auer]",
        L: "DD.MM.YYYY",
        LL: "D. MMMM YYYY",
        LLL: "D. MMMM YYYY H:mm [Auer]",
        LLLL: "dddd, D. MMMM YYYY H:mm [Auer]"
    },
    calendar: {
        sameDay: "[Haut um] LT",
        sameElse: "L",
        nextDay: "[Muer um] LT",
        nextWeek: "dddd [um] LT",
        lastDay: "[Gëschter um] LT",
        lastWeek() {
            // Different date string for 'Dënschdeg' (Tuesday) and 'Donneschdeg' (Thursday) due to phonological rule
            switch (this.day()) {
                case 2:
                case 4:
                    return "[Leschten] dddd [um] LT";
                default:
                    return "[Leschte] dddd [um] LT";
            }
        }
    },
    relativeTime: {
        future: processFutureTime,
        past: processPastTime,
        s: "e puer Sekonnen",
        m: processRelativeTime,
        mm: "%d Minutten",
        h: processRelativeTime,
        hh: "%d Stonnen",
        d: processRelativeTime,
        dd: "%d Deeg",
        M: processRelativeTime,
        MM: "%d Méint",
        y: processRelativeTime,
        yy: "%d Joer"
    },
    dayOfMonthOrdinalParse: /\d{1,2}\./,
    ordinal: "%d.",
    week: {
        dow: 1, // Monday is the first day of the week.
        doy: 4  // The week that contains Jan 4th is the first week of the year.
    }
});