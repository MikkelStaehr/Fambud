# Devlog — 27.-28. april 2026

Tre større features bygget oven på den oprindelige `MikkelStaehr/Fambud`-base:
familie-konsolidering, indkomst med pension, og lån som selvstændig sektion.
Plus oprydning i navigation.

---

## 1. Familie som single source of truth

**Migration: [0015_unify_to_family_members.sql](supabase/migrations/0015_unify_to_family_members.sql)**

Vi havde før to overlappende koncepter — `household_members` (auth-brugere)
og `family_members` (alle i familien). Nu er `family_members` den eneste:

- Auth-brugere = familiemedlem med `user_id IS NOT NULL`
- Pre-godkendte (afventer signup) = `email IS NOT NULL`, `user_id IS NULL`
- Børn/dependents = begge NULL — bare et tag
- `is_household_member()` (hjørnesten i alle RLS-policies) er omskrevet
  til at læse fra `family_members`
- `handle_new_user()`-trigger har nu tre paths:
  1. invite_code (legacy)
  2. **email-match → claim eksisterende family_member-række** (nyt)
  3. opret ny husstand
- `household_members`-tabellen er droppet

**App:** `/indstillinger` har nu én "Familie"-sektion med email-input,
status-badges (Kan logge ind / Afventer signup / Ingen login), og
duplikat-detektion ved email-collision.

---

## 2. Indkomst med bruttoløn og pension

**Migration: [0016_income_fields.sql](supabase/migrations/0016_income_fields.sql)**

Tre nye nullable felter på `transactions`:
- `gross_amount` (bigint øre — bruttoløn)
- `pension_own_pct` (real — egen pension i %)
- `pension_employer_pct` (real — firma pension i %)

**App:** Ny `/indkomst`-sektion i hovednavigation:
- Liste viser indkomst pr. familiemedlem med pension/brutto-info
- Form med tilhører-tag, konto, nettoløn (krævet), gentagelse, plus
  valgfri "Bruttoløn og pension"-fieldset
- Reuse af eksisterende 'Løn'-kategori (lookup-or-create)

**Logud:** tilføjet til `/wizard/layout.tsx` så man kan komme ud hvis
man sidder fast i onboarding.

---

## 3. Lån som dedikeret sektion

**Migrations:**
- [0017_loan_fields.sql](supabase/migrations/0017_loan_fields.sql) — tilføjer
  `loan_type`, `original_principal`, `term_months`, `lender`, `monthly_payment`
- [0018_loan_payment_detail.sql](supabase/migrations/0018_loan_payment_detail.sql)
  — omdøber `monthly_payment` → `payment_amount`, tilføjer
  `payment_interval` (recurrence_freq), `payment_start_date`, og breakdown:
  `payment_rente`, `payment_afdrag`, `payment_bidrag`, `payment_rabat`

**App:** Ny `/laan`-sektion:
- Liste med kort pr. lån (restgæld, hovedstol, % afbetalt, ydelse +
  interval, næste beregnede betalingsdato, rente, ÅOP)
- Form med fuld realkredit-breakdown og live-beregnet "Beregnet ydelse
  efter rabat" — udfylder du ikke samlet ydelse manuelt, beregnes den fra
  rente + afdrag + bidrag + rabat
- "Tilføj som månedlig udgift på budget"-knap pr. lån:
  - Bruger lånets eget interval (kvartalvis for realkredit)
  - Bruger lånets startdato → ruller frem til næste fremtidige betaling
  - Hvis breakdown er udfyldt: opretter `transaction_components` med
    `components_mode='breakdown'` så rente/afdrag/bidrag/rabat dukker op
    som underposter på budget-transaktionen

**Helper:** `nextOccurrenceAfter(anchor, interval)` i `lib/format.ts`
— korrekt månedsberegning med dag-clamping (Jan 31 + 1 mdr → Feb 28/29).

---

## 4. Navigation

**Sidebar** ([SidebarNav.tsx](app/(app)/_components/SidebarNav.tsx)):
```
Dashboard
Konti
Lån          ← ny
Indkomst     ← ny
Budget       ← klik = oversigt
  └ Lønkonto
  └ Budgetkonto
  └ Husholdningskonto
Poster
Overførsler
Indstillinger
```

**Budget-oversigt** ([app/(app)/budget/page.tsx](app/(app)/budget/page.tsx))
— ikke længere en redirect. Viser kort pr. budgetkonto med antal udgifter,
kr/md, kr/år. Husstandens samlede kr/md i header.

---

## Sådan kommer du videre i morgen

1. **Tjek migrationer i Supabase** — kør evt. de der ikke er kørt endnu:
   - 0015, 0016, 0017 er kørt
   - **0018 er ny — den skal køres** før `/laan`-formen virker (omdøber kolonne)

2. **Kør appen lokalt:**
   ```
   cd /Users/mikkelstaehr/Desktop/fambud
   npm run dev
   ```

3. **Færdiggør jeres lån:**
   - Total Kredit: udfyld breakdown (Rente 23.927,46 · Afdrag 11.296,88
     · Bidrag 4.412,22 · Rabat -1.495,47), kvartalvis interval, seneste
     betalingsdato 31.03.2026
   - Banklån (×2): udfyld med deres faktiske intervaller
   - Tryk "Tilføj som månedlig udgift på budget" pr. lån
   - Slet manuelt de gamle lån-transaktioner du tidligere lagde direkte
     på Budgetkonto

4. **Familieflow:** tilføj Louise på `/indstillinger` med email — hun
   bliver automatisk tilknyttet jeres husstand når hun signer up med
   den email.

---

## Åbne tråde / forbedringer

- Wizard-trinene under `/wizard/kredit-laan` opretter stadig credit-konti
  uden de nye loan-felter (kun `name`, `opening_balance`, `interest_rate`,
  `apr`). Bør udvides til at matche `/laan/ny`-formen.
- `/wizard/indkomst` opretter income-transaktioner uden de nye pension/
  bruttoløn-felter. Samme behov for harmonisering.
- Kategorien "Lån" oprettes automatisk når du pusher første lån til budget,
  med farve `#dc2626`. Kan tilpasses i `/indstillinger`.
