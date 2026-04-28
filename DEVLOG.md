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
