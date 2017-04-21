// import adone from "adone";
const screen = new adone.cui.Screen();
const line = new adone.cui.widget.LineChart({
    width: 80
    , height: 30
    , left: 15
    , top: 12
    , xPadding: 5
    , label: "Title"
    , abbreviate: true
    , style: { baseline: "white" }
});

const data = [{
    title: "us-east",
    x: ["t1", "t2", "t3", "t4"],
    y: [5, 8800, 99999, 3179000000],
    style: {
        line: "red"
    }
}
];

screen.append(line); //must append before setting data
line.setData(data);

screen.key(["escape", "q", "C-c"], (ch, key) => {
    return process.exit(0);
});

screen.render();
