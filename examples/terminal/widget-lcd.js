// import adone from "adone";
const screen = new adone.cui.Screen();

/*
//these options need to be modified epending on the resulting positioning/size
  options.segmentWidth = options.segmentWidth || 0.06; // how wide are the segments in % so 50% = 0.5
  options.segmentInterval = options.segmentInterval || 0.11; // spacing between the segments in % so 50% = 0.5
  options.strokeWidth = options.strokeWidth || 0.11; // spacing between the segments in % so 50% = 0.5

//default display settings
  options.elements = options.elements || 3; // how many elements in the display. or how many characters can be displayed.
  options.display = options.display || 321; // what should be displayed before anything is set
  options.elementSpacing = options.spacing || 4; // spacing between each element
  options.elementPadding = options.padding || 2; // how far away from the edges to put the elements

//coloring
  options.color = options.color || "white";
*/


const lcd = new adone.cui.widget.LCD({
    label: "Test",
    elements: 4
});

screen.append(lcd);

setInterval(() => {
    const colors = ["green", "magenta", "cyan", "red", "blue"];
    const text = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

    const value = Math.round(Math.random() * 1000);
    lcd.setDisplay(value + text[value % 12]);
    lcd.setOptions({
        color: colors[value % 5],
        elementPadding: 5
    });
    screen.render();
}, 1000);

screen.key(["g"], (ch, key) => {
    lcd.increaseWidth();
    screen.render();
});
screen.key(["h"], (ch, key) => {
    lcd.decreaseWidth();
    screen.render();
});
screen.key(["t"], (ch, key) => {
    lcd.increaseInterval();
    screen.render();
});
screen.key(["y"], (ch, key) => {
    lcd.decreaseInterval();
    screen.render();
});
screen.key(["b"], (ch, key) => {
    lcd.increaseStroke();
    screen.render();
});
screen.key(["n"], (ch, key) => {
    lcd.decreaseStroke();
    screen.render();
});

screen.key(["escape", "q", "C-c"], (ch, key) => {
    return process.exit(0);
});

screen.render();
