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

---

# Devlog — 4. maj 2026 (eftermiddag)

Eftermiddag dedikeret til budget-finpudsning + en hel offentlig side-stak:
landing page på `/` og en grundig privatlivs-side på `/privatliv`. Plus
to mindre forbedringer på `/budget`-tabellen (periode-toggle og andels-
kolonne).

---

## 1. Budget-tabel: periode-toggle (Måned/Kvartal/År)

[BudgetTable.tsx](app/(app)/budget/_components/BudgetTable.tsx) fik en
tre-vejs pill-toggle ved siden af Fælles/Private-tabben:

- **Måned** (default) - viser monthlyEquivalent uændret
- **Kvartal** - alle beløb × 3
- **År** - alle beløb × 12

Multipliers ligger i en lille `PERIOD_MULTIPLIER`-record. Fælles/Private-
tab-totalerne, gruppe-totalerne, child-rækkernes beløb, kolonne-headeren
("Beløb / md" → "/ kvr" / "/ år") og footeren skifter alle med toggle'n.

Sub-amount-linjen (effective i recurrence-naturlig periode) vises nu kun
når `r.recurrence !== period` - så en månedlig udgift står ren i Måneds-
view, men får sub-linjen "9.000 kr/md" når man skifter til År-view; en
årlig udgift omvendt.

## 2. Budget-tabel: andels-kolonne

Ny "Andel"-kolonne placeret yderst til højre (efter Beløb), efter
brugerens feedback om at den skulle ud mod beløbet.

Procentsatsen regnes ud fra **scopets total** (sharedTotal eller
privateTotal) - ikke det filtrerede subset. Det betyder at "Forsikring
8%" forbliver det samme uanset om brugeren har skåret tabellen ned med
søgning eller dropdown-filtre. Stabilt billede af budget-fordelingen.

`sharePct()`-helper håndterer to kant-tilfælde: scopeTotal=0 → "—",
0 < pct < 1 → "<1%". Resten rundes til heltal.

---

## 3. Landing page på `/`

Helt ny offentlig side bygget på [app/page.tsx](app/page.tsx) - erstatter
den gamle redirect-til-dashboard. Loggede brugere bouncer stadig videre
til /dashboard via en `redirect()` i selve page-komponenten, så samme URL
virker for begge tilfælde.

[proxy.ts](proxy.ts) opdateret: `/` er ikke længere i `isProtected`-listen.
Selve siden gater authn'en.

### Sektioner

- **Sticky top-nav** med wordmark + Log ind / Kom i gang
- **Hero**: pille-badge + tagline i ZT Nature Bold + 2 CTAs + 4-item
  trust-strip (19 kr/md fast pris · Lavet i Danmark · Ingen bank-adgang ·
  GDPR-compliant). Til højre: faux-screenshot af `HeroStatus` med ægte
  styling og et flydende Cashflow-tjek-card
- **Features**: 6 differentierings-blokke (Familie-økonomi, Forecast fra
  lønsedler, Strategisk opsparing, Cashflow-rådgiver, Privatliv som
  standard, Lån+pension forstået)
- **Demo-strip**: stiliseret "Udgifter pr. gruppe"-card med ægte gruppe-
  farver (Bolig & lån purple, Forsyning cyan...)
- **Sådan kommer du i gang**: 4-trin (Opret konto → Tilføj løn → Faste
  udgifter → Få overblik)
