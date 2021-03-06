const { is, vendor: { lodash: _ } } = adone;

function getColorCode(color) {
    if (is.array(color) && color.length === 3) {
        return adone.terminal.parse(adone.sprintf("{#%02x%02x%02x-fg}", color[0], color[1], color[2]));
    } 
    return color;    
}

export default class Line extends adone.cui.widget.Canvas {
    constructor(options) {
        options.showNthLabel = options.showNthLabel || 1;
        options.style = options.style || {};
        options.style.line = options.style.line || "yellow";
        options.style.text = options.style.text || "green";
        options.style.baseline = options.style.baseline || "black";
        options.xLabelPadding = options.xLabelPadding || 5;
        options.xPadding = options.xPadding || 10;
        options.numYLabels = options.numYLabels || 5;
        options.legend = options.legend || {};
        options.wholeNumbersOnly = options.wholeNumbersOnly || false;
        options.minY = options.minY || 0;
        super(options, adone.cui.canvas.Canvas1);
    }

    calcSize() {
        this.canvasSize = { width: this.width * 2 - 12, height: this.height * 4 - 8 };
    }

    setData(data) {
        if (!this.ctx) {
            throw new Error("Canvas context does not exist. setData() for line charts must be called after the chart has been added to the screen via screen.append()");
        }

        //compatability with older api
        if (!is.array(data)) {
            data = [data];
        }

        let xLabelPadding = this.options.xLabelPadding;
        const yLabelPadding = 3;
        let xPadding = this.options.xPadding;
        const yPadding = 11;
        const c = this.ctx;
        const labels = data[0].x;

        const addLegend = () => {
            if (!this.options.showLegend) {
                return;
            }
            if (this.legend) {
                this.remove(this.legend);
            }
            const legendWidth = this.options.legend.width || 15;
            this.legend = new adone.cui.widget.Element({
                height: data.length + 2,
                top: 1,
                width: legendWidth,
                left: this.width - legendWidth - 3,
                content: "",
                fg: "green",
                tags: true,
                border: {
                    type: "line",
                    fg: "black"
                },
                style: {
                    fg: "blue"
                },
                screen: this.screen
            });

            let legandText = "";
            const maxChars = legendWidth - 2;
            for (let i = 0; i < data.length; i++) {
                const style = data[i].style || {};
                const color = getColorCode(style.line || this.options.style.line);
                legandText += `{${color}-fg}${data[i].title.substring(0, maxChars)}{/${color}-fg}\r\n`;
            }
            this.legend.setContent(legandText);
            this.append(this.legend);
        };

        //iteratee for lodash _.max
        const getMax = (v, i) => {
            return parseFloat(v);
        };
        //for some reason this loop does not properly get the maxY if there are multiple datasets (was doing 4 datasets that differred wildly)
        //just used lodash _.max utility
        const getMaxY = () => {
            let max = 0;
            const setMax = [];

            for (let i = 0; i < data.length; i++) {
                if (data[i].y.length) {
                    setMax[i] = _.max(data[i].y, getMax);
                }

                for (let j = 0; j < data[i].y.length; j++) {
                    if (data[i].y[j] > max) {
                        max = data[i].y[j];
                    }
                }
            }

            const m = _.max(setMax, getMax);

            max = m * 1.2;
            max *= 1.2;
            if (this.options.maxY) {
                return Math.max(max, this.options.maxY);
            }

            return max;
        };

        const formatYLabel = (value, max, min, numLabels, wholeNumbersOnly, abbreviate) => {
            const fixed = (max / numLabels < 1 && value !== 0 && !wholeNumbersOnly) ? 2 : 0;
            const res = value.toFixed(fixed);
            return abbreviate ? adone.util.humanizeSize(Number.parseInt(res), "") : res;
        };

        const getMaxXLabelPadding = (numLabels, wholeNumbersOnly, abbreviate, min) => {
            const max = getMaxY();
            return formatYLabel(max, max, min, numLabels, wholeNumbersOnly, abbreviate).length * 2;
        };

        const maxPadding = getMaxXLabelPadding(this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate, this.options.minY);
        if (xLabelPadding < maxPadding) {
            xLabelPadding = maxPadding;
        }

        if ((xPadding - xLabelPadding) < 0) {
            xPadding = xLabelPadding;
        }

        const getMaxX = () => {
            let maxLength = 0;

            for (let i = 0; i < labels.length; i++) {
                if (is.undefined(labels[i])) {
                    console.log(`label[${i}] is undefined`);
                } else if (labels[i].length > maxLength) {
                    maxLength = labels[i].length;
                }
            }

            return maxLength;
        };

        const getXPixel = (val) => {
            return ((this.canvasSize.width - xPadding) / labels.length) * val + (Number(xPadding)) + 2;
        };

        const getYPixel = (val, minY) => {
            let res = this.canvasSize.height - yPadding - (((this.canvasSize.height - yPadding) / (getMaxY() - minY)) * (val - minY));
            res -= 2; //to separate the baseline and the data line to separate chars so canvas will show separate colors
            return res;
        };

        // Draw the line graph
        const drawLine = (values, style, minY) => {
            style = style || {};
            const color = this.options.style.line;
            c.strokeStyle = style.line || color;

            c.moveTo(0, 0);
            c.beginPath();
            c.lineTo(getXPixel(0), getYPixel(values[0], minY));

            for (let k = 1; k < values.length; k++) {
                c.lineTo(getXPixel(k), getYPixel(values[k], minY));
            }

            c.stroke();
        };

        addLegend();

        c.fillStyle = this.options.style.text;

        c.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);


