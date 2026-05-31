// Pure-function tests for computePrivatFaelles + classifyAccountTrack.
//
// computePrivatFaelles er drevende for dashboardets 2-3 panels og er
// blevet refactoret flere gange (v1.5 partnerPanel, v2.1 unified
// klassifikator-delegering). Tests fanger regressioner i aggregations-
// logikken når partner-panelet kommer i spil.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAccountTrack,
  computePrivatFaelles,
} from './cashflow-analysis';
import type { Account } from './database.types';
import type { AccountCashflowDetail } from './dal';

const MIKKEL = '11111111-1111-1111-1111-111111111111';
const LOUISE = '22222222-2222-2222-2222-222222222222';

// Account-factory så tests er læselige. Felter vi ikke bruger i tests
// får sane defaults så vi kan bruge `as Account` uden TS-trick.
function acc(opts: {
  id: string;
  name: string;
  created_by: string;
  editable_by_all?: boolean;
  owner_name?: string | null;
  kind?: Account['kind'];
  archived?: boolean;
}): Account {
  return {
    id: opts.id,
    name: opts.name,
    household_id: 'household-x',
    owner_name: opts.owner_name ?? null,
    kind: opts.kind ?? 'checking',
    opening_balance: 0,
    archived: opts.archived ?? false,
    created_at: '2026-01-01',
    editable_by_all: opts.editable_by_all ?? false,
    created_by: opts.created_by,
    monthly_budget: null,
    investment_type: null,
    savings_purposes: null,
    // Felter vi ikke bryder os om - cast for at undgå at oplyse alle
  } as unknown as Account;
}

function flow(opts: {
  income?: number;
  myIncome?: number;
  expense?: number;
  transfersIn?: number;
  transfersOut?: number;
}): AccountCashflowDetail {
  return {
    income: opts.income ?? 0,
    myIncome: opts.myIncome ?? 0,
    expense: opts.expense ?? 0,
    transfersIn: opts.transfersIn ?? 0,
    transfersOut: opts.transfersOut ?? 0,
  };
}

// ---------------------------------------------------------------------------
// classifyAccountTrack (delegerings-wrapper)
// ---------------------------------------------------------------------------

test('classifyAccountTrack mapper unified-helper output til legacy tracks', () => {
  const mineLonkonto = acc({ id: 'a', name: 'Mikkel', created_by: MIKKEL });
  const louisesLonkonto = acc({ id: 'b', name: 'Louise', created_by: LOUISE });
  const faelles = acc({
    id: 'c',
    name: 'Budget',
    created_by: MIKKEL,
    editable_by_all: true,
  });
  assert.equal(classifyAccountTrack(mineLonkonto, MIKKEL), 'privat');
  assert.equal(classifyAccountTrack(louisesLonkonto, MIKKEL), 'other');
  assert.equal(classifyAccountTrack(faelles, MIKKEL), 'faelles');
});

// ---------------------------------------------------------------------------
// computePrivatFaelles - normal mode (2 panels)
// ---------------------------------------------------------------------------

