# Retningslinjer for AI-assistans i FamBud

Den her fil bliver automatisk læst af Claude Code som persistent context.
Hvis du er en ny udvikler, eller en ny AI-session, og undrer dig over
hvorfor en regel findes — start her.

Reference til den fulde sikkerheds- og automation-historik:

- [SECURITY_AUDITS.md](SECURITY_AUDITS.md) — 13 audit-prompts gennemført
  6. maj 2026, 24 P-items roadmap, alle CI-gates dokumenteret
- [DEVLOG.md](DEVLOG.md) — kronologisk projekthistorik
- [docs/ci-security.md](docs/ci-security.md) — CI/CD-gates og branch
  protection-konfig

---

## 1. Em-dash er forbudt i kildekoden

**Reglen**: ingen em-dash (—, U+2014) i `app/**/*.{tsx,ts}` eller
`lib/**/*.{tsx,ts}`. Håndhævet via Semgrep custom rule
`fambud-no-em-dash` (se [semgrep-rules/fambud.yaml](semgrep-rules/fambud.yaml)).

**Hvorfor**:

1. **AI-fingeraftryk**: em-dash er en af de mest pålidelige signaler
   om at en tekst er genereret af en LLM. Claude, GPT og andre store
   modeller bruger det som default-tegnsætning. Når en dansk bruger
   ser em-dash i copy, mærker de subliminalt "det her er AI-skrevet"
   selv hvis de ikke kan formulere hvorfor.

2. **Konsistensproblem ved AI-assist-flow**: vi copy-paster meget fra
   Claude Code's output direkte ind i copy-forslag (Claude i denne
   chat har selv brugt em-dash dusinvis af gange i denne sessions
   tråd). Uden en lint-regel ender det i prod efter et stykke tid.

3. **Manuel purge skaler ikke**: vi har lavet em-dash-purges manuelt
   to gange i denne uge. En CI-regel er billigere end at gentage det
   hver 3. måned.

**Hvad du skal gøre i stedet**:

- Komma: når en pause er kort og parentetisk
- Punktum: når sætningen slutter
- Kolon: når næste del uddyber den forrige
- En-dash (–, U+2013): for "ingen-værdi"-UI-placeholders i tabeller
  (typografisk konvention for tomme tal-felter)

**Hvor er det OK**:

- Markdown-filer (DEVLOG.md, SECURITY_AUDITS.md, docs/) — internal,
  læses af mennesker
- Kommentarer i kode — usynlige for brugeren, men vi har ryddet op
  alligevel for konsistens
- Bevidst brug i citater eller UI-symboler — tilføj
  `// nosemgrep: fambud-no-em-dash`

**Reglen aktiveret**: 6. maj 2026 efter projektleder-feedback om
AI-fingeraftryk-disciplin.

---

## 2. Mass-assignment-pattern på Server Actions

**Reglen**: ingen `Object.fromEntries(formData)`, `...formData`-spread,
eller `formData.get('household_id'|'role'|'user_id'|'owner_user_id'|...)`.
Privilegerede felter må ALDRIG læses fra request — de skal komme fra
`getHouseholdContext()` server-side.

**Hvorfor**: vores IDOR-resistance er konventionel (ikke strukturel).
Hver Server Action læser felter eksplicit med `formData.get('field_name')`
og pakker dem i et hardkodet objekt med deklareret type. Hvis en udvikler
introducerer auto-binding, bryder hele mønstret.

Reference: [SECURITY_AUDITS.md Prompt 8](SECURITY_AUDITS.md). Håndhævet
via Semgrep regler `fambud-no-form-data-spread`,
`fambud-no-privileged-field-from-formdata`, `fambud-no-zod-passthrough`.

---

## 3. PII må ikke logges via `console.log`

**Reglen**: `console.log(user)`, `console.error(user.email)`,
`console.log(password)` osv. fanges af Semgrep-regelen
`fambud-no-pii-console-log`.

**Hvorfor**: console.log går til Vercel function logs som har 1-3 dages
retention og ikke er PII-strippet. Sentry's `beforeSend`-hook
([lib/sentry-scrub.ts](lib/sentry-scrub.ts)) stripper kun events der
går gennem Sentry — direkte console.log er udenom.

**Hvad du skal gøre i stedet**: brug `lib/audit-log.ts` og `logAuditEvent()`
som har `redactPII()` indbygget. Eller log kun specifikke ikke-PII-felter
(`user.id`, `user.role`).

---

## 4. `createAdminClient` må ALDRIG i 'use client'-filer

**Reglen**: import af `createAdminClient` blokeres i `_components/`,
`*.client.tsx`, og lignende klient-filer. Håndhævet via Semgrep
`fambud-no-admin-client-import`.

**Hvorfor**: `createAdminClient` bruger `SUPABASE_SERVICE_ROLE_KEY` der
bypasser RLS. Hvis den importeres i en fil der bundles til klient,
ender keyen i klient-bundle og er eksponeret til alle browsers.

---

## 5. Verificér efter deploy

Hver gang vi ændrer noget der berører prod-headers, environment, eller
proxy-routing, skal vi køre:

```sh
bash scripts/check-headers.sh https://www.fambud.dk
```

