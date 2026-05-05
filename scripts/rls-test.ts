// RLS-isolation test matrix. Kører cross-household SELECT/INSERT/UPDATE/
// DELETE for alle relevante tabeller via PostgREST (Supabase REST API)
// for at validere RLS på database-niveau, ikke i app-laget.
//
// Strategi:
//   1. Log ind som testA1 (Household A) for at hente IDs i HH-A
//   2. Log ind som testB1 (Household B) - JWT'en bruges til alle
//      cross-household-forsøg
//   3. Kør anonyme tests UDEN Bearer-header
//   4. Output: pass/fail-tabel
//
// Brug:
//   npx tsx scripts/rls-test.ts
//
// Bruger NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// fra .env.local. Service-role-keyen er IKKE nødvendig.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnv() {
  let path = join(process.cwd(), '.env.local');
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (e) {
    console.error(`[debug] kunne ikke læse ${path}:`, (e as Error).message);
    return;
  }
  // Strip BOM hvis filen er gemt med UTF-8 BOM
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  let count = 0;
  // Split på både Windows CRLF og Unix LF.
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip omgivende anførselstegn
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
      count++;
    }
  }
  console.log(`[debug] loaded ${count} env vars fra .env.local`);
}
loadDotEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !ANON) {
  console.error('FEJL: NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY skal være i .env.local');
  console.error(`[debug] URL: ${URL ?? '(ikke sat)'}`);
  console.error(`[debug] ANON: ${ANON ? '(sat, ' + ANON.length + ' tegn)' : '(ikke sat)'}`);
  process.exit(1);
}

// Hardcoded IDs fra setup-test-users.sql
const HH_A = '11111111-1111-1111-1111-111111111111';
const HH_B = '22222222-2222-2222-2222-222222222222';
const ACC_A = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const CAT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A1 = 'a1111111-1111-1111-1111-111111111111';

// ----------------------------------------------------------------------------
// PostgREST helper
// ----------------------------------------------------------------------------

type RestResult = { status: number; rows: unknown[] | null; raw: string };

async function rest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  jwt: string | null,
  body?: unknown
): Promise<RestResult> {
  const headers: Record<string, string> = {
    apikey: ANON!,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let rows: unknown[] | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    rows = null;
  }
  return { status: res.status, rows, raw };
}

// ----------------------------------------------------------------------------
// Test runner
// ----------------------------------------------------------------------------

type TestRow = {
  area: string;
  test: string;
  expected: string;
  actual: string;
  pass: boolean;
};

const results: TestRow[] = [];

// Pass/fail-status passes eksplicit ind så vi ikke laver fejlfortolkning
// af f.eks. "HTTP 4xx OR 0 rows" som streng-equality.
function record(
  area: string,
  test: string,
  pass: boolean,
  expected: string,
  actual: string
) {
  results.push({ area, test, expected, actual, pass });
  console.log(`${pass ? '✓' : '✗'} [${area}] ${test}: ${actual}`);
}

// ----------------------------------------------------------------------------
// Sign-in
// ----------------------------------------------------------------------------

async function signIn(email: string): Promise<string> {
  const sb = createClient(URL!, ANON!);
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: 'Abc123456',
  });
  if (error || !data.session) {
    throw new Error(`signIn ${email}: ${error?.message ?? 'no session'}`);
  }
  return data.session.access_token;
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

// Helper: short summary of a result for the actual-column.
function summarise(r: RestResult): string {
  if (r.status >= 400) return `HTTP ${r.status}`;
  if (r.rows && r.rows.length > 0) return `HTTP ${r.status}, ${r.rows.length} rows LEAKED`;
  if (r.rows && r.rows.length === 0) return `HTTP ${r.status}, 0 rows`;
  return `HTTP ${r.status}`;
}

