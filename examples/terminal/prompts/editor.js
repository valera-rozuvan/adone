var questions = [
  {
    type: 'editor',
    name: 'bio',
    message: 'Please write a short bio of at least 3 lines.',
    validate: function (text) {
      if (text.split('\n').length < 3) {
        return 'Must be at least 3 lines.';
      }

      return true;
    }
  }
];

adone.terminal.prompt(questions).then(function (answers) {
  console.log(JSON.stringify(answers, null, '  '));
});