test('normal mode: privat = mine konti, faelles = delte konti', () => {
  const accounts = [
    acc({ id: 'a', name: 'Mikkel Lønkonto', created_by: MIKKEL }),
    acc({
      id: 'b',
      name: 'Budget',
      created_by: MIKKEL,
      editable_by_all: true,
    }),
  ];
  const perAccount = new Map([
    ['a', flow({ income: 30000, myIncome: 30000, transfersOut: 12000 })],
    ['b', flow({ expense: 12000, transfersIn: 12000 })],
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL);

  assert.equal(result.privat.income, 30000); // bruger myIncome i normal-mode
  assert.equal(result.privat.transfersOut, 12000);
  assert.equal(result.privat.net, 30000 - 12000);
  assert.equal(result.faelles.expense, 12000);
  assert.equal(result.faelles.transfersIn, 12000);
  assert.equal(result.faelles.net, 0);
  assert.equal(result.partner, undefined); // intet 3. panel uden proxy
});

test('normal mode: partnerens konti ignoreres (ikke i mit overblik)', () => {
  const accounts = [
    acc({ id: 'a', name: 'Mikkel Lønkonto', created_by: MIKKEL }),
    acc({ id: 'b', name: 'Louise Lønkonto', created_by: LOUISE }),
  ];
  const perAccount = new Map([
    ['a', flow({ income: 30000, myIncome: 30000 })],
    ['b', flow({ income: 25000, myIncome: 25000 })],
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL);

  assert.equal(result.privat.income, 30000); // kun mine paychecks
  assert.equal(result.privat.net, 30000);
  // Louises konto er 'other' track - skipped i aggregation
});

test('REGRESSION: archived/credit-konti tæller IKKE med i aggregaterne', () => {
  const accounts = [
    acc({ id: 'a', name: 'Aktiv', created_by: MIKKEL }),
    acc({ id: 'b', name: 'Arkiveret', created_by: MIKKEL, archived: true }),
    acc({ id: 'c', name: 'Lån', created_by: MIKKEL, kind: 'credit' }),
  ];
  const perAccount = new Map([
    ['a', flow({ income: 10000, myIncome: 10000 })],
    ['b', flow({ income: 99999, myIncome: 99999 })], // bør IKKE tælle
    ['c', flow({ income: 88888, myIncome: 88888 })], // bør IKKE tælle
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL);
  assert.equal(result.privat.income, 10000); // arkiveret + credit skipped
});

// ---------------------------------------------------------------------------
// computePrivatFaelles - proxy mode (3 panels)
// ---------------------------------------------------------------------------

test('proxy mode: partner-panel aggregerer Louises konti separat', () => {
  const accounts = [
    acc({ id: 'a', name: 'Mikkel Lønkonto', created_by: MIKKEL }),
    acc({ id: 'b', name: 'Louise Lønkonto', created_by: LOUISE }),
    acc({
      id: 'c',
      name: 'Budget',
      created_by: MIKKEL,
      editable_by_all: true,
    }),
  ];
  const perAccount = new Map([
    ['a', flow({ income: 30000, myIncome: 30000, transfersOut: 10000 })],
    ['b', flow({ income: 25000, myIncome: 0, transfersOut: 8000 })],
    ['c', flow({ expense: 18000, transfersIn: 18000 })],
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL, {
    partnerUserId: LOUISE,
    partnerName: 'Louise',
  });

  // Mikkels privat-panel (bruger d.income i proxy, ikke d.myIncome)
  assert.equal(result.privat.income, 30000);
  assert.equal(result.privat.transfersOut, 10000);
  assert.equal(result.privat.net, 20000);

  // Louises partner-panel
  assert.ok(result.partner !== undefined);
  assert.equal(result.partner!.income, 25000); // d.income, ikke myIncome
  assert.equal(result.partner!.transfersOut, 8000);
  assert.equal(result.partner!.net, 17000);
  assert.equal(result.partner!.name, 'Louise');

  // Fælles panel uændret
  assert.equal(result.faelles.expense, 18000);
});

test('proxy mode: partner uden konti giver tom partner-blok men ikke undefined', () => {
  const accounts = [acc({ id: 'a', name: 'Mikkel Lønkonto', created_by: MIKKEL })];
  const perAccount = new Map([
    ['a', flow({ income: 30000, myIncome: 30000 })],
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL, {
    partnerUserId: LOUISE,
    partnerName: 'Louise',
  });
  assert.ok(result.partner !== undefined);
  assert.equal(result.partner!.income, 0);
  assert.equal(result.partner!.net, 0);
  assert.equal(result.partner!.name, 'Louise');
});

test('REGRESSION: proxy bruger d.income (ikke d.myIncome) på begge private tracks', () => {
  // Bug-class: hvis vi fejlagtigt bruger d.myIncome i proxy, vil partner-
  // panel vise 0 fordi myMemberId i cashflow.ts kun peger på én side.
  const accounts = [
    acc({ id: 'a', name: 'Mikkel Lønkonto', created_by: MIKKEL }),
    acc({ id: 'b', name: 'Louise Lønkonto', created_by: LOUISE }),
  ];
  const perAccount = new Map([
    // Bemærk: myIncome er 0 på begge - simulerer at myMemberId peger
    // på en tredje person eller er null. d.income skal stadig give korrekt
    // aggregat i proxy-mode.
    ['a', flow({ income: 30000, myIncome: 0 })],
    ['b', flow({ income: 25000, myIncome: 0 })],
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL, {
    partnerUserId: LOUISE,
    partnerName: 'Louise',
  });
  assert.equal(result.privat.income, 30000); // d.income bruges, ikke 0
  assert.equal(result.partner!.income, 25000);
});

test('proxy + en konto skabt af ukendt user: ignoreres fra alle 3 panels', () => {
  const STRANGER = '99999999-9999-9999-9999-999999999999';
  const accounts = [
    acc({ id: 'a', name: 'Mikkel', created_by: MIKKEL }),
    acc({ id: 'b', name: 'Louise', created_by: LOUISE }),
    acc({ id: 'c', name: 'Stranger', created_by: STRANGER }),
  ];
  const perAccount = new Map([
    ['a', flow({ income: 10000, myIncome: 10000 })],
    ['b', flow({ income: 20000 })],
    ['c', flow({ income: 99999 })], // skal IKKE indgå i partner-panel
  ]);
  const result = computePrivatFaelles(accounts, perAccount, MIKKEL, {
    partnerUserId: LOUISE,
    partnerName: 'Louise',
  });
  assert.equal(result.privat.income, 10000);
  assert.equal(result.partner!.income, 20000); // KUN Louise, ikke stranger
});
