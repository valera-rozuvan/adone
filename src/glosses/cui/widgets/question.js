

export default class Question extends adone.cui.widget.Element {
    constructor(options = { }) {
        options.hidden = true;
        super(options);

        this._.okay = new adone.cui.widget.Button({
            screen: this.screen,
            parent: this,
            top: 2,
            height: 1,
            left: 2,
            width: 6,
            content: "Okay",
            align: "center",
            bg: "black",
            hoverBg: "blue",
            autoFocus: false,
            mouse: true
        });

        this._.cancel = new adone.cui.widget.Button({
            screen: this.screen,
            parent: this,
            top: 2,
            height: 1,
            shrink: true,
            left: 10,
            width: 8,
            content: "Cancel",
            align: "center",
            bg: "black",
            hoverBg: "blue",
            autoFocus: false,
            mouse: true
        });
    }
    
    ask(text, callback) {
        let press;
        let okay;
        let cancel;

        // Keep above:
        // var parent = this.parent;
        // this.detach();
        // parent.append(this);

        this.show();
        this.setContent(` ${text}`);

        const done = (err, data) => {
            this.hide();
            this.screen.restoreFocus();
            this.removeScreenEvent("keypress", press);
            this._.okay.removeListener("press", okay);
            this._.cancel.removeListener("press", cancel);
            return callback(err, data);
        };

        this.onScreenEvent("keypress", press = (ch, key) => {
            if (key.name === "mouse") {
                return; 
            }
            if (key.name !== "enter"
                && key.name !== "escape"
                && key.name !== "q"
                && key.name !== "y"
                && key.name !== "n") {
                return;
            }
            done(null, key.name === "enter" || key.name === "y");
        });

        this._.okay.on("press", okay = () => {
            done(null, true);
        });

        this._.cancel.on("press", cancel = () => {
            done(null, false);
        });

        this.screen.saveFocus();
        this.focus();

        this.screen.render();
    }
}
Question.prototype.type = "question";
