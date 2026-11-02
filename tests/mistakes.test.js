import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMistake } from '../js/mistakes.js';

test('dropped carry: off by ±10, ±100, ±1000', () => {
  assert.equal(classifyMistake(1032, '1042'), 'carry');
  assert.equal(classifyMistake(1032, '1022'), 'carry');
  assert.equal(classifyMistake(1032, '932'), 'carry');
  assert.equal(classifyMistake(1032, '1132'), 'carry');
  assert.equal(classifyMistake(4232, '3232'), 'carry');
  assert.equal(classifyMistake(56, '66'), 'carry');
});

test('only the last digit wrong', () => {
  assert.equal(classifyMistake(1032, '1035'), 'last-digit');
  assert.equal(classifyMistake(7, '8'), 'last-digit');
});

test('swapped digits', () => {
  assert.equal(classifyMistake(1032, '1023'), 'swapped');
  assert.equal(classifyMistake(56, '65'), 'swapped');
  assert.equal(classifyMistake(1234, '3214'), 'swapped');
});

test('other', () => {
  assert.equal(classifyMistake(1032, '1111'), 'other');
  assert.equal(classifyMistake(1032, '20'), 'other');
  assert.equal(classifyMistake(1032, '1020'), 'other'); // off by 12
});

test('a correct answer is not a mistake', () => {
  assert.equal(classifyMistake(1032, '1032'), null);
  assert.equal(classifyMistake(1032, ''), null);
});
