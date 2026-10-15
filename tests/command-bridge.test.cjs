const test = require('node:test');
const assert = require('node:assert/strict');
const { createExecCommand } = require('../module/webroot/command-bridge.js');

test('keeps concurrent command callbacks distinct and resolves their own output', async () => {
  const callbacks = [];
  const callbackHost = {};
  const execCommand = createExecCommand(() => ({
    exec: (_command, _options, callbackName) => callbacks.push(callbackName),
  }), callbackHost);

  const first = execCommand('first');
  const second = execCommand('second');
  assert.notEqual(callbacks[0], callbacks[1]);

  callbackHost[callbacks[1]](0, 'second output', '');
  callbackHost[callbacks[0]](0, 'first output', '');
  assert.deepEqual(await Promise.all([first, second]), ['first output', 'second output']);
  assert.deepEqual(Object.keys(callbackHost), []);
});

test('rejects when the root manager API is unavailable without leaking a callback', async () => {
  const callbackHost = {};
  const execCommand = createExecCommand(() => null, callbackHost);
  await assert.rejects(execCommand('probe'), /KSU API not available/);
  assert.deepEqual(Object.keys(callbackHost), []);
});

test('cleans up and rejects when command dispatch throws synchronously', async () => {
  const callbackHost = {};
  const execCommand = createExecCommand(() => ({
    exec: () => { throw new Error('dispatch failed'); },
  }), callbackHost);
  await assert.rejects(execCommand('probe'), /dispatch failed/);
  assert.deepEqual(Object.keys(callbackHost), []);
});

test('cleans up and rejects nonzero command results', async () => {
  const callbackHost = {};
  let callbackName;
  const execCommand = createExecCommand(() => ({
    exec: (_command, _options, name) => { callbackName = name; },
  }), callbackHost);
  const result = execCommand('probe');
  callbackHost[callbackName](7, '', 'command failed');
  await assert.rejects(result, /command failed/);
  assert.deepEqual(Object.keys(callbackHost), []);
});