Lærdom fra Prompt 9-10: vi havde 2 dage hvor deployet CSP/HSTS ikke
matchede vores commit, fordi Vercel-deploy var bagud. Curl-test ER
verifikation. Lighed mellem code og prod skal valideres.

---

## 6. Perspective-aware DAL og actions (proxy-mode)

**Reglen**: Når en DAL-funktion eller server action læser eller skriver
data der kan være perspective-følsom (transfers, transactions, accounts,
life_events, m.fl.), brug `getPerspective()` / `getActionPerspective()`
i stedet for `getHouseholdContext()`. Den fælles owner-klassifikator i
`lib/account-ownership.ts` er den ENESTE kilde til "hvis konto er det
her?"-spørgsmålet på tværs af UI.

**Hvorfor**: Mikkel kan agere på Louises vegne via setup-proxy
(migration 0065). I proxy-mode skal han se HENDES private konti (read)
og kunne oprette ressourcer på hendes vegne (write). User-client + RLS
filtrerer hendes private data væk fra hans session. Vi bypasser RLS
via `createAdminClient` og geninstallerer privacy-filteret manuelt via
`privateAccountFilter()` + `getVisibleAccountIds()`. Det er
KONVENTIONELT, ikke håndhævet af DB - derfor er CI-reglerne nedenfor
kritiske.

### Hvornår bruger man hvad?

```
                          getHouseholdContext   getPerspective
Reads af account-private  ❌                    ✅
data (transactions,       (Louises private          (returnerer admin-client
transfers, life_events,    skjules af RLS)         + grantor.id som
expenses-by-category,                              perspectiveUserId)
upcoming-events, loans)

Wizard/onboarding-state   ✅                    ❌
(family_members,          (proxy giver ingen       (overkill - membership-state
households, tours)         mening her)              er household-niveau)

Skriver til transactions/  ❌                   ❌  - brug `getActionPerspective(accountId)`
transfers (server actions)                          som validerer accountId mod
                                                    visible-set + returnerer
                                                    samme supabase-klient
```

### Pattern for nye DAL-funktioner

```ts
// lib/dal/min-nye-dal.ts
import { getPerspective, privateAccountFilter, getVisibleAccountIds } from './auth';

export async function getMineTing() {
  const p = await getPerspective();
  const visibleAccountIds = p.isProxyActive ? await getVisibleAccountIds() : null;
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  let q = p.supabase
    .from('transactions')
    .select('*')
    .eq('household_id', p.householdId);  // ALTID household-scope
  if (visibleAccountIds) q = q.in('account_id', visibleAccountIds);

  const { data } = await q;
  return data ?? [];
}
```

### Pattern for nye server actions

```ts
// app/(app)/min-feature/actions.ts
'use server';
import { getActionPerspective } from '@/lib/dal';
import { revalidateCashflowPaths } from '@/lib/actions/revalidate';

export async function createMinPost(formData: FormData) {
  const accountId = String(formData.get('account_id') ?? '');
  const pRes = await getActionPerspective(accountId);
  if (!pRes.ok) redirect('/?error=' + encodeURIComponent(pRes.error));
  const { supabase, householdId } = pRes.perspective;

  await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: accountId,
    /* ... */
  });

  revalidateCashflowPaths();  // ALTID på cashflow-affekterende mutationer
}
```

### Klassifikation: brug `classifyAccountOwnership`

For at vise konto-ejerskab i UI (badges, optgroups, tracks): kald
`classifyAccountOwnership(account, { currentUserId, currentLabel,
partnerUserId, partnerLabel })` fra `lib/account-ownership.ts`. ALDRIG
duplikér klassifikations-logik. Tre divergerende implementeringer kostede
os flere bug-runder i v1.5-v2.0.

### Semgrep-håndhævelse

- `fambud-admin-client-needs-household-filter` (WARNING): flagger
  `createAdminClient()`-konstruktioner uden `.eq('household_id', ...)`
  i samme funktion.
- `fambud-cashflow-action-needs-revalidate` (WARNING): flagger
  `'use server'`-actions der muterer transactions/transfers uden at
  importere `revalidateCashflowPaths`.

Reference: DEVLOG 30. maj 2026 (v1.5 → v2.0), SECURITY_AUDITS.md kommende
P25-P28.

---

## 7. Beløb gemmes som `bigint`-øre, ikke `numeric`/`float`

**Reglen**: alle finansielle felter er `bigint` med øre som enhed
(1 kr = 100 øre). Aldrig `numeric` eller `decimal` eller `float`.

**Hvorfor**: floating-point-præcision-fejl ved summation af tusindvis
af transaktioner. `decimal` ville virke men kræver eksplicit precision-
casting overalt. `bigint`-øre er én konstant skala-faktor og dermed
fri for præcisionsdrift.

Konversion i UI sker via `lib/format.ts` (`formatAmountDA` osv.).

---

## Hvis du tilføjer en ny regel

Føj reglen til Semgrep (`semgrep-rules/fambud.yaml`) og dokumentér
hvorfor i denne fil. En udvikler der ser reglen i CI-output skal kunne
finde svaret her i stedet for at undre sig over hvorfor lint fejler.