// Tabel-konfiguration: vi probaer hver tabel for SELECT/INSERT/UPDATE/DELETE.
type TableSpec = {
  name: string;
  // ID-kolonne der peger på en row i HH-A (kan probes for UPDATE/DELETE)
  knownIdColumn?: string;
  knownIdValue?: string;
  // INSERT-payload som "tries to put data into HH-A as B-user"
  insertPayload?: Record<string, unknown>;
  // UPDATE-payload (felt + ny værdi)
  updatePayload?: Record<string, unknown>;
};

// Dynamiske IDs der hentes fra HH-A via testA1's JWT inden matricen kører.
// Sat efter discoverIds() har kørt.
let TXN_A: string | undefined;
let COMPONENT_A: string | undefined;
let INVITE_A: string | undefined;
let PREDICTABLE_A: string | undefined;

const TABLES_FACTORY = (): TableSpec[] => [
  {
    name: 'accounts',
    knownIdColumn: 'id',
    knownIdValue: ACC_A,
    insertPayload: {
      household_id: HH_A,
      name: 'PWNED account from B',
      kind: 'checking',
      created_by: USER_A1,
      editable_by_all: true,
      opening_balance: 999,
    },
    updatePayload: { name: 'HACKED' },
  },
  {
    name: 'categories',
    knownIdColumn: 'id',
    knownIdValue: CAT_A,
    insertPayload: {
      household_id: HH_A,
      name: 'PWNED category',
      kind: 'expense',
      color: '#000000',
    },
    updatePayload: { name: 'HACKED' },
  },
  {
    name: 'transactions',
    // Ingen kendt ID hardcoded; vi finder en via SELECT som testA1 først
    insertPayload: {
      household_id: HH_A,
      account_id: ACC_A,
      category_id: CAT_A,
      amount: 99999,
      description: 'PWNED transaction from B',
      occurs_on: '2026-01-01',
      recurrence: 'once',
    },
    updatePayload: { description: 'HACKED' },
  },
  {
    name: 'transfers',
    insertPayload: {
      household_id: HH_A,
      from_account_id: ACC_A,
      to_account_id: ACC_A,
      amount: 99999,
      description: 'PWNED transfer',
      occurs_on: '2026-01-01',
      recurrence: 'once',
    },
    updatePayload: { description: 'HACKED' },
  },
  {
    name: 'family_members',
    knownIdColumn: 'user_id',
    knownIdValue: USER_A1,
    updatePayload: { role: 'owner', name: 'HACKED' },
  },
  {
    name: 'households',
    knownIdColumn: 'id',
    knownIdValue: HH_A,
    updatePayload: { name: 'HACKED' },
  },
  {
    name: 'feedback',
    insertPayload: {
      household_id: HH_A,
      user_id: USER_A1,
      message: 'PWNED feedback',
      page_url: 'https://evil.com',
    },
  },
  {
    name: 'household_invites',
    knownIdColumn: INVITE_A ? 'id' : undefined,
    knownIdValue: INVITE_A,
    insertPayload: {
      household_id: HH_A,
      created_by: USER_A1,
      code: 'PWNED01',
    },
    updatePayload: { code: 'HACKED1' },
  },
  {
    name: 'transaction_components',
    knownIdColumn: COMPONENT_A ? 'id' : undefined,
    knownIdValue: COMPONENT_A,
    insertPayload: TXN_A
      ? {
          household_id: HH_A,
          transaction_id: TXN_A,
          label: 'PWNED component',
          amount: 999,
        }
      : undefined,
    updatePayload: { label: 'HACKED' },
  },
  {
    name: 'predictable_estimates',
    knownIdColumn: PREDICTABLE_A ? 'id' : undefined,
    knownIdValue: PREDICTABLE_A,
    insertPayload: {
      household_id: HH_A,
      label: 'PWNED estimate',
      yearly_amount: 99999,
    },
    updatePayload: { label: 'HACKED' },
  },
  {
    name: 'rate_limits',
    // rate_limits har ingen RLS-policies - ALL access skal afvises
    // (default deny). Vi tester at SELECT/INSERT/UPDATE/DELETE alle
    // er blokeret. Tabellen har ikke household_id.
    insertPayload: {
      key: 'evil-key',
      route: 'signup',
    },
  },
];

