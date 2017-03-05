adone.terminal.prompt([
  {
    type: 'rawlist',
    name: 'theme',
    message: 'What do you want to do?',
    choices: [
      'Order a pizza',
      'Make a reservation',
      new adone.terminal.Separator(),
      'Ask opening hours',
      'Talk to the receptionist'
    ]
  },
  {
    type: 'rawlist',
    name: 'size',
    message: 'What size do you need',
    choices: ['Jumbo', 'Large', 'Standard', 'Medium', 'Small', 'Micro'],
    filter: function (val) {
      return val.toLowerCase();
    }
  }
]).then(function (answers) {
  console.log(JSON.stringify(answers, null, '  '));
});
