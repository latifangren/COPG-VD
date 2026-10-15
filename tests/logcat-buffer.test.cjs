const test = require('node:test');
const assert = require('node:assert/strict');
const { getNewLogcatLines } = require('../module/webroot/logcat-buffer.js');

test('skips pre-existing entries in the initial baseline snapshot', () => {
  assert.deepEqual(getNewLogcatLines('', 'A\nB\n', true), []);
});

test('returns the complete first snapshot when it is not a baseline', () => {
  assert.deepEqual(getNewLogcatLines('', 'A\nB\n'), ['A', 'B']);
});

test('returns only appended lines from a growing snapshot', () => {
  assert.deepEqual(getNewLogcatLines('A\nB\n', 'A\nB\nC\n'), ['C']);
});

test('returns no lines when the snapshot has not changed', () => {
  assert.deepEqual(getNewLogcatLines('A\nB\n', 'A\nB\n'), []);
});

test('uses the retained overlap when the log buffer has wrapped', () => {
  assert.deepEqual(getNewLogcatLines('old\nA\nB\n', 'A\nB\nC\n'), ['C']);
});

test('treats a cleared or replaced buffer as a fresh snapshot', () => {
  assert.deepEqual(getNewLogcatLines('A\nB\n', 'X\nY\n'), ['X', 'Y']);
});
