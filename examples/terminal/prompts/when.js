adone.run({
    main() {
        const likesFood = (aFood) => {
            return function (answers) {
                return answers[aFood];
            };
        };

        const questions = [
            {
                type: "confirm",
                name: "bacon",
                message: "Do you like bacon?"
            },
            {
                type: "input",
                name: "favorite",
                message: "Bacon lover, what is your favorite type of bacon?",
                when(answers) {
                    return answers.bacon;
                }
            },
            {
                type: "confirm",
                name: "pizza",
                message: "Ok... Do you like pizza?",
                when(answers) {
                    return !likesFood("bacon")(answers);
                }
            },
            {
                type: "input",
                name: "favorite",
                message: "Whew! What is your favorite type of pizza?",
                when: likesFood("pizza")
            }
        ];

        adone.terminal.prompt(questions).then((answers) => {
            adone.log(JSON.stringify(answers, null, "  "));
        });
    }
});