- Pre-eksisterende lint-fejl i
  [ComponentRow.tsx:38](app/(app)/budget/_components/ComponentRow.tsx#L38)
  (setState i useEffect) — ikke rørt.

---
---

# Devlog — 28. april 2026 (fortsat)

Anden session samme dag. Fokus: gøre lånene færdige, redesign af /konti
som central konto-opsætning, ny "AI hjælper" på dashboard der spotter
underdækkede konti, og en SVG-graf over pengestrømme. Plus mobile-first
oprydning af alt det der blev rørt.

---

## 1. Lån — amortisering, polishing og rabat-fortegn

**Ny fil:** [lib/loan-projection.ts](lib/loan-projection.ts)

Pure-math amortisering for annuitetslån. `projectAmortisation()` tager
restgæld + rente/afdrag/bidrag/rabat pr. periode + interval, og loop'er
periode for periode (rente og bidrag som % af nuværende restgæld, total
ydelse holdes konstant) indtil restgæld = 0 eller 50-års-cap. Returnerer
periods, totalRente, payoffYears og crossoverYear (hvor afdrag overhaler
rente).

**Ny komponent:** [app/(app)/laan/_components/AmortisationProjection.tsx](app/(app)/laan/_components/AmortisationProjection.tsx)

Server-component vist på `/laan/[id]` mellem form og push-til-budget. Tre
summary-kort (total rente, payoff-år, crossover) + milestones-tabel med
rente/afdrag/bidrag/restgæld ved år 1, 5, 10, 15, 20, 25, 30 + slut. Kun
de milestones der falder inden lånets udløb. Returnerer null hvis lånet
mangler rente eller afdrag, og viser en gulnet besked hvis projektionen
fejler (fx atypisk struktur hvor afdrag bliver negativt).

**LoanForm:** År-felt tilføjet ved siden af Måneder, med to-vejs sync
(`år × 12 ↔ måneder`). Kun `term_months` postes — `years` er ren UX.

**/laan-listen:**
- "Næste betaling" → "Næste rente-opkrævning" (mere beskrivende)
- "Afdragsfri"-badge nu kun når der reelt ikke afdrages (ydelse=null
  eller `payment_afdrag` eksplicit sat til 0). Ikke når brugeren bare
  ikke har udfyldt breakdown'et.

**Restgæld-fortegn:** [app/(app)/laan/actions.ts](app/(app)/laan/actions.ts)
auto-negaterer nu `opening_balance` så brugeren kan indtaste positivt
beløb. Display'et bruger `Math.abs()` så ældre rækker med vilkårlig
fortegns-konvention stadig viser korrekt.

---

## 2. Migration 0019 — signed transaction_components

**Migration:** [0019_signed_components.sql](supabase/migrations/0019_signed_components.sql)

Drop af `amount >= 0` CHECK på `transaction_components`. Den forhindrede
KundeKroner-rabatten i at vises som negativ i breakdown'et — så
"Nedbrudt på 4 poster (sum 41.159 kr)" på Total Kredit var højere end
ydelsen (38.155). Nu kan rabatter gemmes som negative tal og summen
flugter med moderbeløbet.

**Konsekvenser:**
- `pushLoanToBudget` skubber `payment_rabat` med fortegn (var før
  `Math.abs()`)
- [ComponentRow.tsx](app/(app)/budget/_components/ComponentRow.tsx)
  rendrer negative beløb i grønt med bevaret minus
- `addComponent`/`updateComponent` validerer ikke længere `amount >= 0`

**Bonus i samme PR:** auto-derivation af rente/afdrag når et lån pushes
til budget UDEN udfyldt breakdown men MED `interest_rate` + restgæld.
Beregner `rente_periode = restgæld × rente% / perioder/år` og
`afdrag = ydelse − rente`. Labels "Rente (estimat)" / "Afdrag (estimat)"
så det er tydeligt at det er udledt. Løser det klassiske problem at
folk glemmer at tage renten med i deres månedlige budget.

**Push-bekræftelse:** [/laan/[id]](app/(app)/laan/[id]/page.tsx) viser nu
en grøn banner "Lånet er tilføjet som månedlig udgift på X" efter et
succesfuldt push. Drevet af `?pushed=<navn>`-query param fra action'en.

---

## 3. /konti redesign — central konto-opsætning

**Migration:** [0020_investment_kind.sql](supabase/migrations/0020_investment_kind.sql)
— tilføjer `'investment'` til `account_kind`-enum.

[app/(app)/konti/page.tsx](app/(app)/konti/page.tsx) gået fra én flad
tabel til tre formålsgrupperede sektioner:

- **Daglig brug** — checking, budget, household, cash
- **Opsparing & investering** — savings, investment
- **Andet** — other

Hver sektion har egen "Tilføj"-knap. Lån (`kind='credit'`) er fjernet
helt fra sektionerne — i stedet en lille footer-linje "Du har N lån —
se låneoversigten" der linker til /laan. Slut med dobbelt-administration.

`<table>` udskiftet med `<ul>` og flex-baseret AccountRow så det stacker
pænt på mobil i stedet for at klemme tabel-celler sammen.

---

## 4. Migration 0021 — investment_type subtype

**Migration:** [0021_investment_type.sql](supabase/migrations/0021_investment_type.sql)

Ny enum `investment_type` med 5 værdier:
- `aldersopsparing` (loft 9.900 kr/år)
- `aktiesparekonto` (ASK, loft 135.900 kr i alt)
- `aktiedepot` (intet loft)
- `pension` (rate/livrente, varierer)
- `boerneopsparing` (loft 6.000 kr/år, 72.000 kr i alt)

Plus `investment_type`-kolonne på `accounts` (nullable, kun meningsfuld
når `kind='investment'`).

**App:**
- [AccountForm.tsx](app/(app)/konti/_components/AccountForm.tsx) er
  konverteret til client-component for at vise/skjule subtype-dropdown
  dynamisk baseret på valgt kind. Når subtype vælges vises tilhørende
  loft-info ("Loft: 9.900 kr/år") som hjælpetekst.
- [/konti](app/(app)/konti/page.tsx) viser subtype som indigo-badge ved
  siden af kontoens navn + loft i amber-tekst i info-linjen.
- [INVESTMENT_TYPE_LABEL_DA / INVESTMENT_TYPE_CAP_DA](lib/format.ts) som
  single-source-of-truth for labels og lofter.

**Praktisk:** Hver familie kan nu have Aldersopsparing pr. person, ASK
pr. person, fælles aktiedepot, og børneopsparing pr. barn — alt med
korrekt loft-information ved hånden.

---

## 5. Saldo → Ind/Ud per konto

**Helper:** [`getAccountFlows()`](lib/dal.ts) — returnerer
`Map<accountId, { in, out }>` baseret på `monthlyEquivalent` af alle
recurring transactions + transfers. Engangs-poster ('once') tæller
ikke med — vi vil have det stabile billede.

`/konti`-rækkerne viser nu **Ind +X kr/md** (grønt) og **Ud −Y kr/md**
(rødt) i stedet for opening_balance, som alligevel altid var 0 i denne
cashflow-app. Konti uden flow viser "Ingen flow".

---

## 6. CashflowAdvisor — den lille AI-hjælper på dashboard

**Logik:** [lib/cashflow-analysis.ts](lib/cashflow-analysis.ts)

`detectCashflowIssues(accounts, perAccount)` finder konti der:
- **deficit:** outflow (expense + transfersOut) > inflow (income + transfersIn)
- **no-inflow:** har udgifter men intet kommer ind

Springer over `kind='credit'` (håndteres i /laan), `savings`/`investment`
(modtager pr. design — udgifter er bevidste hævninger).

**Helper:** [`getCashflowGraph()`](lib/dal.ts) — separat fra
`getAccountFlows()` fordi grafen har brug for at skelne income fra
transfers (ellers ville en transfer til en opsparingskonto fejlagtigt
blive vist som "Udgift" på grafen). Returnerer pr.-konto-detaljer +
kant-liste klar til SVG.

**UI:** [CashflowAdvisor.tsx](app/(app)/dashboard/_components/CashflowAdvisor.tsx)
viser warning-kort pr. issue med "Opret overførsel"-knap og "Se udgifter"-
link. Grøn bekræftelse hvis alt er dækket.

---

## 7. CashflowGraph — SVG-visualisering af pengestrømme

**Komponent:** [CashflowGraph.tsx](app/(app)/dashboard/_components/CashflowGraph.tsx)

Hand-coded SVG (ingen library) der viser:
- 4 kolonner: Indtægter → Income-receivere → Transfer-receivere → Udgifter
- Konti er noder (140×34px), syntetiske Indtægter/Udgifter er endpoint-noder
- Kanter er cubic Bezier-kurver, tykkelse proportional med flow
- Grøn = income, grå = transfer, rød = expense
- Deficit-konti markeres rødt, konti uden flow dæmpes til opacity 0.4
- Net beløb (`+X kr` eller `−X kr`) vises på alle konti med flow

**Bug fundet undervejs:** `dx = Math.max(40, (x2-x1)*0.4)` for Bezier-
kontrolpunkter — hvis gap mellem to kolonner var <80px, overskød kurven
og krydsede synligt bag andre boxes ("29.009 kr"-label gemt bag
Aldersopsparing). Fix: `dx = Math.max(8, (x2-x1)*0.45)` så kurven altid
holder sig inden for halvdelen af gap'et. Plus alle kolonne-gaps blev
øget til 60-80px så labels får plads.

---

## 8. Dashboard restructure

**Ændret:** [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx)

- Fjernet den nederste konti-liste (var redundant med grafen)
- Erstattet "Forecast kommer snart"-placeholderen med
  [MonthlyCategoryChart](app/(app)/dashboard/_components/MonthlyCategoryChart.tsx) —
  horisontal bar-chart over udgifter pr. kategori, sorteret efter månedligt
  gennemsnit, bruger kategoriens egen farve
- Tilføjet [TopExpensesList](app/(app)/dashboard/_components/TopExpensesList.tsx) —
  top 5 enkelt-udgifter normaliseret til kr/md
- CashflowAdvisor + Pengestrømme-graf integreret som hovedindhold

**Helpers:** [`getMonthlyExpensesByCategory()`](lib/dal.ts) og
[`getTopRecurringExpenses(limit)`](lib/dal.ts) tilføjet.

---

## 9. Mobile-first oprydning

Faldt over at de seneste ændringer brugte `px-8` overalt + `grid-cols-2`
uden breakpoints. Rettet på de touched filer:

- Page-padding `px-8 py-6` → `px-4 py-6 sm:px-6 lg:px-8` (dashboard,
  /konti*, /laan*)
- AccountForm + LoanForm `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- Dashboard summary (Indtægter/Udgifter/Netto): mindre tekst på mobil
  (`text-sm sm:text-base`, `text-[10px] sm:text-xs`)
- Onboarding-CTA: stack lodret på mobil
- CashflowAdvisor warning-kort: stack på mobil, side-by-side på sm+
- /konti-rækker: refaktoreret fra `<table>` til `<ul>` + flex så info,
  flow og handlinger stacker pænt på små skærme. Action-knapper viser
  kun ikon på mobil, ikon+tekst på sm+
- CashflowGraph: tilføjet "stryg vandret →" hint på mobil + negative
  side-margin (`-mx-4`) på scroll-containeren så grafen kan flyde til
  kanten

**Resten af appen** (budget, indkomst, overforsler, poster, indstillinger)
har stadig `px-8` og `grid-cols-2` uden breakpoints — kan tages i en
samlet pass når de bliver besøgt.

---

## Sådan kommer du videre derhjemme

1. **Kør de tre nye migrationer** i Supabase (i rækkefølge):
   - `0019_signed_components.sql` — drop CHECK så rabat kan være negativ
   - `0020_investment_kind.sql` — tilføj `investment` enum-værdi
   - `0021_investment_type.sql` — tilføj `investment_type` subtype-kolonne

2. **Kør appen:** `npm run dev`

3. **Færdiggør Total Kredit på budget:** den eksisterende budget-
   transaktion har stadig den gamle positive rabat. Slet den og re-push
   fra `/laan/[id]` — nu skubbes rabat med fortegn så summen i breakdown
   matcher ydelsen (38.155 kr i stedet for 41.160).

4. **Re-push Billån:** den havde ingen breakdown, så den fik intet vist
   under sig på budget. Slet og re-push — nu auto-deriver vi
   "Rente (estimat)" og "Afdrag (estimat)" fra interest_rate + restgæld.

5. **Opret Aldersopsparing/Aktiedepot/Børneopsparing-konti** under
   `/konti` (vælg type "Investering", så kommer subtype-dropdown frem).

6. **Tilføj manglende overførsler** så CashflowAdvisor stopper med at
   advare:
   - Lønkonto → Husholdningskonto
   - Lønkonto → Budgetkonto
   - Lønkonto → Aktiedepot (fælles)
   - Mikkel-løn → Aldersopsparing Mikkel (max 825 kr/md = 9.900/år)

---

## Åbne tråde

- **Indtægter på dashboard viser 162.830 kr/md** men brugeren tjener
  ikke så meget. Sandsynligvis duplikat-transaktioner, fejl-recurrence
  ('weekly' i stedet for 'monthly'), eller bonus gemt som månedlig.
  **Næste:** debug ved at se på `/indkomst`-listen og finde den post
  der trækker tallet op. Overvej et lille debug-panel på dashboard der
  viser hvor Indtægter-tallet kommer fra (post-for-post).
- **CashflowGraph på mobil** scroller stadig horisontalt fordi SVG'en
  er fixed-width. Bedre fix ville være en separat tekst-baseret mobil-
  visning, men det er en større opgave.
- **Mobile-first pass** mangler stadig på budget, indkomst, overforsler,
  poster, indstillinger.
- **CashflowAdvisor "Opret overførsel"-knap** kunne pre-fille beløbet
  som forslag baseret på deficit-størrelsen. I dag linker den bare til
  /overforsler/ny.
- **Budget-transaktioner opdaterer ikke automatisk** når lånet ændres.
  Hvis renten på et lån justeres, skal man slette+re-push manuelt. En
  "opdater fra lån"-knap kunne sidde på budget-transaktionen.
  (setState i useEffect) — ikke rørt.

---
---

# Devlog — 29. april 2026

Tredje session. Stor refactor af hvordan vi mentalt strukturerer økonomien:
budget-treenighed (Faste udgifter / Husholdning / Opsparinger), forbrugsspor
til husholdningskonto, og specialiserede opsparinger med beregnede mål.
Plus en stak UX-polering på rådgiveren, lønseddel-builder, og overførsels-
oprettelse.

---

## 1. Lønseddel-builder med live netto-beregning

**Migrations:**
- [0022_salary_deductions.sql](supabase/migrations/0022_salary_deductions.sql) —
  tilføjede A-kasse, fagforening, andet fradrag (label + beløb)
- [0023_drop_specific_deductions.sql](supabase/migrations/0023_drop_specific_deductions.sql) —
  droppede A-kasse + fagforening igen efter brugerfeedback. Ét generisk
  "Fradrag"-felt med valgfri label er bedre — A-kasse, fagforening, frokost
  kan klumpes som "Fradrag fra løn" eller skrives som label.

**App:** [IncomeForm.tsx](app/(app)/indkomst/_components/IncomeForm.tsx) er
nu client-component med live "Beregnet lønseddel"-summary:
- Bruttoløn → Pension egen (5%) → Fradrag → Skattepligtig efter fradrag
- Skat (beregnet) — udledes som `brutto − fradrag − netto`
- Sanity-check: rød advarsel hvis netto > brutto − fradrag

Pension blev IKKE flyttet til wizard — den var aldrig der. Fields ligger
kun på `/indkomst`-formen som fortsat.

---

## 2. /husholdning som forbrugsspor (ikke planlægning)

**Migration:** [0024_account_monthly_budget.sql](supabase/migrations/0024_account_monthly_budget.sql)
— `accounts.monthly_budget bigint nullable`. Bruges som intent-budget for
husholdningskonti, uafhængigt af de faktiske transfers ind.

Først lavede jeg en breakdown-baseret "planlægnings"-view (én transaction
med components for kategorier som Dagligvarer, Frokost, Andet). Brugeren
afviste — den korrekte model er forbrugsspor:

- **Et manuelt sat månedligt rådighedsbeløb** (fx 9.000 kr) øverst på siden
- **En tabel med køb** der genstarter hver måned
- Hvert køb = en transaction med `recurrence='once'`, kategori 'Husholdning',
  dato = købsdatoen
- Progressbar med farve-tone: emerald 0–80%, amber 80–100%, rød > 100%

Datamodel adskiller sig bevidst fra Lønkonto/Budgetkonto fordi
husholdningskontoen har VARIABELT forbrug, ikke faste recurring expenses.

**Også flyttet ud af /budget**: husholdning har sit eget menupunkt nu —
den hører ikke til på budget-listen sammen med faste udgifter.

---

## 3. Budget-treenigheden i sidebar

**[SidebarNav.tsx](app/(app)/_components/SidebarNav.tsx)** restruktureret:
```
Budget                       (gruppe-header, ikke link)
  📋 Faste udgifter         → /budget
  🛒 Husholdning            → /husholdning
  🐷 Opsparinger & buffer  → /opsparinger
```

Tre konceptuelle dele af "hvad sker der med min løn":
1. **Faste udgifter** — det forpligtede (rent, abonnementer, forsikringer)
2. **Husholdning** — det variable (dagligvarer, frokost)
3. **Opsparinger & buffer** — det der lægges til side

Per-account sub-items (Lønkonto, Budgetkonto) blev fjernet — de var støj.
`/budget` overview viser dem som kort i stedet.

`BUDGET_ACCOUNT_KINDS` reduceret til `['checking', 'budget', 'other']` —
husholdning er ude.

---

## 4. /opsparinger som dedikeret side

Var først en sektion på `/budget` overview. Brugeren ville have det som
selvstændig destination i treenigheden — så det er flyttet til
[app/(app)/opsparinger/page.tsx](app/(app)/opsparinger/page.tsx) med
stats-kort, anbefalinger, og liste over alle opsparingskonti.

Ny DAL-helper [getSavingsAccountsWithFlow()](lib/dal.ts) returnerer
savings/investment-konti med deres månedlige inflow (sum af recurring
transfers ind). Bruges også af /budget overview tidligere — nu kun her.

---

## 5. Anbefalede opsparinger med beregnede mål

**Migration:** [0025_savings_purpose.sql](supabase/migrations/0025_savings_purpose.sql)
— `accounts.savings_purpose text` med check-constraint
(`buffer` | `predictable_unexpected`).

**Buffer Konto** (3-6 mdr af faste udgifter):
- Min: `monthlyFixedExpenses × 3`
- Godt: `monthlyFixedExpenses × 6`
- Til jobtab, sygdom, akut reparation

**Forudsigelige uforudsete** (15% af nettoindkomst):
- Pr. md: `monthlyNetIncome × 0.15`
- Pr. år: `monthlyNetIncome × 12 × 0.15`
- Til bilvedligehold, tandlæge, gaver, ferie

**[AccountForm.tsx](app/(app)/konti/_components/AccountForm.tsx)** udvidet
med "Specialfunktion"-dropdown der dukker op når `kind=Opsparing` (samme
pattern som investment_type for Investering).

**Detektion sker via `savings_purpose`-feltet** — ikke kontonavn — så
brugeren kan kalde sin bufferkonto hvad de vil.

**Ny DAL-helper:** [getHouseholdFinancialSummary()](lib/dal.ts) beregner
`monthlyNetIncome` og `monthlyFixedExpenses` ved at summe alle
recurring transactions på husstanden.

**UX:** hvert anbefalet kort viser:
- Beregnede mål
- Status: konto sat op (med navn + ejer-badge + månedlig overførsel) eller
  manglende (med "Opret konto"-knap der pre-udfylder kind+savings_purpose)
- Faldback-tekst når data mangler ("indtast jeres faste udgifter først")

---

## 6. CashflowAdvisor — per-bruger andele af fælles-konti

**Migration: ingen** — bruger eksisterende felter.

Tidligere foreslog rådgiveren at MIKKEL skulle dække HELE underskuddet på
fælles-konti, hvilket er forkert når det er deres fælles ansvar.

**Nyt:** rådgiveren bruger nu `accounts.owner_name === 'Fælles'` til at
splitte underskud på antal "contributors" (logged-in family_members +
pre-godkendte med email). Mikkel ser sin halvdel; Louise ser sin halvdel
når hun signer up.

**Per-bruger tracking:** ny [getAdvisorContext()](lib/dal.ts) returnerer
`transfersByCreator` (transfers grupperet pr. creator-user) så vi kan
spørge "har Mikkel allerede lagt sin andel ind?". Hvis ja, advarslen
forsvinder fra hans dashboard — Louise ser stadig sin egen.

**Partial-household banner:** vises på dashboard når der findes
pre-godkendte family_members uden user_id (fx Louise er pre-godkendt men
har ikke signed up endnu) — gør det tydeligt at billedet er ufuldstændigt.

`buildFixFor()` håndterer både fælles- og personlige konti, returnerer
null hvis brugerens andel allerede er dækket.

---

## 7. UX-polering

### Værdineutral palet → tilbage til klassisk

Først udskiftede jeg rød/grøn med blå/slate (værdineutral, "udgifter er
normale ting"). Brugerfeedback: udgifter sprang ikke i øjnene længere.
Rullet tilbage til emerald/red/slate. ± fortegn beholdt på alle labels.

### Pengestrømme-grafen (CashflowGraph)

- **Split "Udgifter" i Private + Fælles**: source-kontoens `owner_name`
  bestemmer hvilken endpoint en expense-edge går til. Privat-loop
  (Lønkonto → Private udgifter) holder sig væk fra fælles-økonomien.
- **Private udgifter flyttet til venstre side** (col 0, under Indtægter)
  så linjen ikke krydser bag fælles-konti i col 2. Path-tegningen
  håndterer nu både forward og backward flow.
- **Pastel-toner** prøvet og rullet tilbage. Klassisk emerald/red/slate
  vandt for visuel adskillelse.

### Sidste bankdag-knap på TransferForm

Genbruger `nextLastBankingDay()` fra [lib/banking-days.ts](lib/banking-days.ts).
Klik → datoen udfyldes med næste sidste hverdag i måneden, vist live i
parentes ved knappen.

### "Brug årligt loft"-knap ved investeringskonti

Når til-konto i en transfer er aldersopsparing eller børneopsparing
(typer med årligt loft), vises en wand-knap "Brug årligt loft for
[type]" der udfylder beløb-feltet med `loft / 12`:
- Aldersopsparing: 9.900 / 12 = 825 kr/md
- Børneopsparing: 6.000 / 12 = 500 kr/md

Aktiesparekonto har et livstidsloft (135.900) — ikke kandidat til
del-på-12. Ny konstant
[INVESTMENT_TYPE_ANNUAL_CAP_KR](lib/format.ts).

### CashflowAdvisor pre-udfyldt overførsel

"Opret denne overførsel"-knappen sender nu et pre-udfyldt link til
`/overforsler/ny?from=...&to=...&amount=...&recurrence=monthly&description=...`
med en venlig grøn banner: "Vi har pre-udfyldt formularen baseret på
vores forslag — tjek det igennem og tryk Opret når det ser rigtigt ud."

`findSuggestedSource()` finder husstandens primære indkomst-konto
(højest income-flow) som default kilde.

---

## 8. /overforsler total overhaling

**Sletter** den interaktive SVG-graf (drag-to-create) — for fancy, sjældent
brugt. Tabel-grupperingen viser samme info mere kompakt og er nemmere
at scanne på mobil.

**Ny struktur:**
- Stats-kort: I alt · Til fælles · Til opsparing · Konti uden flow
- Smart insights — fx "Aktiedepot mangler månedlig overførsel"
- **Faste overførsler grupperet efter formål**:
  - 🏠 Til fælles-økonomien (budget/household)
  - 🐷 Til opsparing & investering (savings/investment)
  - 🏦 Til afdrag på lån (credit)
  - ↔ Andre overførsler
- Engangs-overførsler i denne måned (mindre, sekundær)

`TransferGraph.tsx` slettet — ikke mere drag-to-create. "Ny overførsel"-
knappen + de pre-udfyldte links fra CashflowAdvisor er det primære
oprettelses-flow nu.

---

## 9. Diverse småting

- `/budget/[householdId]` redirecter automatisk til `/husholdning` for
  brugere med gamle URLs eller bookmarks
- DAL-helper `getHouseholdFinancialSummary()` deler logik på tværs af
  /opsparinger og fremtidige forecast-features
- `setHouseholdBudget` action og HouseholdBudgetView blev rullet tilbage
  fra første forsøg — datamodellen passede ikke til forbrugssporet
- `redirect('/husholdning')` brugt sammen med kontotype-detektion via
  inline supabase-query når `getBudgetAccounts()` ikke kender kontoen

---

## Sådan kommer du videre

1. **Kør de fire nye migrationer** i Supabase (i rækkefølge):
   - `0022_salary_deductions.sql`
   - `0023_drop_specific_deductions.sql`
   - `0024_account_monthly_budget.sql`
   - `0025_savings_purpose.sql`

2. **Marker eksisterende savings-konti**: gå til `/konti/[id]` for jeres
   bufferkonto / forudsigelige-konto, sæt Specialfunktion-feltet, gem.
   Så detekterer `/opsparinger` dem korrekt.

3. **Sæt månedligt rådighedsbeløb**: gå til `/husholdning`, indtast 9.000
   kr (eller hvad jeres faktiske budget er), tryk Gem.

4. **Indtast lønseddel-detaljer**: rediger din indkomst på `/indkomst`,
   udfyld bruttoløn + fradrag + pension. Live-summary viser om tallene
   stemmer med din rigtige lønseddel.

---

## Åbne tråde

- **Kun Mikkel logget ind** — hele advisor-feature'en med 50/50 splits
  og pending-banneret er bygget men kan ikke testes ende-til-ende før
  Louise har oprettet sig
- **Ferieopsparing / specifikke spar-mål** — hvis brugeren vil tracke
  konkrete spar-mål (sommerferie 2027, ny bil) er der allerede
  `goal_amount` + `goal_date` på accounts, men der er ingen UI for det
- **15%-defaulten for forudsigelige uforudsete** er hardcoded — kunne
  gøres justerbar pr. husstand hvis brugeren ønsker det
- **Standardiseret "savings_purpose"-værdier**: kun 'buffer' og
  'predictable_unexpected' lige nu. Man kunne tilføje 'vacation',
  'big_purchase' osv. som dedikerede typer hvis behovet opstår
- **Aktiesparekonto-loft** (135.900 livstidsloft) håndteres ikke i UI —
  kunne lave en "fyld op over N år"-helper hvor brugeren angiver
  tidshorisont og vi deler loftet ud
- **Per-bruger advisor-feature ikke verificeret end-to-end** indtil
  Louise er på

---

# Devlog — 29. april 2026

UX/UI-fokus efter lange dage med datamodel og logik. Brand-polish, indkomst-
motor med faktiske lønudbetalinger som forecast-grundlag, dashboardet
omstruktureret til "lynhurtigt overblik", Sankey-graf der fortæller historien
"først betaler du dig selv, så fordeler du resten", og en større navigations-
omlægning hvor /budget og /poster begge bliver hierarkiske tabeller med
Fælles/Private-tabs.

---

## 1. Brand-polish — Fambud-wordmark + stone-tema

**Ny font** [font/zt-nature/ZTNature-Bold.otf](font/zt-nature/) loaded via
[app/fonts.ts](app/fonts.ts) som CSS-variabel `--font-zt-nature`. Brugt i
[FambudMark.tsx](app/(app)/_components/FambudMark.tsx) — wordmark på sidebaren
og auth-siderne. Ren sort, ingen split-farve (efter "logo skal bare være
sort"-feedback).

**Body-bg:** `bg-neutral-50` → `bg-stone-50` (varm cream) på root layout.
Etablerer brand-paletten: emerald-800 (skovgrøn) som primær, red-900
(burgundy) som sekundær, stone-50 som canvas.

---

## 2. Indkomst-motor — faktiske lønudbetalinger som forecast

**Migration: [0027_tax_rate.sql](supabase/migrations/0027_tax_rate.sql)** —
ny `tax_rate_pct real` kolonne på transactions så lønseddel-beregningen
kender brugerens trækprocent.

**Ny IncomeForm-flow** ([IncomeForm.tsx](app/(app)/indkomst/_components/IncomeForm.tsx)):
matcher dansk lønseddel — brutto → −AM-bidrag (8 %) → −egen pension →
skattegrundlag → −skattefradrag → beskatningsgrundlag × trækprocent
→ A-skat → forudsagt netto. Diff-indikator ±150 kr tolerance: grønt flueben
hvis netto matcher beregningen, ambergult banner hvis ikke (brugeren har
typisk overset noget).

**3-paycheck forecast-model** ([income.ts:142](lib/dal/income.ts)):
`getPrimaryIncomeForecast(memberId)` returnerer `'insufficient'` indtil 3+
faktiske lønudbetalinger er logget, så `'ready'` med glidende gennemsnit som
forecast for resten af året. Fanger automatisk variansen i overtid, bonus og
ferietillæg uden brugeren skal vedligeholde et manuelt skøn.

**`getMostRecentPaycheck(memberId)`** pre-fylder ny lønudbetaling med brutto,
pension-procenter, trækprocent og skattefradrag fra sidste registrering —
den ene ting der typisk varierer (netto pga. overtid/sygdom) lader vi stå tom.
Reducerer "indtast hele lønsedlen hver måned"-friktionen til "indtast dato
og netto".

**Default-konto-heuristik** i [/indkomst/ny](app/(app)/indkomst/ny/page.tsx):
seneste lønudbetalings konto → ellers `created_by`-match → ellers første
checking-konto. Praktisk når flere familiemedlemmer hver har deres egen
lønkonto.

**`incomeContributors`-filter** ([indkomst/page.tsx](app/(app)/indkomst/page.tsx)):
børn (user_id=null OG email=null) ekskluderes fra Hovedindkomst-sektionen —
de bidrager ikke økonomisk og deres opsparingsindskud skulle ikke optælles
som husstandens indkomst.

---

## 3. Dashboard — restruktureret til "lynhurtigt overblik"

**Tier 1 (det første brugeren ser):**

- **[HeroStatus.tsx](app/(app)/dashboard/_components/HeroStatus.tsx)** —
  "Er du på rette spor?" med stor net-cashflow-tal og statustekst
  ("Du har overskud denne måned" / "Du går omtrent lige op" / "Dine udgifter
  overstiger dine indtægter"). Bevidst INGEN "trygt at bruge"-tal — det
  ville kræve saldo-data vi ikke har.

- **[CashflowWarnings.tsx](app/(app)/dashboard/_components/CashflowWarnings.tsx)**
  — kompakt advarsels-liste (split fra den gamle CashflowAdvisor som havde
  hele Sankey'en bundet ind). Hver fix-foreslag er en linje med
  konto/beløb/Opret-knap, ikke et fuldt kort.

- **[UpcomingEvents.tsx](app/(app)/dashboard/_components/UpcomingEvents.tsx)**
  — "Næste 7 dage" — ny [getUpcomingEvents()](lib/dal/cashflow.ts) DAL-helper
  ruller recurring-anchors frem til næste forekomst inden for vinduet og
  inkluderer scheduled once-poster. Klient-component med Fælles/Private-tab,
  scrollable inden for kortet (`max-h-96`) så listen ikke strækker hele rækken.

**Tier 2 (fordeling og flow):**

- **[CategoryGroupChart.tsx](app/(app)/dashboard/_components/CategoryGroupChart.tsx)**
  — viser udgifter rullet op til tematiske grupper (Bolig & lån, Forsyning &
  forsikring, Transport, Børn, Mad, Underholdning, A-kasse, Personligt, Andet)
  i stedet for alle 17 individuelle kategorier. Tabs: Fælles / Private.
  Mapping defineret i [lib/categories.ts](lib/categories.ts) som
  `CATEGORY_GROUPS` + `CATEGORY_GROUP_COLOR`.

- **CashflowGraph (Sankey)** — flyttet ud af advisoren og rendet direkte fra
  page.tsx med data fetched én gang og delt mellem warnings + graph (ingen
  dobbelt-fetch).

**Lay-out:** to-kolonne grid `lg:grid-cols-2` for `UpcomingEvents` +
`CategoryGroupChart`. Begge kort bruger `flex h-full flex-col` + samme card-
styling så de står i samme højde uafhængigt af indhold.

---

## 4. Sankey rebuilt — to-kolonne destinations-layout

**[CashflowGraph.tsx](app/(app)/dashboard/_components/CashflowGraph.tsx)**
omskrevet til Apple-cashflow-statement-stil: én kilde i venstre side
(Lønkonto), bånd flyder ud til højre, hver destination får sin egen
rektangel. Båndbredde proportional med beløbet.

**Two-column destination-layout** fortæller historien "først betaler du dig
selv, så fordeler du resten":

- **Kol 1 (`COL_PRIVATE_X = 195`)** — private udgifter TÆT på Lønkonto.
  Signalerer "betalt først".
- **Kol 2 (`COL_TRANSFER_X = 380`)** — overførsler LANGT til højre. Visuel
  distance kommunikerer "kommer i anden runde, efter du har betalt dig selv".

Kun kolonne-headere ("PRIVAT" / "OVERFØRSLER") vises hvis kolonnen har
destinationer. Bands sorteret: privat øverst, fælles, opsparing nederst —
så de aldrig krydser hinanden.

**Primary-once paychecks som forecast i grafen**:
[getCashflowGraph()](lib/dal/cashflow.ts) henter nu også primary-once
lønudbetalinger og tager gennemsnit af de seneste 3 pr. (account, member)-par
som månedligt income. Tidligere viste grafen ikke lønindkomst når brugeren
havde skiftet til "registrer lønudbetaling"-flowet (`recurrence='once'`).

**Surplus-rektangel** vises som separat emerald-blok over kilden hvis income
> outflow. Net-badge øverst.

---

## 5. /konti redesign + investment-kind

**Migration: [0026_investment_kind.sql](supabase/migrations/0026_investment_kind.sql)**
— ny enum-værdi `investment` på `account_kind` (efter `savings`).

**[/konti](app/(app)/konti/page.tsx) opdelt i tre sektioner** efter formål:

- **Daglig brug**: checking, budget, household, cash
- **Opsparing & investering**: savings, investment
- **Andet**: other

Lån (`kind='credit'`) skjult fra /konti — `/laan` er det dedikerede lånehub.
Footer-link "Du har N lån — se /laan" hvis ≥1 lån.

**[AccountForm.tsx](app/(app)/konti/_components/AccountForm.tsx)** — ny
"Investering"-option i dropdown'en, plus eksisterende felter (navn, ejer,
saldo, mål) dækker det grundlæggende. Bevidst ikke broker- eller skatte-
type-felter i denne omgang.

---

## 6. /budget → /faste-udgifter (rename) + nyt /budget hierarki

**Plan B**: vi delte den gamle /budget op i to roller — overblik vs. værktøj.

**Filer flyttet** via per-fil `git mv`:

- `app/(app)/budget/page.tsx` → `app/(app)/faste-udgifter/page.tsx`
- `app/(app)/budget/[accountId]/page.tsx` → `app/(app)/faste-udgifter/[accountId]/page.tsx`
- `app/(app)/budget/_components/*` → `app/(app)/faste-udgifter/_components/*`
- `app/(app)/budget/actions.ts` → `app/(app)/faste-udgifter/actions.ts`

**Eksterne refs opdateret** til `/faste-udgifter`:

- Dashboard onboarding-CTA og CategoryGroupChart-tomstilstand
- /opsparinger "Indtast jeres faste udgifter"-link
- `revalidatePath` i `laan/actions.ts` og `indstillinger/actions.ts`
  revalidaterer både `/faste-udgifter` (layout) og `/budget` (overblik)

**Nyt [/budget/page.tsx](app/(app)/budget/page.tsx)** — hierarkisk tabel-
overblik over ALLE faste udgifter på tværs af konti. Kun læse-side; alle
CRUD sker via `/faste-udgifter/[accountId]`.

**[BudgetTable.tsx](app/(app)/budget/_components/BudgetTable.tsx)** —
client-component med:

- Scope-tab "Fælles" / "Private" øverst med totaler vist på selve knappen
- Filter-bar: søgning (matcher navn + konto + kategori), dropdowns for
  konto/gruppe/interval, "Nulstil"-knap når der er aktive filtre
- Hierarkisk tabel: kategori-grupper som parent-rækker (foldbare), udgifts-
  rækker som children. Default foldet sammen. "Fold alle ud / sammen"-knap.
- Auto-expand når der er aktive filtre (matchende rækker er altid synlige)
- Sortering på kolonne-headere: Gruppe/Navn · Interval · Konto · Beløb/md
- Smart filter-reset ved scope-skift (undgår "tom tabel"-overraskelse)

---

## 7. /poster — samme system, men faktiske beløb

**[PosterTable.tsx](app/(app)/poster/_components/PosterTable.tsx)** —
identisk struktur til BudgetTable, men:
- Viser **faktiske bogførte beløb** for den valgte måned (en årlig
  forsikring står med fuld 12.000 kr i den måned den falder, ikke 1/12 kr/md)
- Kolonner: Gruppe/Navn · Dato · Konto · Beløb · Handlinger
- Recurrence vises som lille badge ved navnet hvis ≠ once
- Edit/Slet inline pr. række
- Måneds-vælger og Indtægter/Udgifter/Netto-summary-kort bevaret øverst
- Indkomst kun i summary-kortene — selve tabellen viser kun udgifter
  (indkomst redigeres via `/indkomst`)

**[getTransactionsForMonth()](lib/dal/transactions.ts)** udvidet til at
inkludere `account.owner_name` så Fælles/Private-splittet virker.

---

## 8. Sidebar restruktureret med Værktøjer-gruppe

**[SidebarNav.tsx](app/(app)/_components/SidebarNav.tsx)** omskrevet:

```text
Hovednavigation:
  📊 Dashboard
  💼 Konti
  🏛 Lån
  🪙 Indkomst
  📋 Budget         ← NY: hierarkisk overblik
  🧾 Poster
  ↔  Overførsler

🔧 VÆRKTØJER (divider med uppercase-overskrift)
  📋 Faste udgifter   ← FLYTTET fra /budget
  🛒 Husholdning
  🐖 Opsparinger & buffer

⚙ Indstillinger (separeret nederst)
```

Adskiller "se" (overblik, dashboards) fra "vedligehold" (forms hvor brugeren
beriger systemet med data). Værktøjs-gruppen har discrete divider med
`Wrench`-ikon + uppercase-tracking-label.

---

## Sådan kommer du videre

1. **Kør migration** [0027_tax_rate.sql](supabase/migrations/0027_tax_rate.sql)
   i Supabase hvis det ikke allerede er gjort.

2. **Test indkomst-flowet ende-til-ende**: gå til /indkomst → "Registrer
   lønudbetaling" → indtast brutto, pension, trækprocent, skattefradrag,
   dato og netto. Bekræft at diff-indikatoren matcher din rigtige lønseddel.

3. **Brug /budget til at få overblikket**: alle faste udgifter på tværs af
   konti i én hierarkisk tabel. Test Fælles/Private-tab, søg + filter,
   fold-grupper.

4. **/poster nu også grupperet**: skift måned, fold grupper ud, bekræft
   recurrence-badges på recurring-poster.

---

## Åbne tråde

- **Top udgifter** er fjernet fra dashboardet (var redundant info). Tanken
  var at integrere det som hover-info på Sankey-noderne. Ikke implementeret
  endnu.
- **`getMonthlyExpensesByCategory()`** og `getTopRecurringExpenses()`-helpers
  i [lib/dal/cashflow.ts](lib/dal/cashflow.ts) er ikke længere brugt nogen
  steder — kandidater til oprydning, men holdes for nu hvis Sankey-hover
  bliver bygget.
- **/poster's hierarkiske view** viser kun transaktioner hvis `occurs_on`
  falder i måneden. For recurring expenses betyder det kun anchor-måneden,
  ikke alle realiserede forekomster. Hvis brugeren vil se "alle ydelser
  jeg faktisk har trukket i april" må vi rulle recurring-anchors frem og
  generere virtuelle rækker — ikke gjort endnu.
- **Indkomst i /poster-tabellen**: bevidst udeladt for at undgå en synthetic
  "Indkomst"-gruppe i CategoryGroup-unionen. Hvis det viser sig at folk
  forventer at se og redigere indkomst fra /poster, kan vi løse det.
- **Theodor (barn) og hans aldersopsparing**: hans indskud tæller ikke som
  husstands-indkomst, men hvis han havde en investerings-konto (aktiedepot)
  kunne husstanden stadig se den under /konti. Lige nu håndteres det via
  `incomeContributors`-filteret — men der er ingen UI for "børn med konti".

---

# Devlog — 30. april til 4. maj 2026

Fem dage med 39 commits og 13 migrationer. Hovedtemaer:
multi-purpose opsparinger, total wizard-restruktur, privacy hardening,
DAWA adresse-autocomplete, og to onboarding-systemer (soft InfoTooltips
+ custom Tour med spotlight). Plus to større kode-splits så
`cashflow.ts` og `opsparinger/page.tsx` ikke længere er monolitter.

---

## 1. Multi-purpose opsparinger + kategori-baserede forudsigelige

**Migration: [0028_predictable_estimates.sql](supabase/migrations/0028_predictable_estimates.sql)**
— ny tabel for kategori-CRUD af forudsigelige uforudsete (Tandlæge, Bil,
Gaver osv.). Hver række har et månedligt skøn; sum/12 erstatter den
gamle 15%-default som nu er væk.

**Migration: [0029_savings_purpose_array.sql](supabase/migrations/0029_savings_purpose_array.sql)**
— `savings_purpose` (single) → `savings_purposes` (array). Én konto kan
nu dække flere formål samtidigt (fx både buffer OG forudsigelige).

**Buffer-kalkulator vendt om**: starter ved "hvad kan I afsætte pr. md"
og beregner tid til 1/3/6/12 måneders buffer-mål — i stedet for "hvor
langt er du fra målet". Mere motiverende for folk der lige starter.

**Værktøjer flyttet til detail-sider**:
[/opsparinger/buffer/page.tsx](app/(app)/opsparinger/buffer/page.tsx)
og [/opsparinger/forudsigelige/page.tsx](app/(app)/opsparinger/forudsigelige/page.tsx)
— hovedsiden er nu ren oversigt med RecommendedCard'er der linker dertil.

**Dashboard-advarsel ved manglende buffer** når der er faste udgifter —
men senere lukket fra Sankey/CashflowWarnings og overtaget af den nye
OnboardingChecklist (se §6).

---

## 2. Buffer-onboarding + empty-state-polish (30. april)

**Aktiv buffer-introduktion i wizarden** (`a386097`):
[/wizard/privat-opsparing](app/wizard/privat-opsparing/page.tsx) fik et
grønt anbefalings-card der forklarer hvad en buffer er (nødfond mod
jobtab, sygdom) og opretter den i ét klik med
`savings_purposes=['buffer']`. Skjules når brugeren allerede har en
buffer-tagget konto. Lukker hullet hvor brugeren senere så dashboard-
advarsel om manglende buffer uden nogensinde at være blevet undervist
i konceptet.

**Empty-states forbedret** for [/faste-udgifter](app/(app)/faste-udgifter/page.tsx)
og [/husholdning](app/(app)/husholdning/page.tsx) (`7518f24`): forklarer
hvad konto-typerne er, og CTAs pre-fylder kind=budget hhv. kind=household
i stedet for at smide brugeren til en blank /konti/ny.

**Buffer-CTA-loop lukket** (`ca264a3`): /konti/ny læser nu kind,
savings_purposes og name fra query params, så buffer-CTAs på dashboard
og /opsparinger lander på en pre-fyldt formular hvor brugeren kun skal
trykke Gem.

---

## 3. Tier-2 UX-fixes + onboarding-checklist (30. april)

**`fee2c98` — tre fixes på én gang**:

1. **Sidebar-ikon-konflikt**: Budget brugte samme ClipboardList-ikon som
   Faste udgifter. Skiftet til `Table2` så de er visuelt distinkte.

2. **Wizard /faelleskonti-intro** styrket med eksplicit anbefaling om
   at oprette begge typer (budget + husholdning) og forklaring af forskellen.

3. **OnboardingChecklist** ([dashboard/_components/OnboardingChecklist.tsx](app/(app)/dashboard/_components/OnboardingChecklist.tsx)):
   erstatter den gamle enkelt-CTA "Lad os fylde budgettet op". Viser tre
   fundamentale trin med live-status (faste udgifter, månedlige
   overførsler, bufferkonto) og skjuler sig selv når alle er færdige.
   Buffer-advarslen i CashflowWarnings er nu redundant og slukket — det
   var dårlig UX at advare om noget brugeren skulle gøre én gang.

**Ny DAL-helper**: `getOnboardingProgress()` returnerer alle tre flag i
én forespørgsel, så checklisten ikke kræver tre separate roundtrips.

---

## 4. Layout-fix og Sankey-polish (30. april)

**Fast app-shell** (`9e1e3f3`): tidligere strækte sidebar sig med
content-højden, så lange sider som /budget eller /opsparinger gav en
useligt høj sidebar. Ny struktur: `flex h-screen` på parent +
`overflow-y-auto` på `<main>`. Sidebar er fastlåst til viewport-højde,
kun content scroller.

**`CashflowGraph.MIN_BAND_HEIGHT`** bumpet 4 → 20 (`649a5f6`): når
brugeren har flere små opsparinger blev destinations-rektanglerne stablet
for tæt og labels overlappede. Trade-off: små bånd ser nu lidt større
ud end deres faktiske andel ville indikere, men kr-tallet står ved
siden af, og kildebåndet viser stadig den ægte proportion.

---

## 5. Wizard total restruktur (1.-2. maj, 3 batches)

Hele onboarding-flow'en omskrevet for at fjerne dobbelt-spor og
introducere familie/ejer-modeller fra starten.

### Batch 1 (`b26defa`): kombinér lonkonto + indkomst, ny familie-trin

- **`/wizard/lonkonto`** kombinerer kontooprettelse og første lønudbetaling
  i ét trin. Server action opretter account + monthly recurring income +
  'Løn'-kategori atomisk og tagger income med `income_role='primary'` +
  `family_member_id` så forecast-motoren kan finde paychecks.

- **`/wizard/familie`** (NY) — solo/familie-valg med tilføj partner
  (navn+email) og børn (kun navn). Ejeren auto-listet, kan ikke fjernes.

- **`/wizard/indkomst` slettet** (indhold flyttet ind i lonkonto).

### Batch 2 (`abc47e9`): opsparing/investering/ejere + invite-merge

- **`/wizard/privat-opsparing` → `/wizard/opsparing`** — omdøbt og udvidet
  med børneforbrugskonti pr. barn. `createChildSpendingAccount`-action
  opretter `kind=savings` med `owner_name=barnets navn`.

- **`/wizard/kredit-laan` → `/wizard/investering`** — kreditkort/lån
  fjernet helt fra wizarden (håndteres in-app efterfølgende). I stedet:
  aldersopsparing, aktiesparekonto, aktiedepot, pension via type-dropdown
  + ét-kliks børneopsparing pr. barn med `investment_type='boerneopsparing'`.

- **`/wizard/ejere`** (NY) — trin 6 i ejer-flowet. Skipper sig selv for
  solo. Tabel med dropdown for `owner_name` (Ejer/Partner/Fælles/[barn]).
  Smart defaults bevares.

- **`/wizard/invite` slettet** og indholdet flyttet ind i `/wizard/done`.
  Pre-godkendte partnere får invitations-sektion med ét-kliks generering
  og kopier-knapper.

### Batch 3 (`5f60055`): partner-specifikke tilpasninger

- **`/wizard/lonkonto` velkomst-panel** for partner viser husstands-
  sammendrag (antal fælleskonti, om buffer er sat op, ejerens navn) i
  5 sekunder så de ved de joiner en eksisterende husstand.

- **`/wizard/oversigt`** (NY) — partnerens trin 2. Read-only tabel over
  fælleskonti og familiemedlemmer. Forklarer at de ikke skal gen-oprette
  noget.

- **Skjult buffer-anbefaling** for partner hvis husstanden allerede har
  en buffer-tagget konto.

### Idempotens-guards og hotfixes

- **`e1614f7`**: idempotens-guard på `/wizard/lonkonto` — hvis brugeren
  genkører wizarden og allerede har en aktiv checking-konto, sendes de
  direkte videre i stedet for at oprette duplikater.

- **`6501d98`**: lonkonto-trin understøtter nu **1-3 paycheck-samples** i
  stedet for én monthly template. Tidligere oprettede trin 1 én recurring
  monthly-transaktion, og brugeren skulle separat registrere 3 once-paychecks
  post-wizard. Nu er det ét spor: trin 1 kan oprette 1-3 'once'-transaktioner
  med `income_role='primary'`, og forecast-motoren bruger dem direkte.

- **`23c216f`**: pay-day-regel auto-fylder paycheck-datoer på de 1-3 rækker
  baseret på fast-dato/sidste-bankdag/næstsidste-bankdag/første-bankdag.

---

## 6. Round-ups: 4 UX-fixes + adresser + fællesøkonomi (2. maj)

### Round 1 (`7bfd377`): 4 UX-fixes
1. Buffer-default = 'Fælles' i `/wizard/ejere` (`smartOwnerDefault()`
   detekterer `savings_purposes=['buffer']` og foreslår 'Fælles').
2. Foldbar `<details>`-forklaring om hvorfor 3 paychecks er nødvendige
   (overtid, ferietillæg, bonus-udsving).
3. **HeroStatus amber-notis vises nu uanset net-tegn** — ikke kun ved
   underskud. Selv et "positivt" tal kan være misvisende hvis partner-
   bidrag mangler.
4. **Konto-skifter på `/faste-udgifter/[accountId]`** — tabs-row øverst
   med alle konti som inline-knapper. Fælles-konti markeres med blå pill.

### Round 2 (`4de87d8`): adresser + arbejdssted + partner-status
**Migration: [0033_addresses.sql](supabase/migrations/0033_addresses.sql)
+ [0034_signup_metadata_to_family.sql](supabase/migrations/0034_signup_metadata_to_family.sql)**:
`family_members.home_address` og `workplace_address` kolonner +
`handle_new_user`-trigger udvidet til at læse `full_name` og `home_address`
fra signup-metadata.

- `/signup` og `/join/[code]` har nu fuldt navn + bopælsadresse-felter.
- `/indstillinger` får ny "Min profil"-sektion med navn + hjem +
  arbejdsplads-adresse (workplace til fremtidig befordringsfradrag).

**FamilyStatus-komponent** ([dashboard/_components/FamilyStatus.tsx](app/(app)/dashboard/_components/FamilyStatus.tsx)):
ny dashboard-sektion mellem OnboardingChecklist og IncomeForecastBanner.
Viser hver "anden voksen" med status-pill (pending / partial / done) og
hint om hvad der mangler. Pending-rækker har "Se invitation"-link.

### Round 3 (`ecbaecd`): fællesøkonomi-mode
**Migration: [0035_household_economy_type.sql](supabase/migrations/0035_household_economy_type.sql)**
— `households.economy_type` ('separate' | 'shared'), default 'separate'.

To indkomst-modeller i wizarden:
- **Særskilt** (default): hver voksen har sin lønkonto, sender til Fælles.
- **Fællesøkonomi** (NY): begge lønninger lander på én "Fælles Lønkonto".
  Indkomst registreres stadig pr. person via `family_member_id` så
  forecast-mekanikken er uændret — det er bare kontoen der er pooled.

Ny `PartnerSharedIncomeForm`-variant + `registerSharedIncome`-action
opretter ikke ny lønkonto, men registrerer kun indkomst på den
eksisterende fælles.

---

## 7. DAWA adresse-autocomplete + adressestruktur (2. maj)

**Migration: [0036_address_components.sql](supabase/migrations/0036_address_components.sql)
+ [0037_signup_address_components.sql](supabase/migrations/0037_signup_address_components.sql)**:
splittet adresser i adresse/postnr/by — `family_members.home_zip_code`,
`home_city`, `workplace_zip_code`, `workplace_city`. `home_address` og
`workplace_address` bevarer "gade + nr + evt. etage". Matcher Danmarks
Adresseregisters struktur 1:1.

**[DawaAddressInput.tsx](app/_components/DawaAddressInput.tsx)** (225 LOC):
- Klient-component med debounced fetch (200ms) mod
  `api.dataforsyningen.dk`
- AbortController forhindrer race conditions ved hurtig tastning
- Tastatur-nav: ArrowUp/Down, Enter, Escape
- `mousedown` frem for `click` på forslag undgår focus-loss-race
- Brugeren kan stadig taste manuelt — DAWA-nedbrud blokerer ikke signup

Tre form-instances bruger komponenten: `/signup`, `/join/[code]`,
`/indstillinger Min profil` (sidstnævnte med `namePrefix`-prop for
hjem vs arbejdsplads).

**Hotfix: [0038_fix_handle_new_user_var_names.sql](supabase/migrations/0038_fix_handle_new_user_var_names.sql)**
(`cf5f1d1`): Migration 0037's replace_all fangede ikke INSERT-listen i
Path 3 (brand new household uden invite-kode). PL/pgSQL kompilerer lazy
så fejlen først opdages runtime når en ny ejer signer op uden invite —
hvor den fejlede med "Database error saving new user". 0038 genskriver
funktionen med konsistente `v_`-prefix-variabler i alle 3 paths.

---

## 8. Privacy hardening (1. maj)

**Migration: [0030_private_account_visibility.sql](supabase/migrations/0030_private_account_visibility.sql)**
— stramme SELECT-policies så private konti reelt er private. Tidligere
RLS tillod alle husstandsmedlemmer at læse alt, så Louise kunne se
Mikkel's private udgifter selvom kontoen var `editable_by_all=false`.

Nye SELECT-policies matcher write-policies:
- accounts: synlig hvis `editable_by_all OR created_by=auth.uid()`
- transactions: synlig hvis `can_write_account` på underliggende konto
- transfers: synlig hvis MINDST én af from/to er læsbar (UI håndterer
  null FK-join graciøst, så Louise stadig ser "Fælles modtog 5.000 kr"
  uden at se kilden)

**Migration: [0031_components_privacy_and_lonkonto_default.sql](supabase/migrations/0031_components_privacy_and_lonkonto_default.sql)**
(`d0a5df7`):
- `transaction_components` får tilsvarende private-aware policies
- Datapatch: eksisterende `kind='checking'` med `editable_by_all=true`
  bringes i overensstemmelse med wizard-defaulten (private). Mikkel's
  lønkonto var læsbar af Louise selv efter 0030 fordi flag'et var
  forkert sat på den eksisterende række.

**Dashboard-aggregeringsfix** (samme commit): `monthlyTotals` udregnes
nu fra `getCashflowGraph`'s `perAccount`-aggregat i stedet for at
filtrere transaktioner på "denne kalendermåned". Effekt: HeroStatus
viser samme indkomst-tal som cashflow-grafen, inkl. forecast-baseret
primary income (avg af 3 seneste paychecks). Tidligere viste HeroStatus
0 kr indkomst hvis brugeren havde paychecks i tidligere måneder men
endnu ikke i den aktuelle.

`getCashflowGraph` er nu wrapped i React's `cache()` så
`getDashboardData` og `dashboard/page.tsx` ikke laver dobbelt round-trip.

**HeroStatus missing-income notis** (`6499423`): forklarer underskud når
en bidragyder har `primary_income_source` sat men 0 logged paychecks.
Amber-notis siger "Louise har endnu ingen indkomst registreret —
underskuddet er sandsynligvis bare midlertidigt". Beslutningen er
bevidst at vise husstands-totalen frem for at splitte i "din andel" —
det er nyttig oplysning at familien har 41k udgifter med kun 1 indkomst.

---

## 9. Kode-organisering (2. maj)

### `lib/dal/cashflow.ts` splittet (`9ea8606`)
Fra 655 → 167 linjer i 5 fokuserede moduler:
- [cashflow.ts](lib/dal/cashflow.ts) (~165): kun `getCashflowGraph` + dets typer
- [dashboard.ts](lib/dal/dashboard.ts): `getDashboardData`, `getHouseholdFinancialSummary`
- [advisor.ts](lib/dal/advisor.ts): `getAdvisorContext` + per-bidragyder-splits
- [expenses-by-category.ts](lib/dal/expenses-by-category.ts): pr-kategori, pr-gruppe, top-N
- [upcoming-events.ts](lib/dal/upcoming-events.ts): `getUpcomingEvents` (næste 7 dage)

Alle eksporteres via barrel ([lib/dal/index.ts](lib/dal/index.ts)) så
eksisterende `import { getDashboardData } from '@/lib/dal'` virker uændret.

### `opsparinger/page.tsx` splittet (`858e481`)
515 → 127 linjer "kun layout". 4 inline-komponenter trukket ud:
- [BufferCard.tsx](app/(app)/opsparinger/_components/BufferCard.tsx) (86 LOC)
- [PredictableCard.tsx](app/(app)/opsparinger/_components/PredictableCard.tsx) (90 LOC)
- [RecommendedCard.tsx](app/(app)/opsparinger/_components/RecommendedCard.tsx) (110 LOC)
- [SavingsCard.tsx](app/(app)/opsparinger/_components/SavingsCard.tsx) (117 LOC)

### Kvik-oprydning (`1475e7c`)
- `showBufferWarning` end-to-end fjernet (var hardcoded `false`, hele
  amber-banneret renderede aldrig)
- Døde exports slettet: `formatDKK`, `dkkFormatter`,
  `hasAnyRecurringExpenses`, `_Json`/`Json`
- Nedgraderet til intern: `adjustToBankingDay`, `TransferWithRelations`,
  `TransferEdge`, `TransferGraphData` (kun brugt internt)
- Stale dashboard-kommentar rettet

### Migration [0032_drop_dead_account_columns.sql](supabase/migrations/0032_drop_dead_account_columns.sql)
(`c2f73d2`): Drop kolonner der aldrig blev brugt:
- `currency` (alle DKK)
- `goal_amount`, `goal_date`, `goal_label` (0/10 konti havde sat dem)

Tilhørende form-cleanup i AccountForm + actions + display-pages.

---

## 10. Indkomst Duplikér-flow + Hover-tone (1.-2. maj)

**Duplikér-knap på /indkomst** (`f817e06`): Brugere der skal logge 3
paychecks for at få forecast'et til at virke har typisk identiske
lønninger. Ny `Copy`-ikon-knap ved hver række, `?duplicate=<id>`-param
pre-fylder ALLE felter inkl. netto. Datoen shifts én måned bagud (klampet
til target-månedens sidste dag så 31. maj → 30. april ikke fejl-overflower
til 1. maj). Header skifter til "Duplikér lønudbetaling".

**Emerald hover-tone på primary CTAs** (`4b58f9c`): Knappernes hover
gik fra `neutral-900 → neutral-800` som var for subtilt. Skifter til
`emerald-700` for tydelig "klik mig"-feedback der matcher appens "grøn
= action"-sprog. 30 filer berørt via sed-script for konsistens.

---

## 11. Soft onboarding: InfoTooltip + custom Tour-system (2. maj)

### InfoTooltip (`2ced366`)
**[InfoTooltip.tsx](app/_components/InfoTooltip.tsx)** (82 LOC) — soft
onboarding via lille `?`-ikon ved nøgle-elementer. Hover (desktop) eller
click (mobile) viser kort forklaring. Ikke-tvungent — nye brugere
udforsker, erfarne ignorerer ikonet.

Drysset på 7 dashboard-headere: HeroStatus, CashflowWarnings,
OnboardingChecklist, FamilyStatus, IncomeForecastBanner, CashflowGraph,
UpcomingEvents, CategoryGroupChart.

### Custom dashboard-tour (`244c926`)
**Migration [0039_tour_completed_at.sql](supabase/migrations/0039_tour_completed_at.sql)**
— `family_members.tour_completed_at` timestamptz. Auto-start på
dashboard hvis `setup_completed_at != null AND tour_completed_at == null`.

**Tour-komponent** (425 LOC) bygget fra bunden uden bibliotek:
- **Spotlight via box-shadow-trick**: én div over target med 9999px
  shadow-spread der dimmer alt udenfor. Target forbliver synligt og
  klikbart igennem cutoutet.
- **Smart placement**: foretræk under target, fallback til
  over/venstre/højre baseret på skærmplads. Klamper til viewport-margin.
- **Tastatur-nav**: ArrowLeft/Right + Escape
- **ScrollIntoView** animerer target ind hvis off-screen
- **Re-positionering** ved scroll/resize via tick-state

7-step rundtur: velkomst → checkliste → HeroStatus → CashflowWarnings
→ CashflowGraph → Sidebar Værktøjer → færdig-modal.

### Tour-fixes (auto-skip + modal-fallback)
- **`725a1b1`**: auto-skip steps hvor target ikke findes (typisk fordi
  OnboardingChecklist er forsvundet når alt er færdigt). 350ms delay
  for async-renderede komponenter, ellers spring straks.
- **`1def59e`**: ren modal-fallback — alle steps vises altid, enten med
  spotlight-tooltip eller centreret modal hvis target mangler. Sikrer
  at onboardings-fortællingen er komplet uanset side-state.
- **`53076a8`**: placement-overlap fix på trin 3 (HeroStatus) +
  vertikal clamping på trin 6 (Sidebar Værktøjer der gik off-screen).

---

## 12. Per-page tour-infrastruktur (4. maj)

### Etape 1 (`6caf26e`)
**Migration [0040_per_page_tours.sql](supabase/migrations/0040_per_page_tours.sql)**
— skifter fra single `tour_completed_at`-timestamp til `tours_completed`
**jsonb**-objekt på `family_members`. Eksisterende dashboard-tour-state
migreres til `{dashboard: timestamp}`. Den gamle kolonne droppes.

DAL-helpers ([lib/dal/auth.ts](lib/dal/auth.ts)):
- `hasCompletedTour(key)` — tjekker om brugeren har set en specifik tour
- `markTourCompleted(key)` — tilføjer timestamp for tourKey i jsonb
- `resetAllTours()` — nuller hele jsonb (genstart alle rundture)

Tour-komponent flyttet fra `dashboard/_components` til `(app)/_components`
så enhver side kan importere den.

**Generic [PageTour.tsx](app/(app)/_components/PageTour.tsx)**: tager
`tourKey + steps + autoStart`, håndterer auto-start lokalt, kalder
`completeTour`-action ved færdig.

### Etape 2 (`3bea6e7`)
Per-page tours på 9 hovedsider:
- **konti**: konti-sections, konti-new
- **laan**: laan-list, laan-new
- **indkomst**: indkomst-hovedindkomst, indkomst-biindkomst
- **budget**: budget-table
- **poster**: poster-filters, poster-add
- **overforsler**: overforsler-list, overforsler-add
- **faste-udgifter**: faste-udgifter-cards
- **husholdning**: husholdning-budget, husholdning-add
- **opsparinger**: opsparinger-recommended, opsparinger-all

Ny `shouldShowTour(key)`-helper i `auth.ts` gater på `setup_completed_at
+ tours_completed` — sparer hver side for boilerplate. Dashboard
refactored fra inline-check til samme helper.

`data-tour="..."` attributes drysset på relevante sektioner/knapper så
spotlight kan finde målet.

---

## 13. Em-dash-cleanup (4. maj)

`dfaaa11` — sed-fejet 139 filer for at erstatte alle em-dashes med
almindelige bindestreger overalt i kodebase, kommentarer, UI-tekst og
migrations. Ændrer min tidligere stil-præference fra forrige session.

---

## Sådan kommer du videre

1. **Kør de 13 nye migrationer** i Supabase i rækkefølge:
   `0028` → `0040`. Vigtigt at `0030` og `0031` er kørt før privacy-tests,
   og at `0038` (handle_new_user fix) er kørt før nye brand-new-household
   signups testes.

2. **Test wizard-flowet ende-til-ende** for både ejer og partner i:
   - Solo-mode
   - Familie + særskilt økonomi
   - Familie + fællesøkonomi (NYT)

3. **Test privacy-hardening**: log ind som Louise og bekræft at hun ikke
   ser Mikkel's private lønkonto-transaktioner og deres komponenter.

4. **Genstart rundture**: `/indstillinger` → "Genstart rundture i appen"
   nuller hele `tours_completed`-jsonb. Test at alle 9 sider auto-starter
   deres egen tour ved næste besøg.

5. **Test DAWA-autocomplete**: skriv 3+ tegn af din adresse på
   `/indstillinger` Min profil og bekræft at forslag dukker op fra
   `api.dataforsyningen.dk`.

---

## Åbne tråde

- **Skift mellem economy_type** (separate ↔ shared) er ikke understøttet
  UI-mæssigt — brugeren skal starte forfra hvis de vil ændre. Kolonnen
  er teknisk mutable, men vi guider ikke til det.
- **Tour-content per side er minimal** — typisk 1-2 steps. Hvis brugerne
  giver feedback om at de mangler kontekst, kan flere steps tilføjes
  uden migrations (`tours_completed`-jsonb er fri-form).
- **Workplace-adresse på family_members** bruges på sigt til
  befordringsfradrag — ikke implementeret endnu.
- **Privacy-policies på `transaction_components`** følger transactions
  via cascade, men der er ingen UI-test for at edge cases (komponenter
  uden transaction-FK) håndteres korrekt. Bør verificeres når flere
  brugere har data.
- **DAWA-rate-limiting**: api.dataforsyningen.dk er gratis men har
  rate-limits. Hvis vi får mange concurrent signups kan vi rammes —
  bør caches/debounces hærdes hvis trafikken vokser.
- **Forecast-baseret HeroStatus** viser nu samme tal som cashflow-grafen,
  men der er stadig kant-tilfælde hvor brugeren har **én** primary 'once'-
  paycheck og getCashflowGraph ikke kan beregne et meningsfuldt
  gennemsnit. Den nuværende fallback bruger gennemsnittet af det vi har —
  bedre end ingenting, men ikke pålideligt.
