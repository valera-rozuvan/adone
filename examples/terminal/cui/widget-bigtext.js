adone.run({
    main() {
        const screen = new adone.cui.Screen({
            dump: `${__dirname}/logs/bigtext.log`,
            smartCSR: true,
            warnings: true
        });

        new adone.cui.widget.BigText({
            parent: screen,
            content: "Hello",
            shrink: true,
            width: "80%",
            // height: '80%',
            height: "shrink",
            // width: 'shrink',
            border: "line",
            fch: " ",
            ch: "\u2592",
            style: {
                fg: "red",
                bg: "blue",
                bold: false
            }
        });

        screen.key("q", () => {
            return screen.destroy();
        });

        screen.render();
    }
});
