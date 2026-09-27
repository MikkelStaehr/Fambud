// Tests for Famtask-tildelingsmailen (migration 0075).
//
// Køres via Node 20's indbyggede test-runner:
//   npx tsx --test lib/email/famtask-assignment.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFamtaskAssignmentEmail, type FamtaskAssignmentEmail } from './famtask-assignment';

const BASE: FamtaskAssignmentEmail = {
  firstName: 'Louise',
  assignerName: 'Mikkel',
  kind: 'project',
  title: 'Terrasse',
  purpose: 'Mere plads til\nhavemøblerne',
  amount: 4500000,
  month: '2027-05-01',
  url: 'https://www.fambud.dk/famtask/abc',
  settingsUrl: 'https://www.fambud.dk/indstillinger/profil',
};

test('emne og tekst nævner hvem, hvad og linket', () => {
  const m = buildFamtaskAssignmentEmail(BASE);
  assert.equal(m.subject, 'Mikkel har gjort dig ansvarlig for Terrasse');
  assert.match(m.text, /Mikkel har gjort dig ansvarlig for projektet "Terrasse"/);
  assert.match(m.text, /Åbn projektet: https:\/\/www\.fambud\.dk\/famtask\/abc/);
  assert.match(m.text, /Måned: maj 2027/);
  assert.match(m.html, /Åbn projektet<\/a>/);
});

test('spark bruger "sparken"', () => {
  const m = buildFamtaskAssignmentEmail({ ...BASE, kind: 'spark' });
  assert.match(m.text, /ansvarlig for sparken "Terrasse"/);
  assert.match(m.html, /Åbn sparken<\/a>/);
});

test('brugerindhold escapes i HTML', () => {
  const m = buildFamtaskAssignmentEmail({
    ...BASE,
    title: '<script>alert(1)</script>',
    purpose: 'a & b "c"',
    assignerName: '<b>X</b>',
  });
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(m.html, /a &amp; b &quot;c&quot;/);
  assert.match(m.html, /&lt;b&gt;X&lt;\/b&gt; har gjort dig ansvarlig/);
});

test('linjeskift i formål bliver til <br> i HTML', () => {
  const m = buildFamtaskAssignmentEmail(BASE);
  assert.match(m.html, /Mere plads til<br>havemøblerne/);
});

test('tomme felter udelades', () => {
  const m = buildFamtaskAssignmentEmail({ ...BASE, purpose: null, amount: null, month: null });
  assert.doesNotMatch(m.text, /Formål|Beløb|Måned/);
  assert.doesNotMatch(m.html, /<table/);
});
