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

## 6. Beløb gemmes som `bigint`-øre, ikke `numeric`/`float`

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
