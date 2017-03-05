// import adone from "adone";

const screen = new adone.terminal.Screen({
    dump: `${__dirname}/logs/nested-attr.log`,
    warnings: true
});

new adone.terminal.widget.Element({
    parent: screen,
    left: "center",
    top: "center",
    width: "80%",
    height: "80%",
    style: {
        bg: "black",
        fg: "yellow"
    },
    tags: true,
    border: "line",
    content: "{red-fg}hello {blue-fg}how{/blue-fg}"
    + " {yellow-bg}are{/yellow-bg} you?{/red-fg}"
});

screen.key("q", () => {
    return screen.destroy();
});

screen.render();
