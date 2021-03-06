const Board = require("./board");
const Fn = require("./fn");
const Emitter = require("events").EventEmitter;
const util = require("util");

const toFixed = Fn.toFixed;
const priv = new Map();

const Controllers = {
    // https://cdn-shop.adafruit.com/product-files/2857/Sensirion_Humidity_SHT3x_Datasheet_digital-767294.pdf
    SHT31D: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "SHT31D", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                // Based on the "Relative Humidity Conversion" formula
                // https://cdn-shop.adafruit.com/product-files/2857/Sensirion_Humidity_SHT3x_Datasheet_digital-767294.pdf
                // Page 2
                // Table 1
                // 1.1 Humidity Sensor Performance
                //
                // Page 14
                // 4.13 Conversion of Signal Output
                // RH = 100 * (Srh / ((2 ** 26) - 1))
                // Srh = Sensor raw humidity
                return toFixed((100 * raw / 65535), 2);
            }
        }
    },

    // https://www.adafruit.com/datasheets/1899_HTU21D.pdf
    HTU21D: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "HTU21D", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                // Page 15
                // CONVERSION OF SIGNAL OUTPUTS
                // RH = -6 + 125 * (Srh / (2 ** 26))
                // Srh = Sensor raw humidity
                return (125 * raw / 65536) - 6;
            }
        }
    },

    HIH6130: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "HIH6130", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                // Page 3
                // Equation 1: Humidity Conversion Function
                return toFixed(raw * 100 / (Fn.POW_2_14 - 1), 2);
            }
        }
    },

    DHT_I2C_NANO_BACKPACK: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "DHT_I2C_NANO_BACKPACK", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                return raw / 100;
            }
        }
    },

    TH02: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "TH02", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                if (raw > 100) {
                    raw = 0;
                }
                return toFixed(raw || 0, 2);
            }
        }
    },

    SI7020: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "SI7020", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                // https://www.silabs.com/Support%20Documents/TechnicalDocs/Si7020-A20.pdf
                // P. 22
                return (125 * raw / 65536) - 6;
            }
        }
    },

    BME280: {
        initialize: {
            value(opts, dataHandler) {
                const Multi = require("./imu");
                const driver = Multi.Drivers.get(this.board, "BME280", opts);
                driver.on("data", (data) => {
                    dataHandler(data.humidity);
                });
            }
        },
        toRelativeHumidity: {
            value(raw) {
                // https://cdn.sparkfun.com/assets/learn_tutorials/4/1/9/BST-BME280_DS001-10.pdf
                // Page 23
                // 47445 / 1024 = 46.333 %RH
                return toFixed(raw / 1024, 3);
            }
        }
    }
};

Controllers.DHT11_I2C_NANO_BACKPACK = Controllers.DHT_I2C_NANO_BACKPACK;
Controllers.DHT21_I2C_NANO_BACKPACK = Controllers.DHT_I2C_NANO_BACKPACK;
Controllers.DHT22_I2C_NANO_BACKPACK = Controllers.DHT_I2C_NANO_BACKPACK;
Controllers.SI7021 = Controllers.SI7020;


function Hygrometer(opts) {
    if (!(this instanceof Hygrometer)) {
        return new Hygrometer(opts);
    }

    let controller = null;
    let last = null;
    let raw = null;

    Board.Component.call(
        this, opts = Board.Options(opts)
    );

    const freq = opts.freq || 25;

    if (opts.controller && typeof opts.controller === "string") {
        controller = Controllers[opts.controller.toUpperCase()];
    } else {
        controller = opts.controller;
    }

    if (controller == null) {
        throw new Error("Missing Hygrometer controller");
    }

    priv.set(this, {});

    Board.Controller.call(this, controller, opts);

    if (!this.toRelativeHumidity) {
        this.toRelativeHumidity = opts.toRelativeHumidity || function (x) {
            return x;
        };
    }

    const propDescriptors = {
        relativeHumidity: {
            get() {
                return this.toRelativeHumidity(raw);
            }
        }
    };
    // Convenience aliases
    propDescriptors.RH = propDescriptors.relativeHumidity;

    Object.defineProperties(this, propDescriptors);

    if (typeof this.initialize === "function") {
        this.initialize(opts, (data) => {
            raw = data;
        });
    }

    setInterval(() => {
        if (raw == null) {
            return;
        }

        if (Number.isNaN(this.relativeHumidity)) {
            return;
        }

        const data = {};
        data.RH = data.relativeHumidity = this.relativeHumidity;

        this.emit("data", data);

        if (this.relativeHumidity !== last) {
            last = this.relativeHumidity;
            this.emit("change", data);
        }
    }, freq);
}

util.inherits(Hygrometer, Emitter);

/* istanbul ignore else */
if (process.env.IS_TEST_MODE) {
    Hygrometer.Controllers = Controllers;
    Hygrometer.purge = function () {
        priv.clear();
    };
}

module.exports = Hygrometer;