        let yLabelIncrement = (getMaxY() - this.options.minY) / this.options.numYLabels;
        if (this.options.wholeNumbersOnly) {
            yLabelIncrement = Math.floor(yLabelIncrement);
        }
        //if (getMaxY()>=10) {
        //  yLabelIncrement = yLabelIncrement + (10 - yLabelIncrement % 10)
        //}

        //yLabelIncrement = Math.max(yLabelIncrement, 1) // should not be zero

        if (yLabelIncrement === 0) {
            yLabelIncrement = 1;
        }

        // Draw the Y value texts
        const maxY = getMaxY();
        for (let i = this.options.minY; i < maxY; i += yLabelIncrement) {
            c.fillText(formatYLabel(i, maxY, this.options.minY, this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate), xPadding - xLabelPadding, getYPixel(i, this.options.minY));
        }

        for (let h = 0; h < data.length; h++) {
            drawLine(data[h].y, data[h].style, this.options.minY);
        }


        c.strokeStyle = this.options.style.baseline;

        // Draw the axises
        c.beginPath();

        c.lineTo(xPadding, 0);
        c.lineTo(xPadding, this.canvasSize.height - yPadding);
        c.lineTo(this.canvasSize.width, this.canvasSize.height - yPadding);

        c.stroke();

        // Draw the X value texts
        const charsAvailable = (this.canvasSize.width - xPadding) / 2;
        const maxLabelsPossible = charsAvailable / (getMaxX() + 2);
        const pointsPerMaxLabel = Math.ceil(data[0].y.length / maxLabelsPossible);
        let showNthLabel = this.options.showNthLabel;
        if (showNthLabel < pointsPerMaxLabel) {
            showNthLabel = pointsPerMaxLabel;
        }

        for (let i = 0; i < labels.length; i += showNthLabel) {
            if ((getXPixel(i) + (labels[i].length * 2)) <= this.canvasSize.width) {
                c.fillText(labels[i], getXPixel(i), this.canvasSize.height - yPadding + yLabelPadding);
            }
        }
    }

    getOptionsPrototype() {
        return {
            width: 80,
            height: 30,
            left: 15,
            top: 12,
            xPadding: 5,
            label: "Title",
            showLegend: true,
            legend: { width: 12 },
            data: [{
                title: "us-east",
                x: ["t1", "t2", "t3", "t4"],
                y: [5, 1, 7, 5],
                style: {
                    line: "red"
                }
            },
            {
                title: "us-west",
                x: ["t1", "t2", "t3", "t4"],
                y: [2, 4, 9, 8],
                style: { line: "yellow" }
            },
            {
                title: "eu-north-with-some-long-string",
                x: ["t1", "t2", "t3", "t4"],
                y: [22, 7, 12, 1],
                style: { line: "blue" }
            }]

        };
    }
}
Line.prototype.type = "line";