- **FAQ**: 5 spørgsmål via native `<details>/<summary>` (no JS)
- **Final CTA**: emerald-800 fuldbredde-strip
- **Footer** med wordmark + link til /privatliv + © + "En del af Stærhs"-
  link til [stæhrs.dk](https://www.stæhrs.dk)

### Pris-positionering

Endelig pris er **19 kr/md, fast, uden tier-systemer**. Synlig to steder
på landing:

- I trust-stripen lige under hero-CTAs som første item
- Som lille subline under final CTA-knap: *"Senere 19 kr/md - fast pris,
  aldrig dyrere"*

YNAB-niveau (~150 kr/md) er for dyrt og signalerer "for finance nerds".
50 kr/md ville være et tier-system uden grund - 19 kr/md dækker driften
med god margin og holder appen tilgængelig.

### Sproglig retning

To FAQ-iterationer cementerede tonen:

1. **"Hvad gør Fambud anderledes?"** (var: "Hvad er forskellen til YNAB
   eller Spirii?"). Pivottet fra konkurrent-knock til værdi-statement -
   100% uafhængighed (ingen banker, rådgivere, tredjeparter), Fambud som
   guide der "ikke dømmer valg, men hjælper dig træffe dem mere bevidst".

2. **"Hvem er Fambud til?"** (var: "Kan jeg bruge det alene, uden
   familie?"). Det gamle spørgsmål antog at Fambud var en familie-app
   med solo som halv-feature. Nu inkluderende: solo, par, familier,
   studerende, karriere-folk, pensionerede - appen tilpasser sig.

---

## 4. Privatlivs-side på `/privatliv`

Helt ny side ([app/privatliv/page.tsx](app/privatliv/page.tsx)) - offentlig,
ingen auth, fuldt scrollbar læseoplevelse i Fambud-stil. Bygget om brugerens
reelle bekymringer ved at indtaste økonomi i en ukendt app.

### Strukturen (10 sektioner)

1. **Vores løfte** (emerald-accent box) - fire klare "aldrig"-statements
2. **Hvad gemmer vi om dig** - konkret liste: login (krypteret hash, vi kan
   ikke se kodeordet), profil, familie, økonomi-data, indstillinger.
   Eksplicit *"Vi opretter ikke tracking-profiler"*
3. **Hvem kan se hvad** (emerald-accent - vigtigste afsnit) - fire
   subsektioner: dig selv, familiemedlemmer (kun Fælles), os hos Fambud
   (vi *kan* teknisk men *gør det ikke*), tredjeparter (ingen)
4. **Hvor ligger dine data** - Frankfurt EU, Supabase, TLS 1.3 i transit,
   AES-256 i hvile, daglige backups med 7 dages historik
5. **Cookies** - tabel med kun to cookies: `sb-*` (Supabase auth) og
   `fambud_session_only` (det vi byggede med "Husk mig"-flag). Eksplicit
   *ingen Google Analytics, ingen Facebook Pixel, intet ad-netværk*
6. **Dine rettigheder** - GDPR (indsigt, rettelse, sletning, portabilitet,
   indsigelse) i plain dansk
7. **Hvad vi aldrig gør** (emerald-accent) - 6 punkter med rød ✕
8. **Underleverandører** - ærlig liste: Supabase, Vercel, DAWA - hvad hver
   ser
9. **Spørgsmål** - `privatliv@stæhrs.dk` + link til Datatilsynet
10. **"Sidst opdateret"-stempel** så folk ved teksten er aktiv

### FAQ-spørgsmålet om data udvidet

"Mine data - hvor ligger de?" gik fra 3 sætninger til en fyldestgørende
reassurance der nævner TLS 1.3 + AES-256 + Row Level Security konkret,
plus link til den fulde dataerklæring. `FaqItem`-komponenten er udvidet
til at acceptere `React.ReactNode` som svar (tidligere kun `string`) så
inline `<Link>`/`<strong>` virker.

---

## Åbne tråde

- **Skattefradrag-side**: vi har workplace-adresse til at beregne
  befordringsfradrag, men der er ingen UI for det endnu. Næste skridt
  hvis vi vil leve op til "skattefradrag som førsteklasses koncept" i
  Features-blokken.
- **Eksport-funktion**: nævnt i privatlivs-siden under "Dine rettigheder"
  som JSON-eksport med 30 dages svartid - men selve eksport-knappen
  findes ikke endnu. Skal bygges som server-action i /indstillinger.
- **Cookie-banner**: vi har bevidst ikke et cookie-banner siden vi kun
  bruger nødvendige cookies. Hvis vi nogensinde tilføjer analytics
  (selv anonyme) skal banneret tilbage før relevante cookies sættes.
- **`privatliv@stæhrs.dk`**-mailbox: er nævnt på siden men skal også
  oprettes hos email-hostingen.
- **Pricing-page**: 19 kr/md står i FAQ + landing trust-strip + final CTA-
  subline, men der er ingen dedikeret /priser-side. Hvis pricing bliver
  mere kompleks senere (gruppe-rabatter, årlig pris) skal det flyttes ud.

---

# Devlog — 4.-5. maj 2026 (auth, feedback, sikkerhedsaudit, perf)

Lang session. Resend-baseret email-flow (signup-confirmation +
password-reset), feedback-form med email-notifikation, en beta-notice
modal, og dernæst 8 runder security-audit med 12 nye migrations. Sluttede
af med UX/perf-forbedringer på det vi havde lært.

Ingen ny featuremæssig overflade - dette var "det app'en mangler for at
være delbar med rigtige test-brugere". Bagefter er Fambud klar til at
åbnes for venner og familie.

---

## 1. Resend email-stak

**Konfiguration:** `fambud.dk` verificeret hos Resend (DKIM + SPF + DMARC
TXT-records hos one.com), API-key + `RESEND_FROM_EMAIL` (`Fambud
<noreply@fambud.dk>`) + `FEEDBACK_NOTIFICATION_EMAIL` på Vercel. Supabase
Auth peger SMTP-kald til Resend så signup-confirmation og password-reset
mails kommer fra vores eget domæne (ikke Supabase's rate-limited
default-afsender).

**Email-templates** (Supabase Dashboard → Authentication → Email Templates):
- *Confirm signup* og *Reset Password* har begge fået dansk HTML-template
  med Fambud-branding (emerald-grøn knap, neutral-grå brødtekst, 480px
  max-width, table-baseret layout for Outlook-kompabilitet)
- Begge bruger samme `{{ .ConfirmationURL }}`-placeholder
- Plain-text-fallback til mail-klients der ikke renderer HTML

**Glemt-adgangskode-flow:**

[app/glemt-kodeord/](app/glemt-kodeord/) - email-input → Supabase
`resetPasswordForEmail`-RPC → "tjek din mail"-skærm. Vi viser ALTID
success-skærmen uanset om emailen findes - forhindrer email-enumeration
(en angriber kan ikke prøve adresser for at finde gyldige konti).

[app/auth/callback/route.ts](app/auth/callback/route.ts) - GET-handler
der bytter Supabase PKCE-koden til en session og redirecter til
`?next=/nyt-kodeord`.

[app/nyt-kodeord/](app/nyt-kodeord/) - bruger sætter ny adgangskode (≥6
tegn, gentag for verificering). Efter succesfuld update kalder vi
`signOut({ scope: 'others' })` så stjålne sessioner på andre devices
kicker'es. Hvis nogen har kompromiteret en session og brugeren reset'er,
mister angriberen adgangen straks.

---

## 2. Feedback-form med Resend-notifikation

**Migration:** [0041_feedback.sql](supabase/migrations/0041_feedback.sql)

Hybrid-arkitektur fordi vi vil ikke miste feedback hvis Resend fejler:

- DB er kilden: `feedback`-tabel (`id, user_id, household_id, email,
  full_name, message, page_url, user_agent, created_at`) med RLS der
  KUN tillader INSERT for authenticated brugere hvor `user_id =
  auth.uid()`. Ingen SELECT-policy → læsning udelukkende via Supabase
  Dashboard / service_role.
- Notifikations-mail er bonus: server action gemmer altid til DB først,
  derefter Resend. Hvis Resend fejler logges det og fortsætter -
  feedback'en er stadig sikret.

**App:** [FeedbackModal.tsx](app/(app)/_components/FeedbackModal.tsx) -
"Send feedback"-knap nederst i sidebaren åbner en modal med textarea
(5000 tegn cap), auto-fokus, inline success/error-state via
`useTransition`. Brugeren forlader ikke siden.

**Email:** mail med `replyTo: user.email` så admin kan svare direkte til
bruger. HTML escapes alle felter (fullName/email/pageUrl/message) inden
de interpoleres - vi gemmer ikke ondsindede payloads, men en bruger
kunne sætte sit display-navn til `<a href="evil">klik</a>` og phishe
admin via mail-klient.

[lib/email/resend.ts](lib/email/resend.ts) - tynd HTTP-wrapper rundt om
Resend's REST API (intet SDK, bare `fetch`). CRLF strippes fra `from`,
`subject`, `replyTo` som defense-in-depth mod header-injection.

---

## 3. Beta-notice modal

[BetaNotice.tsx](app/(app)/_components/BetaNotice.tsx) - velkomst-modal
der vises én gang pr. browser-session via `sessionStorage`.

> *"Tak fordi du er med så tidligt. Appen er stadig under aktiv
> udvikling - du kan støde på små fejl, manglende detaljer eller
> ændringer fra dag til dag. Driller noget eller mangler du noget?
> Skriv det gerne til os."*

Hydration-safe: starter skjult og åbner kun fra `useEffect`, så
server- og client-render matcher. Ved tab-close eller logout/login
ryddes sessionStorage og beskeden vises igen - matcher "hver gang man
logger ind"-kravet uden cookie eller DB-flag.

---

## 4. Sikkerheds-audit (8 runder, 12 migrations)

Det her var sessions-tyngdepunktet. Spawn'ede 3 parallelle audit-agents
med fokuserede briefs (auth/RLS, injection-vektorer, secrets/abuse) og
fik 25+ findings i runde 1. Hver runde af fixes blev dernæst re-auditet
- og hver re-audit fandt nye huller, inklusive 2 P0-bugs hvor vores egne
sikkerhedsfixes brød funktionalitet.

### Migrations 0042-0053:

**0042 - households owner-only UPDATE.** Tidligere RLS-policy tillod
alle medlemmer at opdatere households direkte via supabase-anon-key fra
browser-devtools, hvilket omgik app-niveau owner-tjek i `setEconomyType`.

**0043 - fjern Path 2 email pre-approval.** Tidligere kunne en angriber
oprette en `family_members`-række med `email = "stranger@example.com"`
i sin egen husstand. Når personen senere signede op, fanger
`handle_new_user` Path 2 deres email og linker dem ind i angriberens
husstand uden samtykke. Path 2 er fjernet helt; Path 1 (invite-kode)
opgraderet til at adoptere eksisterende pre-godkendelse-rækker. Globalt
unique-email-indeks erstattet af per-household-unique.

**0044 - rate_limits-tabel + SECURITY DEFINER `rate_limit_check`-RPC.**
Postgres-baseret rate limiter (frem for Upstash/Redis - færre deps).
Anvendt på `/signup` (5/time/IP), `/glemt-kodeord` (5/time/IP+email),
`/login` (10/15min/IP+email), `submitFeedback` (10/time/user +
30/time/household).

**0045 + 0047 + 0052 - household-consistency triggers.** RLS gater
hvem der kan SKRIVE til hver tabel, men ikke at cross-table referencer
forbliver inden for samme husstand. En angriber der lærer en kategori-
UUID fra en anden husstand kunne tidligere indsætte en transaction der
refererer den fremmede kategori. Trigger på `transactions.category_id`,
`transaction_components.transaction_id`, `transfers.from_account_id` +
`to_account_id`, og `transactions.family_member_id` håndhæver nu
household-konsistens. Alle SECURITY DEFINER + NULL-as-fail.

**0046 + 0049 + 0051 - `family_members` RLS split + guard-trigger.**
Den oprindelige policy gav alle medlemmer fuld UPDATE-adgang. Et medlem
kunne self-promote til 'owner' via direkte Supabase-kald og dermed
bypasse alle owner-only app-checks. Vi splittede til SELECT/INSERT/
DELETE for medlemmer + to UPDATE-policies (self for ufarlige felter,
owner for alt). En BEFORE UPDATE trigger blokerer ændringer af `role`,
`user_id`, `household_id`, `email` (de eneste felter der reelt er
privilege-escalation-vektorer) når caller ikke er owner.

To P0-bugs blev opdaget i selve denne mekanisme i to forskellige runder:
- Runde 4 fandt at trigger'en blokerede `handle_new_user` Path 1's
  invite-adoption (auth.uid() er ikke owner ved signup). Fix:
  `pg_trigger_depth() > 1`-bypass for nested trigger-kald.
- Runde 7 fandt at samme trigger blokerede `mark_setup_complete` RPC -
  hvilket betød at INGEN non-owner partner-signup kunne afslutte
  wizarden siden runde 2 (production-broken i 5 dage). Fix: fjern
  `setup_completed_at`, `joined_at`, `position` fra "kritisk felter"-
  listen siden de ikke er sikkerhedsrelevante.

**0048 - rate_limit_routes lookup-tabel.** En angriber kunne kalde
`rate_limit_check` RPC direkte med `p_max_hits=999999` og poison'e
andre brugeres bucket. Vi indfører nu en lookup-tabel med hardcoded
lofter pr. route, og RPC'en ignorerer client-leverede args. Plus owner-
only RLS på `household_invites` og revoke af `rate_limit_cleanup` fra
public.

**0050 - revoke EXECUTE på interne SECURITY DEFINER funktioner.**
Postgres grant'er som default EXECUTE til PUBLIC. Trigger-funktioner
som `handle_new_user` og `guard_family_members_critical_columns` skulle
ikke kunne kaldes direkte fra anon/authenticated - revoke'd.

**0053 - per-household feedback rate-limit.** Med 5 medlemmer i én
husstand kunne de samlet sende 50/time → 1200/dag, hvilket drainer
Resend free-tier (3000/md). Tilføjet `feedback_household` route med
30/time loft.

### App-niveau hærdninger:

- **Open redirect** på `/auth/callback` lukket (`safeNextPath` afviser
  `//`, `/\\`, `/@`)
- **HTML-escape** på alle user-input-felter i feedback-mail (subject,
  fullName, email, pageUrl, message)
- **deleteFamilyMember** kræver nu `role='owner'` og afviser sletning
  af aktive brugere (`user_id IS NOT NULL`) - ellers kunne et medlem
  forge en POST og slette ejerens family_member-række, hvilket ville
  låse ejeren ude permanent
- **proxy.ts deny-by-default**: whitelister kun public routes (`/`,
  `/login`, `/signup`, `/glemt-kodeord`, `/nyt-kodeord`, `/privatliv`,
  `/join/*`, `/auth/*`) og kræver auth på alt andet. Tidligere version
  manglede flere `(app)`-routes fra `isProtected`-listen.
- **Account-kind validering** på alle write-actions der accepterer
  `account_id` fra FormData ([lib/actions/account-validation.ts](lib/actions/account-validation.ts)).
  Forhindrer at en angriber kan POST'e til `/poster` med
  `account_id` pegende på et lån og forfalske afdrag.
- **mapDbError** ([lib/actions/error-map.ts](lib/actions/error-map.ts))
  mapper kendte Postgres-fejl til danske beskeder. Erstatter ~100
  steder hvor raw `error.message` tidligere blev sendt ind i URL'en
  (afslørende schema-/constraint-/trigger-navne).
- **wizard-actions** har nu `guardWizardOpen()` som første linje -
  redirecter post-setup-brugere til /dashboard så wizard-actions
  med side-effekter ikke kan kaldes via direkte POST.
- **Length-caps** på alle fri-tekst-felter via `capLength` +
  `TEXT_LIMITS` ([lib/format.ts](lib/format.ts)) for at undgå
  MB-store strings i text-kolonner. Inkl. UTF-16 surrogate-handling
  (cap'er ikke midt i en emoji).

### Andet:

- **Security headers** ([next.config.ts](next.config.ts)): CSP,
  X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-
  Policy strict-origin, Permissions-Policy
- **Signup user-enumeration fix**: 'User already registered' redirecter
  nu til check-email-skærmen (samme som ny signup) i stedet for at
  vise distinkt fejl
- **postcss CVE GHSA-qx2v-qp2m-jg93** lukket via `overrides` i
  package.json
- **Generic getHouseholdContext error**: kaster nu 'Internal error' og
  logger detail server-side - lækker ikke trigger-navn i UI

---

## 5. UX: loading-feedback når server arbejder

User-rapport: "Klik føles dødt i 1-2 sekunder før knappen reagerer".
Tre fixes mod den fornemmelse:

**[SubmitButton.tsx](app/_components/SubmitButton.tsx)** + opgradering
af [eksisterende SubmitButton](app/(app)/_components/SubmitButton.tsx)
med `useFormStatus()`:
- Knappen viser instant en `<Loader2>`-spinner + skifter label til
  pending-text (`Logger ind...`, `Opretter konto...`, `Sender link...`,
  `Gemmer...`)
- Disabler sig selv mens action kører - umuligt at double-submit
- Anvendt på `/login`, `/signup`, `/glemt-kodeord`, `/nyt-kodeord`,
  `/join/[code]`, og automatisk på alle eksisterende main-forms
  (LoanForm, AccountForm, TransferForm, TransactionForm, IncomeForm)

**Page-level loading**: [app/(app)/loading.tsx](app/(app)/loading.tsx)
+ [app/wizard/loading.tsx](app/wizard/loading.tsx). Next.js viser
automatisk denne UI mens en server-component renderer. Fanger
navigations-pause på 0,5-2s mellem sidebar-klik og næste side er klar.
Sidebaren forbliver synlig pga. parent layout - kun main-arealet får
loading-state.

Brugeren ser nu feedback inden for samme animation-frame som deres
klik. Den faktiske server-tid er uændret, men perceived performance
forbedres markant fordi "føles ødelagt"-vinduet er væk.

---

## 6. Perf: dedupe auth-context queries

Dashboard-page kalder ~12 DAL-funktioner i parallel via `Promise.all`.
Hver eneste kalder `getHouseholdContext()` (eller `getMyMembership`)
internt for at hente household_id. Det resulterede i ~12 redundante
DB-queries pr. dashboard-load alene for auth-context.

[lib/dal/auth.ts](lib/dal/auth.ts) - wrappet `getHouseholdContext`,
`getMyMembership` og `requireUser` i React's `cache()`. Dedupliker kald
inden for samme request:
- 12 calls → 1 DB query for `family_members` lookup
- 12 calls → 1 `supabase.auth.getUser()` read
- 12 calls → 1 `createClient()`

`cache()` er per-request (ikke cross-request) - to forskellige users
får hver deres data, og cache nulstilles når Next.js streamer responsen
ud. Sikkerhedsmæssigt safe.

Forventet impact: 50-200ms hurtigere dashboard-load i prod afhængigt af
DB-latency.

---

## Status

12 nye migrations på prod (0041-0053). Alle anvendt og funktionelt
verificeret med direct DB-tests:
- `setup_completed_at` self-update virker (P0 fix verified)
- Role-change blokeret for non-owner (security maintained)
- Cross-household category/family_member/transfer-references blokeret
- Rate-limits blokerer ved konfigureret loft for feedback/login/signup/
  reset_password
- Hardcoded route-loft brugt (klient-args ignoreres)

`npm audit`: 0 vulnerabilities. `tsc --noEmit`: 0 errors.

Vi gennemgik 8 audit-runder; runde 1 fandt 25+ fund, runde 8 fandt 0
Critical og kun copy-issues. Vi har empirisk valideret at hver
sikkerhedsmekanisme virker som forventet og ikke blokerer normale
flows. Sikkert at åbne for testbrugere.

---

## Åbne tråde fra denne session

- **Self-betjent slet-konto-flow**: privatliv-siden henviser nu til
  manuel email-kontakt for sletning. Implementér `auth.admin.deleteUser`
  + cascade som server-action på et tidspunkt for at matche GDPR-best-
  practice.
- **Toast notice phishing**: `?notice=...`-param renders som tekst i
  toast (React-escaped, ingen XSS) men en angriber kan vise en falsk
  "Din konto er suspenderet" via crafted URL. Lav risiko; bevidst
  defereret.
- **Vercel cold-start på landing**: første besøg efter idle kan tage
  1-2s før HTML kommer. Kræver Vercel Edge Functions eller pre-warming
  - vi accepterer dette indtil traffic gør cold-starts sjældne.
- **Server-action latency**: 200-500ms for selve Supabase-roundtrip
  kan vi ikke optimere fra app-koden. Vi accepterer det og loader-
  states i SubmitButton + loading.tsx gør at det føles OK.
- **Resend SMTP-fallback**: hvis Resend nogensinde går ned, fejler
  password-reset og signup-confirmation-mails. Worth tilføje en
  cron-baseret retry på `feedback`-tabellen, men auth-mails går
  direkte gennem Supabase's eget Resend-link, så vi kan ikke selv
  retrye dem.
- **Setup-wizard for non-owner partner**: efter migration 0051's P0
  fix er flowet teknisk in tact, men der er endnu ingen explicit
  dansk hjælpetekst om hvorfor partner ser nogle andre wizard-trin
  end ejer (fx ingen "tilføj partner"-trin for partner). Tilføj
  copy-pas hvis testbrugere bliver forvirrede.

---

# Devlog — 5. maj 2026 (sikkerhedsaudit Prompt 5-10 + Sentry + GDPR)

Dagens session fortsatte den systematiske sikkerhedsaudit fra runde 1-8
ind i et nyt 13-prompts-forløb fra projektlederen. Vi nåede gennem
Prompt 5 til 10. Plus en akut GDPR-fix-runde og fuld Sentry-installation.

Fokus var at gå fra "vi har ryddet op i de fund vi selv kunne se" til
"vi har struktureret roadmap, monitoring, breach-response, og en
privatlivspolitik der matcher implementeringen". 11 P-items med konkrete
deadlines er nu i [SECURITY_AUDITS.md](SECURITY_AUDITS.md).

---

## 1. Sikkerhedsaudit Prompt 5-10

Per-prompt-detaljer ligger i [SECURITY_AUDITS.md](SECURITY_AUDITS.md).
Højdepunkter:

**Prompt 5 — Krypto og randomness**:
[migration 0054_csprng_invite_codes.sql](supabase/migrations/0054_csprng_invite_codes.sql)
erstatter `random()` (LCG) med `gen_random_bytes()` (CSPRNG) i
`generate_invite_code()`. Verificeret med 5 testkoder: ZESG65CV,
NHKGEMVV, 6SZCK2P8, H8JQ5CPJ, RDAJM25S — alle uniformt fordelt.

**Prompt 6 — Authentication hardening**:
[lib/common-passwords.ts](lib/common-passwords.ts) — in-app blocklist på
~100 entries inkl. danske patterns (kodeord1, danmark1, kobenhavn,
familie123). Brugt i [signup/actions.ts](app/signup/actions.ts) og
[nyt-kodeord/actions.ts](app/nyt-kodeord/actions.ts). Projektlederen
udfordrede deferral af denne — vi var enige, blev implementeret samme
session.

**Prompt 7 — Atomicity + race conditions**:
`pushLoanToBudget` i [laan/actions.ts](app/(app)/laan/actions.ts) havde
en race hvor transaction blev oprettet men components-INSERT kunne fejle
og efterlade en orphan. Fix: compensating delete der ruller transaction
tilbage hvis components fejler. Soft-delete på finansielle tabeller
deferret som **P1** (deadline 30. juni 2026) efter projektleder-pushback
om "trigger 100+ transactions" var for vagt.

**Prompt 8 — IDOR + mass assignment**:
70 Server Actions optalt; alle reviewed for pattern-konsistens. Ingen
`Object.fromEntries(formData)`, ingen `.passthrough()` (ingen Zod brugt
overhovedet), ingen privilegerede felter læst fra request. **Men**
projektleder-feedback udfordrede "strukturelt immun"-formuleringen —
omformuleret til "konsistent mønster i alle reviewede actions, konvention
ikke håndhæves". **P5** (lint-rule der enforcer mønstret) tilføjet til
roadmap.

**Prompt 9 — Email deliverability + phishing-resistance**:
Live DNS-lookups viste DKIM publiceret korrekt på `resend._domainkey`,
SPF korrekt på `send.fambud.dk` (`v=spf1 include:amazonses.com ~all`),
Null MX på root (RFC 7505). Men **DMARC står på `p=none` uden `rua=`**
— monitor-mode uden rapport-modtager = compliance theater.
Reset-password-template mangler kontekst (IP/tid) der kan skelne ægte
fra phishing. Tre P-items: **P6** (custom reset-mail), **P7** (DMARC
ramp-up med 5 konkrete kalender-datoer fra 2026-05-19 til 2026-06-23),
**P8** (officiel `support@fambud.dk`-mailbox).

**Prompt 10 — GDPR compliance review**:
17-punkts checklist mod GDPR Art. 6, 13, 15-22, 28, 33-34. Resultat:
4 HIGH + 3 MEDIUM fund. Akut fix-runde kørt samme session — se sektion
2 nedenfor.

---

## 2. GDPR akut fix-runde (Prompt 10 FIX 1-13)

**Signup samtykke-link** ([app/signup/page.tsx](app/signup/page.tsx)):
Tilføjet paragraf over "Opret konto"-knap: "Ved at oprette konto
bekræfter du at have læst vores privatlivspolitik...". Implicit samtykke
via knap-klik er accepteret praksis under GDPR Art. 13 når policy'en
er linked synligt og ingen tracking-cookies kræver granular samtykke.

**Privatlivspolitik udvidet** ([app/privatliv/page.tsx](app/privatliv/page.tsx)):
- Ny "Retsgrundlag og opbevaring"-sektion med 7-rækkers retsgrundlag-
  tabel (mappet til Art. 6, stk. 1, litra b/f) og 5-rækkers
  opbevarings-liste (aktive konti, slettede konti, fejl-logs,
  audit-log fremtid, lovpligtig undtagelse — bogføringsloven nævnt
  som ikke-relevant pt.)
- Sub-processor-listen udvidet fra 3 til 5: tilføjet **Resend**
  (transaktionelle emails via AWS SES eu-west-1) og **one.com** (DNS +
  email-forwarder)
- DPA-links tilføjet pr. underleverandør (Supabase, Vercel, Resend)
  eller dokumenteret-note hvor link ikke er offentligt (one.com, DAWA)
- "Hvor ligger dine data?"-sektion omformuleret: tidligere lovede vi
  "alt i Frankfurt" hvilket er upræcist for Vercel global edge-network.
  Ny formulering: persistent data (DB + emails) er i EU; edge-funktioner
  kan køre globalt men persisterer ikke. Det er ærlighed-over-claim
  indtil vi verificerer Vercel-plan og evt. tilføjer
  `vercel.json: {"regions": ["fra1"]}` (kræver Pro+).
- To nye komponenter: `LegalBasisTable`, `SubprocessorList`

**Breach response plan** ([SECURITY_AUDITS.md](SECURITY_AUDITS.md)):
Trigger-liste, 6-trins handle-procedure, kontaktinfo til Datatilsynet
(<dt@datatilsynet.dk> / +45 33 19 32 00), dokumentationskrav efter
Art. 33(5). Forudsætter monitoring (Sentry — se sektion 3) for at
kunne "become aware" inden 72 timer.

---

## 3. Sentry monitoring + PII-redaction

`@sentry/nextjs ^10.51.0` installeret. 5 nye filer:

- [lib/sentry-scrub.ts](lib/sentry-scrub.ts) — delt PII-redaction
  helper. `scrubPII<T>()` stripper `event.request.data`, `cookies`,
  `headers.authorization`/`cookie`, `user.email`/`username`/`ip_address`,
  `query_string` (erstattes med `[redacted]`). Type-narrowed wrappers
  `scrubErrorEvent` + `scrubTransactionEvent` for at undgå cast i
  init-calls.
- [sentry.server.config.ts](sentry.server.config.ts) — Node.js runtime
  init (Server Actions, Route Handlers, RSC)
- [sentry.edge.config.ts](sentry.edge.config.ts) — Edge runtime init
- [instrumentation.ts](instrumentation.ts) — Next.js wire-up,
  re-eksporterer `captureRequestError as onRequestError`
- [instrumentation-client.ts](instrumentation-client.ts) — browser init,
  `onRouterTransitionStart` for Next.js 16 router-instrumentation,
  Session Replay deaktiveret (PII-risk uden strict masking)

Alle tre runtimes har `sendDefaultPii: false` eksplicit + `beforeSend`
hooks via shared scrub-helper.

[next.config.ts](next.config.ts) wrapped med `withSentryConfig`:
- `tunnelRoute: '/monitoring'` — events sendes via vores eget domæne
  så CSP `connect-src` ikke skal udvides til `*.sentry.io`, og
  ad-blockers ikke blokerer events
- `sourcemaps.deleteSourcemapsAfterUpload: true` — source maps
  uploades til Sentry ved CI-build, slettes derefter fra bundle
- `silent: !process.env.CI` — stille i lokal dev
- `tracesSampleRate: 0.1` på alle 3 runtimes (10% performance-spans;
  errors capture'es 100% uafhængigt)
- `disableLogger` fjernet — deprecated i v10 og incompatible med
  Turbopack (Next.js 16's default-bundler)

**Tunnel-route fix i proxy.ts**: Første curl-test efter setup viste
`HTTP 307 Location: /login` på POST til `/monitoring` — middleware
fangede den. Fix: tilføjet `monitoring` til matcher-eksklusion i
[proxy.ts](proxy.ts) sammen med `_next/static` osv. Uden den ville alle
client-side Sentry-events fra udloggede brugere (landing, signup,
glemt-kodeord) blive droppet.

Verificeret: `npx tsc --noEmit` passerer, `npm run build` clean uden
warnings.

---

## 4. Roadmap-struktur: 11 P-items i SECURITY_AUDITS.md

Vi gik fra ad-hoc "vi tager det senere"-deferrals til et struktureret
roadmap. Hver P-item har severity, trigger, deadline, estimat,
begrundelse, scope, status:

| P | Tema | Severity | Deadline |
| --- | --- | --- | --- |
| P1 | Soft delete på finansielle tabeller | MEDIUM | 30. juni 2026 |
| P2 | HaveIBeenPwned password-validering | LOW | 30. september 2026 |
| P3 | Multi-device session UI | LOW | ingen hard deadline |
| P4 | HSTS preload submission | LOW | 13. maj 2026 |
| P5 | Lint-rule for Server Action-pattern | LOW | 30. september 2026 |
| P6 | Custom reset-mail med IP/tid/User-Agent | MEDIUM | 31. december 2026 |
| P7 | DMARC ramp-up til `p=reject` | MEDIUM | 23. juni 2026 (5 milepæle) |
| P8 | Officiel support@fambud.dk-kanal (2 trin) | MEDIUM | trin 1 i dag, trin 2 30. juni |
| P9 | Self-service data-export (Art. 20) | MEDIUM | 30. september 2026 |
| P10 | Udvidet Sentry runbook + audit-log tabel | LOW | 30. september 2026 |
| P11 | Vercel region-pin formaliseret | LOW | ingen hard deadline |

Alle deadlines er konkrete datoer, ikke "Q2-slut"-slang. Triggers er
formuleret som *eksterne hændelser* (vi når 50 brugere, første
breach-mistanke, etc.) — ikke "når vi har tid".

---

## 5. Hvad du skal gøre manuelt (post-deploy)

Efter `git push` deployer Vercel automatisk. Disse ting kan jeg ikke
gøre fra koden:

### Akut (i dag)

- [ ] **Verificér Sentry-tunnel virker**: kør
      `curl -X POST https://www.fambud.dk/monitoring -d "test" -i`
      efter deploy. Forventet: HTTP 200 (eller 400 invalid envelope —
      IKKE 307 til /login som tidligere).
- [ ] **Trigger en bevidst test-error** i preview-deploy (fx
      `throw new Error('test')` i en Server Action). Bekræft den dukker
      op i Sentry Dashboard inden 1 minut.
- [ ] **Verificér PII-stripping**: åbn event'en i Sentry, bekræft
      INGEN email i breadcrumbs eller `user`-felt; `request.data` tom;
      `request.cookies` tom; `query_string` er `[redacted]`.
- [ ] **3 alerts opsættes i Sentry Dashboard**:
      - Unhandled errors → instant email
      - 401/403-spike (>10 events / 5 min)
      - 500-spike (>5 events / 5 min)
- [ ] **Mail-forwarder hos one.com**: opret `support@fambud.dk` →
      forward til admin's monitorerede mail. P8 trin 1.
- [ ] **Reset-password-template** (Supabase Dashboard → Authentication
      → Email Templates → Reset Password): tilføj nederst
      "Hvis du ikke selv har anmodet om at nulstille adgangskoden, kan
      du trygt ignorere... Hvis du modtager flere af disse mails uden
      at have anmodet om dem, så kontakt os på `support@fambud.dk`."
- [ ] **DMARC rua-record hos one.com**: Erstat
      `_dmarc.fambud.dk TXT v=DMARC1; p=none;` med
      `v=DMARC1; p=none; rua=mailto:[dmarcian-eller-postmark-adresse]; fo=1; adkim=r; aspf=r;`.
      Brug gratis dmarcian eller postmark-aggregator.

### Inden 14 dage (P7 kalender-reminders SKAL i kalenderen NU)

- [ ] **2026-05-19**: Review rua-rapporter, deploy `p=quarantine; pct=10`
- [ ] **2026-05-26**: Op til `p=quarantine; pct=50`
- [ ] **2026-06-02**: Op til `p=quarantine; pct=100`
- [ ] **2026-06-09**: Skift til `p=reject; pct=10`
- [ ] **2026-06-23**: Op til `p=reject; pct=100` (slutmål)

### Når lejlighed byder sig

- [ ] **Verificér Vercel-plan** (Dashboard → Settings → Plan). Hvis
      Pro+, tilføj `vercel.json` med `{"regions": ["fra1"]}` og rul
      privatlivspolitik tilbage til den stærkere "alt i Frankfurt"-
      formulering.
- [ ] **Verificér DPA-status** hos Supabase, Vercel, Resend (deres
      respektive dashboards). Hvis nogen mangler manuel signing, log
      i SECURITY_AUDITS.md.
- [ ] **HSTS preload submission** (P4): efter mindst 7 dages
      varmeperiode med `includeSubDomains` deployet. Tilføj `preload`
      til HSTS-header i [next.config.ts](next.config.ts) og submit
      fambud.dk til <https://hstspreload.org/>.

---

## 6. Observationer fra deploy-test

Curl-testen mod `/monitoring` afslørede tre ting:

1. **Sentry-tunnel-bug** (fixet — se sektion 3)
2. **Deployed CSP mangler** `object-src 'none'` og
   `upgrade-insecure-requests` (Prompt 2-ændringer ikke deployet endnu)
3. **Deployed HSTS mangler** `includeSubDomains` (samme rod-årsag)

Næste deploy trækker både Sentry-fix og CSP/HSTS-tightening med. Worth
en verify-pass på response-headers post-deploy for at bekræfte alle tre.

---

## 7. Status efter denne session

- **10 ud af 13 audit-prompts kørt** (5, 6, 7, 8, 9, 10 i denne session
  + 1-4 i forudgående)
- **3 prompts tilbage**: 11 (logging/observability), 12 (CI/CD security
  gates), 13 (bug bounty / responsible disclosure)
- **0 critical fund åbne**, alle HIGH-fund enten fikset eller har
  basal mitigering (breach response plan + Sentry monitoring lukker
  Art. 33-gabet)
- **11 P-items** med konkrete deadlines i [SECURITY_AUDITS.md](SECURITY_AUDITS.md)
- **`npm audit`**: 0 vulnerabilities (verificeret efter Sentry install)
- **`npx tsc --noEmit`**: 0 errors
- **`npm run build`**: clean

---

## 8. Sådan kommer du videre

### Når du har tid (i morgen / over de næste dage)

1. **Kør de manuelle skridt** fra sektion 5 — specielt Sentry-alerts
   og DMARC rua-record. Begge tager <30 min.
2. **Verificér post-deploy** at alle tre observationer fra sektion 6
   nu viser korrekte response-headers.
3. **Fortsæt audit-runden**: Prompt 11 (logging og observability) er
   det naturlige næste — vi har basal Sentry på plads, så Prompt 11
   kan fokusere på audit-log-tabel, struktureret logging, ekstra alerts.

### Åbne tråde fra denne session (udover det allerede dokumenterede)

- **Test-suite for RLS**: [scripts/rls-test.ts](scripts/rls-test.ts)
  kører 72 tests på 11 tabeller × 5 ops × 3 personas. Køres manuelt;
  ingen CI-integration endnu. Worth at tilføje til Prompt 12 (CI/CD
  gates).
- **Test-brugere**: [scripts/setup-test-users.sql](scripts/setup-test-users.sql)
  opretter 5 testbrugere på 3 husstande (testA1+A2, testB1+B2,
  outsider). Bruges af RLS-tester. Idempotent — kan køres flere gange.
  Password til alle: `Abc123456`.
- **Vercel-plan-vurdering**: hvis vi på et tidspunkt opgraderer til
  Pro+, kan vi tighten privatlivspolitik + region-pin samtidig (P11).
- **Supabase Auth Email Hook (P6)**: ikke startet. Kræver edge function
  + HMAC-signatur-verifikation + IP-extraction fra proxy-headers.
  Estimat 6-10 timer. Værdi-overlap med P7 — hvis DMARC `p=reject`
  virker uden phishing-rapporter i 6 uger, kan P6 muligvis nedprioriteres.

### Hvor vi IKKE skal hen lige nu

- Soft-delete (P1) er deferred til 30. juni — har deadline, ikke akut.
- HIBP password-validering (P2) er low priority indtil brugerbasen
  vokser ud over inner circle.
- Custom reset-mail (P6) afventer P7's resultat for at se om det
  overhovedet er nødvendigt.

Sikkerhedsroadmap er nu i en tilstand hvor vi kan stå inde for det
hvis FamBud senere skal igennem due diligence eller compliance-audit.
Det er ikke længere "vi prøver at fange bugs" — det er "vi har en
plan, vi følger den, og vi dokumenterer hver beslutning."

---

# Devlog — 5. maj 2026 (mobile-first shell)

Brugerrapport: "Hele applikationen ser forfærdelig ud på mobilen". Kort,
fokuseret session der adresserer det som tre concrete fixes.

---

## 1. Hamburger-drawer for (app)-navigation

Hovedproblemet var den faste `w-56` sidebar (224px) der altid var
synlig - på en 375px-skærm åd den 60% af viewporten og main-indholdet
blev squashet til ulæselig bredde.

Ny client-komponent [MobileNav.tsx](app/(app)/_components/MobileNav.tsx)
med:

- **Sticky top-bar** (h-14) med hamburger-knap til venstre + Fambud-mark
  centreret. Vises kun under `md` (< 768px).
- **Slide-out drawer** fra venstre, 80% bredde max 320px, med backdrop +
  blur. Indeholder samme `SidebarNav` + `FeedbackModal` + log-ud-knap +
  user-email som desktop-sidebar - DRY: vi genbruger komponenterne.
- **Auto-luk** ved: pathname-skift (route-navigation), backdrop-klik,
  Escape-tast.
- **Body-scroll låses** mens drawer er åben (`document.body.style.overflow
  = 'hidden'` i useEffect-cleanup) - forhindrer iOS-scroll bag drawer.

Layout opdateret:
- `< md`: vertikal flex (top-bar + main)
- `md+`: horizontal flex (sidebar + main) som før
- Sidebar er nu `hidden md:flex`, main får fuld bredde på mobile

---

## 2. Cashflow-graf list-fallback

[CashflowGraph.tsx](app/(app)/dashboard/_components/CashflowGraph.tsx)
SVG'en har `minWidth: 480` så den force-trigger horisontal scroll på
mobile, hvilket gjorde grafen praktisk ulæselig på en 375px-skærm.

Vi viser nu i stedet en simpel liste på mobile med outflows som
`farveklat + label + type-tag + kr/md`-rækker. Farverne (rød/amber/
neutral) matcher Sankey-typernes `TYPE_FILL`/`TYPE_STROKE` så bruger
ser samme visuelle hint på begge breakpoints.

Implementation: én ny `<ul className="md:hidden">` ovenfor den
eksisterende `<div className="hidden md:block">` om SVG'en. Ingen ny
data-fetching - vi bruger samme `outflows`-array der allerede var i
scope.

---

## 3. PosterTable responsive kolonner

[PosterTable.tsx](app/(app)/poster/_components/PosterTable.tsx) havde
4 kolonner + actions (Gruppe/Navn, Dato, Konto, Beløb, Handlinger).
På mobile trængte den ud i horisontal scroll.

Strategi: skjul de mindst kritiske kolonner (Dato, Konto), flyt deres
indhold ind under navnet som en lille grå metadata-linje:

```
Husleje                           5.000 kr
Bolig
15.04.2026 · Budgetkonto         (kun på mobile)
```

Konkrete ændringer:
- `Th`-component fik et `hideOnMobile`-prop (`hidden sm:table-cell`
  klasse)
- Dato- og Konto-cellerne på data-rows: tilsvarende
  `hidden sm:table-cell`
- Ny mobile-only metadata-linje `<div className="sm:hidden">` under
  navn/kategori med `formatShortDateDA(occursOn) · accountName`
- Action-knapper: `Rediger`/`Slet`-tekst nu `hidden sm:inline`, ikoner
  alene synlige på mobile (med `aria-label` for accessibility)
- Padding skaleret: `px-3 sm:px-4`

Cell-spans i group-row + footer matcher de nye hidden-kolonner via
`display:none`-trick. Browser table-layout håndterer ikke responsive
`colSpan` af sig selv, så vi har eksplicit hidden filler-celler der
forsvinder på mobile men rumdeler på desktop.

---

## 4. Status

**Bekræftet af bruger efter første commit:**
- Hamburger-menuen "løste meget"
- Sankey "fungerer ikke skide godt på mobilen" → fixet i runde 2
- /Poster "skal man scrolle for at se" → fixet i runde 2

**Ikke testet endnu** (potentielle kandidater til samme behandling):
- `/budget` (samme tabel-pattern som poster)
- `/faste-udgifter/[accountId]` (recurring expenses med components)
- `/laan/[id]` (amortisationsprojektion - graf + tabel)
- `/overforsler` (transfers-liste, formentlig OK pga eksisterende
  responsive grids)
- Wizard-trin på mobile (multi-felt forms)

---

## Åbne tråde fra denne session

- **Tabel-mønster bør abstraheres**: PosterTable, BudgetTable,
  formentlig også laan-amortisationsprojektion vil alle have samme
  responsive-kolonne-behov. Når vi har fixet 2-3 tabeller manuelt,
  worth at kigge på en delt `<ResponsiveTable>`-komponent der
  parameteriserer hvilke kolonner skjules på mobile.
- **Dashboard 2-kolonne grids**: brydes pt på `lg:` (1024px). Tablet
  i portrait (768-1023px) får dem stacked, hvilket kan være OK eller
  spildt plads - test før justering.
- **Wizard på mobile**: ikke gennemgået. Forms med multi-column inputs
  (lonkonto-paycheck-samples osv.) kan trænge til responsive layout-
  klasser.
- **Form-buttons stack**: nogle action-bars har "Annullér + Gem"-par i
  flex - check at de ikke overflow'er mobile viewport.

---

# Devlog — 6. maj 2026 (komplet 13-prompt sikkerhedsaudit)

Lang dag. Vi gennemførte alle 13 prompts fra projektlederens
sikkerheds-prompt-bibliotek (`fambud-security-prompts_3.md`) i én
session. Det er ikke "vi skrev nogle audits" - det er et formelt
gennemløb hvor hver prompt har sit eget rapport-afsnit i
[SECURITY_AUDITS.md](SECURITY_AUDITS.md), egen findings-tabel, og
eksplicit handling-liste. SECURITY_AUDITS.md er nu **2486 linjer**
og fungerer som primær compliance-artefakt hvis Fambud nogensinde
skal igennem due diligence.

Hvis du læser dette om 6 måneder fordi du har glemt detaljerne, eller
hvis nogen kigger med fra ekstern part: alt under er konkret og kan
verificeres mod git-historik + linkede filer.

---

## 1. Hvad blev testet (13 prompts)

| # | Tema | Hovedoutput |
| --- | --- | --- |
| 1 | Threat model | Pre-session (8 audit-runder før i dag) |
| 2 | Headers + transport | HSTS includeSubDomains, CSP udvidet med `object-src 'none'` + `upgrade-insecure-requests` |
| 3 | Cookies + sessions | proxy.ts matcher fixed (robots.txt + .well-known + monitoring) |
| 4 | RLS + database isolation | 72-test suite ([scripts/rls-test.ts](scripts/rls-test.ts)), 11 tabeller × 5 ops × 3 personas, alle PASS |
| 5 | Krypto + randomness | [migration 0054](supabase/migrations/0054_csprng_invite_codes.sql) — `random()` (LCG) → `gen_random_bytes()` (CSPRNG) |
| 6 | Authentication hardening | [lib/common-passwords.ts](lib/common-passwords.ts) — ~100 entries inkl. danske patterns |
| 7 | Atomicity + race conditions | `pushLoanToBudget` compensating delete pattern |
| 8 | IDOR + mass assignment | 70 Server Actions reviewed; "konventionel, ikke strukturel" omformulering efter projektleder-pushback |
| 9 | Email deliverability | DMARC/SPF/DKIM analyse; reset-mail context fund; support@fambud.dk-mailbox plan |
| 10 | GDPR compliance | Privatlivspolitik udvidet, signup-samtykke, breach response plan |
| 11 | Logging + monitoring | Sentry installeret + [migration 0055](supabase/migrations/0055_audit_log.sql) audit_log |
| 12 | CI/CD security gates | GitHub Actions + 6 custom Semgrep-regler + nightly headers-check |
| 13 | Responsible disclosure | [/security](app/security/page.tsx) public policy + 5 email-templates + runbook |

---

## 2. Hovedfund med severity

15 fund identificeret på tværs af de 13 prompts. Sorteret efter
severity, ikke kronologi.

### HIGH (5 fund — alle adresseret samme dag)

1. **Sentry tunnel-route 307 til /login** (Prompt 10 deploy)

   `proxy.ts` matchede `/monitoring`-path og redirected til login.
   Konsekvens: client-side Sentry-events fra udloggede brugere blev
   droppet (signup, glemt-kodeord, landing). **Fix**: matcher-eksklusion
   i [proxy.ts](proxy.ts).

2. **Signup mangler samtykke-link til privatlivspolitik** (Prompt 10)

   GDPR Art. 13 kræver informationspligt FØR data-indsamling. Vores
   signup-form havde ikke noget. **Fix**: én sætning over "Opret
   konto"-knappen i [app/signup/page.tsx](app/signup/page.tsx).

3. **Right to portability ikke implementeret** (Prompt 10)

   Privatlivspolitik lover JSON-eksport via email. Lovligt under
   GDPR Art. 20 men skalerer ikke. **Status**: nedjusteret til MEDIUM
   efter scope-vurdering, tracket som **P9** med Q3-deadline.

4. **Ingen breach detection / monitoring** (Prompt 10 + 11)

   Vi havde ingen Sentry, ingen log-aggregation, ingen alerting.
   GDPR Art. 33's 72-timers-notifikation kunne ikke garanteres.
   **Fix**: Sentry installeret + 3 alerts opsat manuelt af bruger
   + breach response plan dokumenteret.

5. **DMARC `p=none` uden `rua=`** (Prompt 9)

   Compliance theater - vi signalerer at vi forventer rapporter
   men modtager ingen. **Fix-plan**: rua-record til dmarcian
   (manuel deploy hos one.com), ramp-up over 6 uger til `p=reject;
   pct=100` (slutmål 2026-06-23). 5 kalender-reminders. Tracked som
   **P7**.

### MEDIUM (8 fund)

6. **CSPRNG på invite-codes** (Prompt 5) — `random()` → `gen_random_bytes()`. Fixed via migration 0054.

7. **Atomicity i `pushLoanToBudget`** (Prompt 7) — components-INSERT
   kunne fejle og efterlade orphan transaction. Fix: compensating
   delete.

8. **Privatlivspolitik mangler retsgrundlag + opbevaringsperioder**
   (Prompt 10) — Fixed: ny "Retsgrundlag og opbevaring"-sektion med
   7-rækkers tabel + 5-rækkers opbevarings-liste.

9. **Resend mangler i sub-processor-liste** (Prompt 10) — Fixed.

10. **DPA-links i privatlivspolitik** (Prompt 10) — Fixed: links til
    Supabase, Vercel, Resend; dokumenteret-note for one.com og DAWA.

11. **Reset-password email mangler kontekst** (Prompt 9) — Phishing
    kan kopiere 1:1. **Fix-plan**: P6 custom reset-mail med IP +
    tidsstempel + User-Agent (4-6t), defereret indtil P7's resultater
    viser om det er nødvendigt.

12. **Sentry geo-PII slipper igennem PII-redaction** (Prompt 10
    runde 2)

    "Harlev, Denmark" dukkede op i Contexts → User → Geography i
    test-event. Sentry's ingest-server udleder geo fra request-IP
    EFTER vores `beforeSend` har kørt. **Fix**: `delete event.user.geo`
    i [lib/sentry-scrub.ts](lib/sentry-scrub.ts) + bruger toggler
    "Prevent Storing of IP Addresses" i Sentry Dashboard.

13. **Vercel global edge ≠ "alt i Frankfurt"** (Prompt 10)

    Privatlivspolitik lovede mere end vi kunne holde. **Fix**:
    politik-omformulering der eksplicit nævner edge-funktioner kan
    køre globalt (men persisterer ikke). P11 hvis Vercel-plan
    opgraderes til Pro+ kan vi tilføje `vercel.json: {"regions":
    ["fra1"]}` og rulle politikken tilbage.

### LOW (2 fund)

14. **DKIM key er 1024-bit RSA** (Prompt 9) — Resend's standard. NIST
    anbefaler 2048-bit. Verificeret acceptable for nu fordi
    quantum-trusler er år ude og attack-cost er $10-100k via cloud
    GPU-clusters.

15. **HIBP password-validering ikke implementeret** (Prompt 6) — In-app
    blocklist på ~100 entries dækker low-hanging fruit. HIBP er
    udvidelsen. Tracket som **P2** med Q3-deadline.

### Blind spots / kendte issues

- **RLS-denials returnerer 0 rows, ikke errors** (Prompt 11) — Sentry
  ser ikke noget. Mitigerende: app-laget filtrerer altid på
  `id + household_id`, så normal-trafik rammer ikke RLS-deny-path.
  Tracked som **P17**.

- **Edge runtime Sentry ikke verificeret end-to-end** (Prompt 11) -
  konfigureret via [sentry.edge.config.ts](sentry.edge.config.ts) men
  proxy.ts kaster ikke errors i normal drift. Tracked som **P18**.

---

## 3. Hvad blev fixet i dag vs. deferreret

### Fixet i dag (kode commits)

| Commit | Hvad |
| --- | --- |
| `2c7baf4` | Prompt 5-10 batch + Sentry monitoring + GDPR fix-runde |
| `e845bd9` | Sentry test-fixture (3 fejl-paths) |
| `f6818e0` | Sentry geo-PII strip i scrubPII |
| `fa0714d` | Slet Sentry test-fixture efter verifikation |
| `1b5f98d` | Prompt 11: audit_log + struktureret logging + security.txt |
| `f2e6263` | Prompt 11 (rev): full gap-analyse + Sentry-check |
| `10d6f14` | Prompt 12: CI/CD security gates + 6 custom Semgrep-regler |
| `7771eaa` | Prompt 13: responsible disclosure-proces + /security-side |

### Deferreret med begrundelse

24 P-items i roadmap. Ikke alle af samme grund:

- **P1** (soft delete på finansielle tabeller): MEDIUM, Q2-deadline.
  GDPR-paradoks: right-to-erasure er nemmere på soft-delete-by-default
  end retro-fitted. Defereret til før vi har 50+ brugere.

- **P6** (custom reset-mail): MEDIUM, Q4-deadline. Værdi-overlap med
  P7 — hvis DMARC `p=reject` virker uden phishing-rapporter i 6 uger,
  kan P6 muligvis nedprioriteres til LOW.

- **P9** (data-export): MEDIUM. Manuel håndtering compliant ved lav
  brugervolumen; trigger ved 50+ brugere ELLER første portability-
  anmodning.

- **P19-P21** (OWASP ZAP, smoke tests, nightly RLS-tests i CI):
  kræver enten eksternt account, test-runner-setup, eller dedikeret
  test-Supabase-instans. Defereret indtil næste audit-runde har tid
  til at sætte det op.

Resten af deferrals har eksplicit dato + trigger i SECURITY_AUDITS.md.

---

## 4. Roadmap-overblik (24 P-items kategoriseret)

### Compliance / GDPR (5 items)

- **P1** Soft delete på finansielle tabeller (MEDIUM, 30. juni 2026)
- **P9** Self-service data-export Art. 20 (MEDIUM, 30. september 2026)
- **P12** Privatlivspolitik retsgrundlag + opbevaring (MEDIUM, ✅ DONE 2026-05-05)
- **P13** DPA-links (MEDIUM, ✅ DONE 2026-05-05)
- **P23** English version af /security (LOW, defensiv)

### Monitoring / observability (4 items)

- **P10** Udvidet Sentry runbook + audit-log tabel (LOW, 30. september 2026)
- **P15** Member-removal audit-log (HIGH, 31. maj 2026)
- **P16** Financial-events via DB-triggers (MEDIUM, 30. juni 2026)
- **P17** RLS-denial detection via 0-rows-helper (HIGH→MEDIUM, 31. maj 2026)

### Email / DMARC (3 items)

- **P6** Custom reset-mail med IP + tidsstempel (MEDIUM, 31. december 2026)
- **P7** DMARC ramp-up til `p=reject` (MEDIUM, 5 milepæle: 19. maj → 23. juni 2026)
- **P8** Officiel `support@fambud.dk` (MEDIUM trin 1: i dag, trin 2: 30. juni)

### Security automation (4 items)

- **P5** Lint-rule for Server Action-pattern (LOW, ✅ DONE via Semgrep i Prompt 12)
- **P19** OWASP ZAP baseline scan (LOW, 30. juni 2026)
- **P20** Test-runner + smoke tests (LOW, 30. september 2026)
- **P21** Nightly RLS-test-suite i CI (LOW, 30. juni 2026)

### Authentication / passwords (3 items)

- **P2** HaveIBeenPwned password-validering (LOW, 30. september 2026)
- **P3** Multi-device session UI (LOW, ingen hard deadline)
- **P22** Husky/lint-staged pre-commit (LOW, 1t arbejde)

### Infrastructure (4 items)

- **P4** HSTS preload submission (LOW, 13. maj 2026)
- **P11** Vercel region-pin formaliseret (LOW, ingen hard deadline)
- **P14** Audit-log retention via pg_cron (LOW, 30. september 2026)
- **P18** Edge runtime Sentry verifikation (LOW, defensiv)

### Stretch (1 item)

- **P24** Hall of Fame-sektion på /security (defensiv, ingen
  deadline)

---

## 5. Compliance-status

### GDPR

| Artikel | Krav | Status |
| --- | --- | --- |
| Art. 5(1)(f) | Integritet og fortrolighed | 🟢 RLS + audit_log + Sentry monitoring |
| Art. 6 | Retsgrundlag | 🟢 Dokumenteret i privatlivspolitik (kontrakt + legitime interesser) |
| Art. 13 | Informationspligt | 🟢 Privatlivspolitik + signup samtykke-link |
| Art. 15 | Right to access | 🟢 Bruger ser al egen data i appen |
| Art. 16 | Right to rectification | 🟢 Alle felter redigerbare i UI |
| Art. 17 | Right to erasure | 🟢 `deleteMyAccount` med email-bekræftelse |
| Art. 20 | Right to portability | 🟡 Manuel via email; P9 self-service Q3 |
| Art. 28 | Sub-processors + DPA | 🟢 5 listet med DPA-links eller dokumenteret-note |
| Art. 32 | Sikkerhed af behandling | 🟢 TLS 1.3, AES-256-at-rest, RLS, audit-log |
| Art. 33 | Breach notification | 🟢 Sentry monitoring + 6-trins runbook + Datatilsynet-kontakt |
| Art. 34 | Bruger-notifikation ved breach | 🟡 Plan dokumenteret, ikke testet |

### Breach detection (Art. 33's "becoming aware")

- Sentry alerts på unhandled errors + 401/403-spike + 500-spike
- audit_log-tabel med struktureret event-log af alle auth-events
- 72-timers-procedure dokumenteret i SECURITY_AUDITS.md
- Datatilsynet-kontaktinfo: <dt@datatilsynet.dk> / +45 33 19 32 00

### Audit log

- Migration 0055 (skal kørs manuelt i Supabase Dashboard)
- 14 event-typer dækket i v1 (login, signup, password-reset, invite-
  redemption, account-deletion)
- PII-redaction via shared `redactPII()` + `hashEmail()`
- Append-only via service-role; auth'd brugere har INGEN read/write
- Retention: 365 dage anbefalet, manuel cleanup-query dokumenteret

---

## 6. Architectural strengths bekræftet

Audits bekræftede flere designvalg som var taget tidligere:

- **bigint-øre integer-cents** for finansielle beløb. Ingen
  float-precision-issues. Verifikation i Prompt 4 + 7.

- **Server Actions + FormData** som ene API-overflade. Ingen `/api/*`-
  endpoints, ingen JSON body parsing, ingen ORM auto-binding. Strukturelt
  immun mod mass-assignment-klassen — **men** vi nedjusterede sproget
  til "konventionelt, ikke strukturelt" efter projektleder-pushback,
  fordi det afhænger af at hver fremtidig udvikler følger
  `formData.get('field')`-mønstret. P5 lint-rule (nu i Semgrep)
  håndhæver det automatisk.

- **Defense-in-depth IDOR-resistance** (Prompt 8): app-lag filtrerer
  altid på `household_id` (server-bestemt), DB-lag har RLS, og
  schema-lag har guard triggers (mig 0046+) der blokerer privilegerede
  felt-skift. Tre uafhængige forsvarslinjer. En angriber skal bryde
  alle tre samtidig.

- **PKCE-binding på password-reset** (Prompt 9): reset-link er bundet
  til klientens `code_verifier`-cookie. En angriber der stjæler
  email-link kan ikke bruge det fra anden browser. Device-bundet by
  design.

- **Email-enumeration protection**: `requestPasswordReset` viser ALTID
  success-skærmen uanset om email findes. `signUp` re-router
  "User already registered" til check-email-skærmen frem for
  dedikeret fejl. Verificeret i Prompt 6.

- **Null MX på fambud.dk root** (RFC 7505): root-domænet accepterer
  ikke email. Forhindrer bounces til ikke-eksisterende
  `support@fambud.dk` osv. Verificeret i Prompt 9.

---

## 7. Læringspunkter fra processen

### 7.1 Verifikation efter deploy er ikke valgfrit

Vores første curl-test mod prod (Prompt 9) afslørede at deployed CSP
**manglede** `object-src 'none'` + `upgrade-insecure-requests` og HSTS
**manglede** `includeSubDomains` — alle Prompt 2-ændringer var commit'et,
men deployet var fra før Prompt 2. Vi havde tænkt "code = deployed",
det er ikke sandt.

Tilsvarende: Sentry tunnel-route returnerede 307 til /login efter
deploy fordi `proxy.ts` matcher inkluderede `/monitoring`. Det fix var
trivielt, men det havde forblevet skjult uden curl-verifikation.

Headers-check er nu automatiseret nightly via [scripts/check-headers.sh](scripts/check-headers.sh) + GitHub Actions.

### 7.2 "Strukturelt immun" er for stærkt et ord

Prompt 8 oprindelig konklusion var "Fambud's Server Actions er
strukturelt immun mod mass assignment". Projektleder pushed back:

> "Strukturelt immun" er en farlig formulering. Auditten verificerer
> at de actions Claude Code kiggede på er sikre. Den verificerer ikke
> at alle actions er sikre, fordi det er code review, ikke automatiseret
> bevis. Mass assignment-immuniteten er ikke strukturel — den er
> konventionel.

Han havde ret. Vi nedjusterede sproget og tilføjede **P5 lint-rule** der
faktisk håndhæver mønstret. Lærdom: hver gang vi siger "by design" eller
"strukturelt", spørg om der er en regel der enforcer det, eller om det
er "vi har konsekvent gjort det sådan indtil nu".

### 7.3 Sample testing vs end-to-end verifikation

Sentry-installation virkede ikke umiddelbart end-to-end. Min curl-test
mod tunnel-routen returnerede 404 — jeg konkluderede "endpoint findes
ikke". Forkert: Sentry's tunnel-rewrite kræver specifikke query-params
(`?o=...&p=...`) for at matche. Uden dem er 404 by design (anti-ad-
blocker mønster).

End-to-end-verifikation kom først da brugeren manuelt triggede 3 fejl
via [/sentry-test](app/(app)/sentry-test/page.tsx)-fixture og så
events lande i Sentry Dashboard. Det afslørede også **geo-PII-lækage**
i FAMBUD-3 ("Harlev, Denmark") som scrubPII ikke fangede fordi Sentry's
ingest-server udleder geo server-side EFTER vores beforeSend har kørt.

Lærdom: API-tests verificerer interface; end-to-end verificerer adfærd.
Begge skal laves.

### 7.4 Defaults er ikke altid sikre

Sentry's default sender request-headers, body, cookies, IP, geo. Det
er fint for et open-source-projekt; det er en GDPR-compliance-fejl for
en finansiel app. `sendDefaultPii: false` + `beforeSend`-redaction +
"Prevent Storing of IP Addresses"-toggle i Dashboard krævedes alle tre
for at få en ren event.

Resend's default DKIM-key er 1024-bit RSA. Acceptable nu, ikke ideelt.

Vercel's default region-allokering er global edge — godt for performance,
forkert claim når vi lover "alt i Frankfurt" i privatlivspolitikken.

Lærdom: defaults er optimeret til developer experience, ikke til
compliance. Verificér hver default mod jeres trusselsmodel.

### 7.5 OneDrive + Windows + node_modules-write race

Midt i Prompt 11 commit-prep opdagede jeg at `lib/database.types.ts`
var **0 bytes** (566 linjer slettet, intet tilføjet). Filen var skrevet
af Supabase types-gen tidligere, og noget havde trunked den. Jeg ved
ikke hvad — npm install, OneDrive sync, Windows Defender, en Sentry-
post-install-hook. `git restore` reddede den.

Lærdom: kør `git diff` før hver commit, særligt på filer du ikke
direkte har ændret. På Windows + OneDrive + node_modules er der ekstra
attack surface for filsystem-races.

### 7.6 Roadmap-deferrals skal have triggers, ikke "senere"

Tre gange i denne audit pushed projektlederen tilbage på vagt-deferrals:

1. Prompt 6: "common-password blocklist deferret indtil 100+ brugere"
   → vi var enige om at det var løst på 60 min nu, det blev impementeret.

2. Prompt 7: "soft-delete deferret indtil vi har tid"
   → omformuleret til konkret deadline + trigger.

3. Prompt 8: "lint-rule deferret defensivt"
   → bibeholdt deferral men med konkret trigger (25% kodebasevækst eller
   ekstern bidragyder) + Q3 deadline.

Lærdom: vagt-deferrals er bare uorganiseret backlog. P-items skal have
**trigger** (eksternt event) + **deadline** (dato). Ellers driver
processen.

### 7.7 Ikke alt skal automatiseres

Vi defererede **OWASP ZAP** (P19), **smoke tests** (P20), og **nightly
RLS-tests i CI** (P21). De er alle "best practice" men kræver
infrastruktur (test-runner, ZAP-image, dedikeret Supabase-instans) der
ikke er proportional til Fambud's nuværende størrelse.

Lærdom: enhver automation har vedligeholdelsesomkostning. For en
1-developer pre-launch app er manuel test + rigorøst code review +
basal CI mere bæredygtig end fuld DevSecOps.

---

## 8. Honest assessment — hvor står Fambud?

**Sammenlignet med en typisk dansk solo-built side-project**: betydeligt
foran. De fleste sammenlignelige apps har ingen privatlivspolitik
udover en Notion-side, ingen audit-log, ingen monitoring, ingen
breach-plan, ingen security.txt. Vi har alle fem.

**Sammenlignet med etablerede SaaS-produkter** (Mint, YNAB, Spiir):
bagud på flere fronter:

- **Penetration testing**: vi har ikke haft en ekstern pen-tester
  igennem. Hele auditten er code review + automatiseret scanning. Det
  fanger lots, men ikke f.eks. business-logic-fejl der kun synes ved
  længere session-flow-testning.

- **Test coverage**: ingen automatiserede tests. Manuel verifikation +
  TypeScript strict + Semgrep har dækket os indtil nu, men en bruger-
  base på flere hundrede vil afsløre regressions vi ikke ser.

- **Bug bounty**: vi tilbyder anerkendelse, ikke penge. Det er rimeligt
  for en pre-launch app, men det begrænser pulken af researchers der
  kigger.

- **SOC 2 / ISO 27001**: ikke certificeret. Ikke relevant for vores
  størrelse, men noget en B2B-version på sigt skal forholde sig til.

**Specifikke styrker**:

- **GDPR-dokumentation**: bedre end de fleste danske startups jeg har
  set. Privatlivspolitik er læselig, retsgrundlag er eksplicit,
  opbevaringsperioder er pr. kategori, sub-processors med DPA-links.

- **Audit trail**: append-only audit_log + Sentry monitoring +
  breach response plan giver os realistisk Art. 33-compliance fra
  dag ét. Mange apps bygger det først efter første reelle breach.

- **Defense-in-depth**: tre uafhængige forsvarslinjer (app-lag,
  RLS, guard triggers) er ikke standard for solo-builds. Det er et
  bevidst design-valg vi traf tidligt.

**Specifikke svagheder**:

- **Vercel-tier**: vi er på Hobby. Det betyder ingen region-pin (P11),
  ingen lange function-logs, ingen dedikerede preview-URL'er for
  enterprise-tests.

- **Single-developer bus factor**: hvis Mikkel rammes af en bus i morgen,
  er der ingen runbook for hvordan en anden person tager over. Det
  gælder ikke kun security men hele projektet.

- **Ingen real attackere har testet**: vores RLS-test-suite er sketsom -
  72 tests, alle bestod, men det er hånd-skrevne tests. En ekstern
  red-team-runde vil sandsynligvis afsløre noget.

**Bottom line**: for **pre-launch testbruger-fasen** er Fambud betydeligt
sikrere end gennemsnits-dansk-app i samme livscyklus. For **vækst-fasen
til 1000+ brugere** er der 24 P-items der skal håndteres, og en
ekstern penetration test bør indplaneres når vi er ude af inner-circle-
testning.

Vi kan stå inde for Fambud's nuværende sikkerhed overfor en bruger,
en investor, eller Datatilsynet — men ikke uden at samtidig pege på
roadmappen og sige "her er hvad vi mangler, og her er hvornår det
kommer."

---

## 9. Status

- **Prompts gennemført**: 13/13 (alle PASS)
- **Critical fund åbne**: 0
- **HIGH fund**: 5 identificeret, 4 fixet, 1 mitigeret med plan
- **MEDIUM fund**: 8 identificeret, 6 fixet, 2 deferreret med konkret deadline
- **LOW fund**: 2 identificeret, 1 deferreret, 1 verificeret acceptable
- **P-items i roadmap**: 24, alle med deadline + trigger
- **Linjer i SECURITY_AUDITS.md**: 2486
- **Migrations til prod**: 0054 (CSPRNG) + 0055 (audit_log) — sidstnævnte
  skal køres manuelt
- **Commits i dag**: 8 (`2c7baf4` → `7771eaa`)
- **GitHub Actions workflows**: 2 (security.yml + headers-check.yml)
- **Custom Semgrep-regler**: 6
- **Sentry alerts**: 3 manuelt opsat
- **`npm audit`**: 0 vulnerabilities
- **`npx tsc --noEmit`**: 0 errors
- **`npm run build`**: clean

Klar til at åbne for testbrugere ud over inner circle. P15, P17 (HIGH-
items) bør være afsluttet inden første eksterne testbruger.
