

export default class ProgressBar extends adone.cui.widget.Input {
    constructor(options) {
        super(options);

        this.filled = options.filled || 0;
        if (typeof this.filled === "string") {
            this.filled = Number(this.filled.slice(0, -1));
        }
        this.value = this.filled;

        this.pch = options.pch || " ";

        // XXX Workaround that predates the usage of `el.ch`.
        if (options.ch) {
            this.pch = options.ch;
            this.ch = " ";
        }
        if (options.bch) {
            this.ch = options.bch;
        }

        if (!this.style.bar) {
            this.style.bar = {};
            this.style.bar.fg = options.barFg;
            this.style.bar.bg = options.barBg;
        }

        this.orientation = options.orientation || "horizontal";

        if (options.keys) {
            this.on("keypress", (ch, key) => {
                let back;
                let forward;
                if (this.orientation === "horizontal") {
                    back = ["left", "h"];
                    forward = ["right", "l"];
                } else if (this.orientation === "vertical") {
                    back = ["down", "j"];
                    forward = ["up", "k"];
                }
                if (key.name === back[0] || (options.vi && key.name === back[1])) {
                    this.progress(-5);
                    this.screen.render();
                    return;
                }
                if (key.name === forward[0] || (options.vi && key.name === forward[1])) {
                    this.progress(5);
                    this.screen.render();
                    
                }
            });
        }

        if (options.mouse) {
            this.on("click", (data) => {
                let x;
                let y;
                let m;
                let p;
                if (!this.lpos) {
                    return;
                }
                if (this.orientation === "horizontal") {
                    x = data.x - this.lpos.xi;
                    m = (this.lpos.xl - this.lpos.xi) - this.iwidth;
                    p = x / m * 100 | 0;
                } else if (this.orientation === "vertical") {
                    y = data.y - this.lpos.yi;
                    m = (this.lpos.yl - this.lpos.yi) - this.iheight;
                    p = y / m * 100 | 0;
                }
                this.setProgress(p);
            });
        }
    }

    render() {
        const ret = super.render();
        if (!ret) {
            return;
        }

        let xi = ret.xi;
        let xl = ret.xl;
        let yi = ret.yi;
        let yl = ret.yl;
        let dattr;

        if (this.border) {
            xi++, yi++, xl--, yl--; 
        }

        if (this.orientation === "horizontal") {
            xl = xi + ((xl - xi) * (this.filled / 100)) | 0;
        } else if (this.orientation === "vertical") {
            yi = yi + ((yl - yi) - (((yl - yi) * (this.filled / 100)) | 0));
        }

        dattr = this.sattr(this.style.bar);

        this.screen.fillRegion(dattr, this.pch, xi, xl, yi, yl);

        if (this.content) {
            const line = this.screen.lines[yi];
            for (let i = 0; i < this.content.length; i++) {
                line[xi + i][1] = this.content[i];
            }
            line.dirty = true;
        }

        return ret;
    }

    progress(filled) {
        this.filled += filled;
        if (this.filled < 0) {
            this.filled = 0; 
        } else if (this.filled > 100) {
            this.filled = 100;
        }
        if (this.filled === 100) {
            this.emit("complete");
        }
        this.value = this.filled;
    }

    setProgress(filled) {
        this.filled = 0;
        this.progress(filled);
    }

    reset() {
        this.emit("reset");
        this.filled = 0;
        this.value = this.filled;
    }
}
ProgressBar.prototype.type = "progressbar";
