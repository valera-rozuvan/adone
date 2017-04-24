// import adone from "adone";

const screen = new adone.cui.Screen({
    autoPadding: true,
    warnings: true
});

const tab = new adone.cui.widget.Element({
    parent: screen,
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    scrollable: true,
    keys: true,
    vi: true,
    alwaysScroll: true,
    scrollbar: {
        ch: " "
    },
    style: {
        scrollbar: {
            inverse: true
        }
    }
});

tab._.data = new adone.cui.widget.Text({
    parent: tab,
    top: 0,
    left: 3,
    height: "shrink",
    width: "shrink",
    content: "",
    tags: true
});

tab._.data.setContent(require("util").inspect(process, null, 6));

screen.key("q", () => {
    screen.destroy();
});

screen.render();