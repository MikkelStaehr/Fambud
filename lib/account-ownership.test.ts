// Pure-function tests for classifyAccountOwnership + groupAccountsByOwnership.
//
// Køres via Node 20's indbyggede test-runner:
//   npx tsx --test lib/account-ownership.test.ts
//
// Vi bruger tsx (allerede en dev-dep) i stedet for at sætte vitest op fordi
// helperen er ren TypeScript uden React/JSX og uden DB-dependencies. Pure
// funktioner = simple snapshot-tests dækker bag-kontrakten.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAccountOwnership,
  groupAccountsByOwnership,
} from './account-ownership';

const MIKKEL = 'user-mikkel';
const LOUISE = 'user-louise';

const mineLonkonto = {
  owner_name: 'Mikkel',
  created_by: MIKKEL,
  editable_by_all: false,
};
const louisesLonkonto = {
  owner_name: 'Louise',
  created_by: LOUISE,
  editable_by_all: false,
};
const faellesBudget = {
  owner_name: 'Fælles',
  created_by: MIKKEL, // oprettet af Mikkel men markeret som fælles
  editable_by_all: true,
};
// Konstrueret edge case: lønkonto fejlagtigt mærket "Fælles" som label
const mineLonkontoMedDaarligLabel = {
  owner_name: 'Fælles',
  created_by: MIKKEL,
  editable_by_all: false,
};

// ---------------------------------------------------------------------------
// classifyAccountOwnership
// ---------------------------------------------------------------------------

test('mine konti klassificeres som "mine" i normal-mode', () => {
  const r = classifyAccountOwnership(mineLonkonto, { currentUserId: MIKKEL });
  assert.equal(r.track, 'mine');
  assert.equal(r.label, 'Dig');
});

test('mine konti bruger currentLabel-prop som label', () => {
  const r = classifyAccountOwnership(mineLonkonto, {
    currentUserId: MIKKEL,
    currentLabel: 'Mikkel',
  });
  assert.equal(r.label, 'Mikkel');
});

test('fælles-konti klassificeres som "shared"', () => {
  const r = classifyAccountOwnership(faellesBudget, { currentUserId: MIKKEL });
  assert.equal(r.track, 'shared');
  assert.equal(r.label, 'Fælles');
});

test('partner-konti klassificeres som "partner" når partnerUserId er sat', () => {
  const r = classifyAccountOwnership(louisesLonkonto, {
    currentUserId: MIKKEL,
    partnerUserId: LOUISE,
    partnerLabel: 'Louise',
  });
  assert.equal(r.track, 'partner');
  assert.equal(r.label, 'Louise');
});

test('partner-konti uden partnerUserId klassificeres som "other"', () => {
  const r = classifyAccountOwnership(louisesLonkonto, { currentUserId: MIKKEL });
  assert.equal(r.track, 'other');
  assert.equal(r.label, 'Louise'); // owner_name-fallback
});

test('REGRESSION: lønkonto med owner_name="Fælles" tilhører stadig oprøreren', () => {
  // V1 bug: AccountSelectGrouped + classifyAccountTrack klassificerede
  // denne som "Fælles" pga owner_name. Den skulle være "mine".
  const r = classifyAccountOwnership(mineLonkontoMedDaarligLabel, {
    currentUserId: MIKKEL,
  });
  assert.equal(r.track, 'mine');
});

test('ingen context: alt med editable_by_all eller Fælles-label er shared', () => {
  assert.equal(classifyAccountOwnership(faellesBudget).track, 'shared');
  assert.equal(classifyAccountOwnership(mineLonkonto).track, 'other');
});

test('null/undefined owner_name -> "Andet" fallback for "other"', () => {
  const r = classifyAccountOwnership({
    owner_name: null,
    created_by: 'someone-else',
    editable_by_all: false,
  });
  assert.equal(r.track, 'other');
  assert.equal(r.label, 'Andet');
});

// ---------------------------------------------------------------------------
// groupAccountsByOwnership
// ---------------------------------------------------------------------------

test('grupper sorteres: Dig -> Partner -> Fælles -> alfabetisk', () => {
  const accounts = [
    { id: 'b', name: 'Budget', ...faellesBudget },
    { id: 'l', name: 'Louise lønkonto', ...louisesLonkonto },
    { id: 'm', name: 'Mikkel lønkonto', ...mineLonkonto },
  ];
  const groups = groupAccountsByOwnership(accounts, {
    currentUserId: MIKKEL,
    currentLabel: 'Mikkel',
    partnerUserId: LOUISE,
    partnerLabel: 'Louise',
  });
  assert.deepEqual(
    groups.map((g) => g.label),
    ['Mikkel', 'Louise', 'Fælles']
  );
});

test('uden partnerUserId vises Louises konti i "other"-track', () => {
  const accounts = [
    { id: 'l', name: 'Louise lønkonto', ...louisesLonkonto },
    { id: 'm', name: 'Mikkel lønkonto', ...mineLonkonto },
  ];
  const groups = groupAccountsByOwnership(accounts, {
    currentUserId: MIKKEL,
    currentLabel: 'Mikkel',
  });
  assert.equal(groups.length, 2);
  // Mikkel først, derefter "Louise" (fallback fra owner_name)
  assert.equal(groups[0].label, 'Mikkel');
  assert.equal(groups[1].label, 'Louise');
});

test('tom accounts-liste giver tomme grupper', () => {
  const groups = groupAccountsByOwnership([], { currentUserId: MIKKEL });
  assert.deepEqual(groups, []);
});
