import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patternsOf } from '../js/patterns.js';

const has = (a, b, id) => patternsOf(a, b).includes(id);

test('squares', () => {
  assert.ok(has(37, 37, 'square'));
  assert.ok(!has(37, 38, 'square'));
});

test('equally far from a multiple of 10 (sum divisible by 20)', () => {
  assert.ok(has(47, 53, 'equidistant'));
  assert.ok(has(53, 47, 'equidistant'));
  assert.ok(has(18, 22, 'equidistant'));
  assert.ok(has(35, 85, 'equidistant')); // mid 60
  assert.ok(!has(47, 54, 'equidistant'));
  assert.ok(!has(45, 45, 'equidistant')); // a square, not a pair
});

test('same tens digit, units add to 10', () => {
  assert.ok(has(43, 47, 'same-tens-units-10'));
  assert.ok(has(1, 9, 'same-tens-units-10'));
  assert.ok(has(65, 65, 'same-tens-units-10'));
  assert.ok(!has(43, 57, 'same-tens-units-10'));
  assert.ok(!has(42, 47, 'same-tens-units-10'));
});

test('×11', () => {
  assert.ok(has(11, 64, 'times-11'));
  assert.ok(has(64, 11, 'times-11'));
  assert.ok(!has(12, 64, 'times-11'));
});

test('exactly one single-digit number', () => {
  assert.ok(has(7, 64, 'one-single-digit'));
  assert.ok(has(64, 7, 'one-single-digit'));
  assert.ok(!has(7, 8, 'one-single-digit'));
  assert.ok(!has(17, 64, 'one-single-digit'));
});

test('a question can match several patterns', () => {
  assert.deepEqual(patternsOf(11, 11).sort(), ['square', 'times-11']);
});
