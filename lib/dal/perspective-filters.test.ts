// Pure-function tests for privateAccountFilter - PostgREST-or-strengen
// der geninstallerer accounts-RLS i proxy-mode (admin-client bypasser
// RLS, så vi laver det manuelt). Bug i denne streng = data-leak eller
// missing-data.
//
// getPerspective() og getVisibleAccountIds() er IO-tunge (Supabase
// auth + DB-queries) - de testes ikke her, men deres pure helper
// `privateAccountFilter` er den kritiske komponent: forkert filter-
// streng = forkerte queries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateAccountFilter } from './auth';

const MIKKEL = '11111111-1111-1111-1111-111111111111';
const LOUISE = '22222222-2222-2222-2222-222222222222';

// Hjælper: lav en minimal Perspective-shape som privateAccountFilter
// forventer. Vi sender den eksplicit ind så vi ikke er afhængige af
// auth-context i tests.
function perspective(opts: {
  isProxyActive: boolean;
  authUserId: string;
  perspectiveUserId: string;
}) {
  return {
    // Mock supabase + householdId - filteret bruger dem ikke
    supabase: null as never,
    householdId: 'household-x',
    perspectiveUserId: opts.perspectiveUserId,
    authUserId: opts.authUserId,
    isProxyActive: opts.isProxyActive,
    grantorName: null,
    grantId: null,
  };
}

test('normal mode: filter dækker editable_by_all + caller created', () => {
  const p = perspective({
    isProxyActive: false,
    authUserId: MIKKEL,
    perspectiveUserId: MIKKEL,
  });
  const f = privateAccountFilter(p);
  assert.equal(f, `editable_by_all.eq.true,created_by.eq.${MIKKEL}`);
});

test('proxy mode: filter dækker editable_by_all + grantor + caller (union)', () => {
  const p = perspective({
    isProxyActive: true,
    authUserId: MIKKEL,
    perspectiveUserId: LOUISE,
  });
  const f = privateAccountFilter(p);
  // Begge UUIDs skal være med så Mikkel ser BÅDE Louises private og sine egne
  assert.match(f, /editable_by_all\.eq\.true/);
  assert.match(f, new RegExp(`created_by\\.eq\\.${LOUISE}`));
  assert.match(f, new RegExp(`created_by\\.eq\\.${MIKKEL}`));
});

test('proxy mode hvor auth=perspective (kunstig case) bruger non-union form', () => {
  // Edge: hvis isProxyActive=true men authUserId == perspectiveUserId,
  // er det egentlig ikke proxy. Helperen falder tilbage til single-id-form.
  const p = perspective({
    isProxyActive: true,
    authUserId: MIKKEL,
    perspectiveUserId: MIKKEL,
  });
  const f = privateAccountFilter(p);
  assert.equal(f, `editable_by_all.eq.true,created_by.eq.${MIKKEL}`);
});

test('REGRESSION: filter er PostgREST .or()-kompatibel kommasepareret streng', () => {
  // PostgREST forventer at .or() får en streng som `cond1,cond2,cond3`
  // Vi opretter den manuelt; hvis vi nogensinde quoter eller wrapper i
  // parentheses bryder vi syntaksen.
  const p = perspective({
    isProxyActive: true,
    authUserId: MIKKEL,
    perspectiveUserId: LOUISE,
  });
  const f = privateAccountFilter(p);
  // Skal ikke have wrapping parens eller mellemrum mellem clauses
  assert.equal(f.includes(' '), false);
  assert.equal(f.startsWith('('), false);
  assert.equal(f.endsWith(')'), false);
  // Skal ha kommaer mellem clauses
  assert.equal(f.split(',').length, 3); // tre clauses i proxy-mode
});
