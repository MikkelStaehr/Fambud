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
  sparkChecklist,
  type FamtaskMember,
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

const MEMBERS: FamtaskMember[] = [
  { id: 'm1', name: 'Mikkel', user_id: 'u1' },
  { id: 'm2', name: 'Louise', user_id: 'u2' },
  // Barn uden login: skal ikke godkende
  { id: 'm3', name: 'Emil', user_id: null },
];

const READY_SPARK = {
  note: 'Mere plads til cyklerne',
  estimated_amount: 4500000,
  target_month: '2027-04-01',
  owner_member_id: 'm2',
};

test('sparkChecklist: klar når alle fire punkter er opfyldt', () => {
  const c = sparkChecklist(READY_SPARK, MEMBERS, ['u1', 'u2']);
  assert.equal(c.ready, true);
  assert.deepEqual(c.missingApprovers, []);
  assert.ok(c.items.every((i) => i.done));
});

test('sparkChecklist: ny spark mangler alt', () => {
  const c = sparkChecklist(
    { note: null, estimated_amount: null, target_month: null, owner_member_id: null },
    MEMBERS,
    []
  );
  assert.equal(c.ready, false);
  assert.deepEqual(c.items.map((i) => i.done), [false, false, false, false]);
  assert.deepEqual(c.missingApprovers, ['Mikkel', 'Louise']);
});

test('sparkChecklist: formål med kun mellemrum tæller ikke', () => {
  const c = sparkChecklist({ ...READY_SPARK, note: '   ' }, MEMBERS, ['u1', 'u2']);
  assert.equal(c.items.find((i) => i.key === 'purpose')?.done, false);
  assert.equal(c.ready, false);
});

test('sparkChecklist: beløb 0 er ok, men beløb og måned skal begge være sat', () => {
  assert.equal(sparkChecklist({ ...READY_SPARK, estimated_amount: 0 }, MEMBERS, ['u1', 'u2']).ready, true);
  assert.equal(sparkChecklist({ ...READY_SPARK, target_month: null }, MEMBERS, ['u1', 'u2']).ready, false);
  assert.equal(sparkChecklist({ ...READY_SPARK, estimated_amount: null }, MEMBERS, ['u1', 'u2']).ready, false);
});

test('sparkChecklist: én godkendelse er ikke nok', () => {
  const c = sparkChecklist(READY_SPARK, MEMBERS, ['u1']);
  assert.equal(c.ready, false);
  assert.deepEqual(c.missingApprovers, ['Louise']);
});

test('sparkChecklist: godkendelse fra en der ikke er medlem tæller ikke', () => {
  const c = sparkChecklist(READY_SPARK, MEMBERS, ['u1', 'u-tidligere']);
  assert.equal(c.ready, false);
  assert.deepEqual(c.missingApprovers, ['Louise']);
});

test('sparkChecklist: uden medlemmer med login kan sparken ikke blive klar', () => {
  const c = sparkChecklist(READY_SPARK, [{ id: 'm3', name: 'Emil', user_id: null }], []);
  assert.equal(c.ready, false);
});

test('sparkChecklist: prissatte skridt opfylder beløb uden groft beløb', () => {
  const spark = { ...READY_SPARK, estimated_amount: null };
  const c = sparkChecklist(spark, MEMBERS, ['u1', 'u2'], [250000, null, 1200000]);
  assert.equal(c.ready, true);
  assert.equal(c.stepsTotal, 1450000);
});

test('sparkChecklist: skridt uden beløb opfylder ikke beløb', () => {
  const spark = { ...READY_SPARK, estimated_amount: null };
  const c = sparkChecklist(spark, MEMBERS, ['u1', 'u2'], [null, null]);
  assert.equal(c.items.find((i) => i.key === 'amount_month')?.done, false);
  assert.equal(c.stepsTotal, null);
});

test('sparkChecklist: skridt erstatter ikke måneden', () => {
  const spark = { ...READY_SPARK, target_month: null };
  assert.equal(sparkChecklist(spark, MEMBERS, ['u1', 'u2'], [250000]).ready, false);
});
