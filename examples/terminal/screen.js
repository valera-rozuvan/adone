const screen = new adone.cui.Screen({
    dump: `${__dirname}/logs/widget.log`,
    title: "terminal screen",
    resizeTimeout: 300,
    // dockBorders: true,
    // cursor: {
    //     artificial: true,
    //     shape: "line",
    //     blink: true,
    //     color: null
    // },
    //debug: true,
    warnings: true
});

screen.render();
