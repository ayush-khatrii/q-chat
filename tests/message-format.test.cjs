const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyMessage } = require('../lib/message-format.ts');

test('normal and ambiguous chat stays plain', () => {
  for (const text of ['hello world', 'hello\n  there', 'Meet at 5;\n  bring snacks', 'my_variable_name', 'Thanks! :)']) assert.equal(classifyMessage(text), 'plain', text);
});
test('recognizes explicit Markdown before code', () => {
  for (const text of ['# Heading\nBody', '- one\n- two', '```js\nconst a = 1;\n```', '**bold**', '*emphasis*', '> quote', '| A | B |\n| --- | --- |\n| x | y |', '# Example\nconst a = 1;\nreturn a;', 'Title\n===']) assert.equal(classifyMessage(text), 'markdown', text);
});
test('recognizes obvious multiline code and JSON without changing source', () => {
  for (const text of ['  function test() {\n    return 1;\n  }\n', 'def greet(name):\n    return name', '{\n  "a": 1\n}', '[\n  1, 2\n]', 'const a = 1;\nconst b = 2;']) assert.equal(classifyMessage(text), 'code', text);
});
