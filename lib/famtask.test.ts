// Pure-function tests for Famtask-helpers.
//
// Køres via Node 20's indbyggede test-runner:
//   npx tsx --test lib/famtask.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isUuid,
  monthInputValue,
  moveInOrder,
  nextStepStatus,
  parseMonthInput,
} from './famtask';

test('parseMonthInput: tom værdi er null', () => {
  assert.deepEqual(parseMonthInput(''), { ok: true, value: null });
  assert.deepEqual(parseMonthInput('   '), { ok: true, value: null });
});

test('parseMonthInput: YYYY-MM bliver første dag i måneden', () => {
  assert.deepEqual(parseMonthInput('2026-11'), { ok: true, value: '2026-11-01' });
  // Håndskrevet uden foranstillet nul (browsere uden month-picker)
  assert.deepEqual(parseMonthInput('2026-3'), { ok: true, value: '2026-03-01' });
});

test('parseMonthInput: afviser ugyldige værdier', () => {
  assert.equal(parseMonthInput('2026-13').ok, false);
  assert.equal(parseMonthInput('2026-00').ok, false);
  assert.equal(parseMonthInput('11-2026').ok, false);
  assert.equal(parseMonthInput('2026-11-15').ok, false);
  assert.equal(parseMonthInput('9999-01').ok, false);
});

test('monthInputValue: DB-dato til month-input', () => {
  assert.equal(monthInputValue('2026-11-01'), '2026-11');
  assert.equal(monthInputValue(null), '');
});

test('nextStepStatus: todo → i gang → færdig → todo', () => {
  assert.equal(nextStepStatus('todo'), 'i_gang');
  assert.equal(nextStepStatus('i_gang'), 'faerdig');
  assert.equal(nextStepStatus('faerdig'), 'todo');
});

test('moveInOrder: bytter med naboen', () => {
  assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c']);
  assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b']);
});

test('moveInOrder: null ved kanten eller ukendt id', () => {
  assert.equal(moveInOrder(['a', 'b'], 'a', 'up'), null);
  assert.equal(moveInOrder(['a', 'b'], 'b', 'down'), null);
  assert.equal(moveInOrder(['a', 'b'], 'x', 'up'), null);
});

test('isUuid', () => {
  assert.equal(isUuid('11111111-1111-1111-1111-111111111111'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(''), false);
});