async function runMatrix(label: string, jwt: string | null) {
  console.log(`\n========================================================`);
  console.log(`Test-suite: ${label}`);
  console.log(`========================================================`);

  const TABLES = TABLES_FACTORY();

  for (const t of TABLES) {
    // households-tabellen har kolonnen 'id' (ikke 'household_id'); for alle
    // andre filtrerer vi på household_id. rate_limits har slet ikke
    // household_id, så vi springer den filter-baserede SELECT over.
    const filterCol = t.name === 'households' ? 'id' : 'household_id';
    const skipCrossHouseholdSelect = t.name === 'rate_limits';

    // 1. SELECT all - skal returnere 0 rows pga RLS
    if (!skipCrossHouseholdSelect) {
      const sel = await rest('GET', `${t.name}?${filterCol}=eq.${HH_A}`, jwt);
      const selOk = sel.status === 200 && (sel.rows?.length ?? 0) === 0;
      record(t.name, 'SELECT cross-household', selOk, 'HTTP 200, 0 rows', summarise(sel));
    } else {
      // For rate_limits: bare SELECT alle rows - skal returnere 0 (eller 4xx)
      const sel = await rest('GET', `${t.name}?limit=10`, jwt);
      const selOk = sel.status >= 400 || (sel.status === 200 && (sel.rows?.length ?? 0) === 0);
      record(t.name, 'SELECT all (deny-by-default)', selOk, 'HTTP 4xx OR 0 rows', summarise(sel));
    }

    // 2. SELECT specific row by known ID
    if (t.knownIdColumn && t.knownIdValue) {
      const selById = await rest(
        'GET',
        `${t.name}?${t.knownIdColumn}=eq.${t.knownIdValue}`,
        jwt
      );
      const selByIdOk = selById.status === 200 && (selById.rows?.length ?? 0) === 0;
      record(
        t.name,
        `SELECT by id`,
        selByIdOk,
        'HTTP 200, 0 rows',
        summarise(selById)
      );
    }

    // 3. INSERT cross-household
    if (t.insertPayload) {
      const ins = await rest('POST', t.name, jwt, t.insertPayload);
      // Pass: enten afvist (4xx) ELLER 0 rows returned
      const insOk =
        ins.status >= 400 ||
        (ins.rows !== null && ins.rows.length === 0);
      record(
        t.name,
        'INSERT cross-household',
        insOk,
        'HTTP 4xx OR 0 rows',
        summarise(ins) + (insOk ? '' : ' [BREACH]')
      );
    }

    // 4. UPDATE cross-household
    if (t.knownIdColumn && t.knownIdValue && t.updatePayload) {
      const upd = await rest(
        'PATCH',
        `${t.name}?${t.knownIdColumn}=eq.${t.knownIdValue}`,
        jwt,
        t.updatePayload
      );
      const updOk =
        upd.status >= 400 ||
        (upd.rows !== null && upd.rows.length === 0);
      record(
        t.name,
        'UPDATE cross-household',
        updOk,
        'HTTP 4xx OR 0 rows',
        summarise(upd) + (updOk ? '' : ' [BREACH]')
      );
    }

    // 5. DELETE cross-household
    if (t.knownIdColumn && t.knownIdValue) {
      const del = await rest(
        'DELETE',
        `${t.name}?${t.knownIdColumn}=eq.${t.knownIdValue}`,
        jwt
      );
      const delOk =
        del.status >= 400 ||
        (del.rows !== null && del.rows.length === 0);
      record(
        t.name,
        'DELETE cross-household',
        delOk,
        'HTTP 4xx OR 0 rows',
        summarise(del) + (delOk ? '' : ' [BREACH]')
      );
    }
  }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function discoverIds(jwtA1: string) {
  // Hent IDs fra HH-A som testA1 så cross-household-tests har rigtige
  // mål-rows at angribe. Tabeller hvor vi ikke har test-data lader vi
  // bare være tomme - matrixen springer SELECT-by-id og UPDATE/DELETE
  // over for dem.
  const txnRes = await rest('GET', `transactions?household_id=eq.${HH_A}&select=id&limit=1`, jwtA1);
  TXN_A = (txnRes.rows?.[0] as { id?: string } | undefined)?.id;

  // Opret en test-invite så vi har noget at angribe.
  const inviteIns = await rest('POST', 'household_invites', jwtA1, {
    household_id: HH_A,
    created_by: USER_A1,
  });
  INVITE_A = (inviteIns.rows?.[0] as { id?: string } | undefined)?.id;

  // Forsøg at oprette en transaction_component (kræver transaction_id i HH-A).
  if (TXN_A) {
    const compIns = await rest('POST', 'transaction_components', jwtA1, {
      household_id: HH_A,
      transaction_id: TXN_A,
      label: 'Sanity-component',
      amount: 100,
    });
    COMPONENT_A = (compIns.rows?.[0] as { id?: string } | undefined)?.id;
  }

  // Opret en predictable_estimate.
  const predIns = await rest('POST', 'predictable_estimates', jwtA1, {
    household_id: HH_A,
    label: 'Sanity-estimate',
    yearly_amount: 1200,
  });
  PREDICTABLE_A = (predIns.rows?.[0] as { id?: string } | undefined)?.id;

  console.log(`[discover] TXN_A=${TXN_A?.slice(0, 8) ?? 'none'} ` +
    `COMPONENT_A=${COMPONENT_A?.slice(0, 8) ?? 'none'} ` +
    `INVITE_A=${INVITE_A?.slice(0, 8) ?? 'none'} ` +
    `PREDICTABLE_A=${PREDICTABLE_A?.slice(0, 8) ?? 'none'}`);
}

async function main() {
  console.log('RLS Cross-household isolation test matrix');
  console.log(`Mål: ${URL}`);

  // Sanity-tjek: testA1 kan SE sin egen data
  const jwtA1 = await signIn('mikkelstaehrmadsen+testA1@gmail.com');
  const sanityA = await rest('GET', `accounts?household_id=eq.${HH_A}`, jwtA1);
  console.log(`\nSanity (testA1 ser sin egen HH-A): HTTP ${sanityA.status}, ${sanityA.rows?.length ?? 0} rows`);
  if (!sanityA.rows || sanityA.rows.length === 0) {
    console.error('FEJL: testA1 kan ikke se sin egen data. Stopper.');
    process.exit(1);
  }

  await discoverIds(jwtA1);

  // Kør cross-household tests som testB1
  const jwtB1 = await signIn('mikkelstaehrmadsen+testB1@gmail.com');
  await runMatrix('testB1 → HH-A (cross-household)', jwtB1);

  // Kør tests som outsider (egen husstand, ingen relation til HH-A)
  const jwtOutsider = await signIn('mikkelstaehrmadsen+testOutsider@gmail.com');
  await runMatrix('testOutsider → HH-A (cross-household)', jwtOutsider);

  // Kør tests anonymt (ingen JWT, kun apikey)
  await runMatrix('Anonym (ingen JWT)', null);

  // Sammenfatning
  const total = results.length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n========================================================`);
  console.log(`Total: ${total} tests, ${failed} fejlede`);
  console.log(`========================================================`);

  if (failed > 0) {
    console.log('\nFEJLEDE TESTS:');
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  [${r.area}] ${r.test}`);
      console.log(`    expected: ${r.expected}`);
      console.log(`    actual:   ${r.actual}`);
    }
    process.exit(1);
  }

  console.log('\n✓ ALLE RLS-TESTS PASSED. Cross-household-isolation er intakt.');
}

main().catch((err) => {
  console.error('\nTest-runner fejlede:', err);
  process.exit(1);
});
