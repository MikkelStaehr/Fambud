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
