# Plan → budget: skridt bliver til planlagt udgift

**Status:** forslag, ikke implementeret. Bygger på migration 0072 (`plan`-schema).

## Mål

Et skridt med `amount` + `month` kan sendes til budgettet og bliver en
engangsudgift i Fambud: en række i `public.transactions` med
`recurrence = 'once'` og `occurs_on = month`. Så dukker den op i cashflow,
kommende udgifter osv. uden ny logik i Fambud.

## Link: ligger i plan, ikke i public

Ny kolonne i en senere migration:

```sql
alter table plan.steps
  add column transaction_id uuid references public.transactions(id) on delete set null;
```

- `public` forbliver urørt. Slettes posten i Fambud, mister skridtet bare linket.
- Samme idé som `transfers.life_event_id` (0059), bare med linket på plan-siden.
- En sammensat FK (samme husstand) ville kræve en unique-constraint på
  `public.transactions`. I stedet validerer RPC'en. Et forkert link sat
  direkte kan ikke bruges til noget, fordi RLS på `transactions` stadig skjuler
  fremmede poster.

## RPC: `plan.schedule_step`

```sql
create function plan.schedule_step(
  p_step_id uuid,
  p_account_id uuid,
  p_category_id uuid default null
) returns uuid              -- id på den oprettede transaction
language plpgsql
security invoker            -- bevidst, se nedenfor
set search_path = ''
```

Flow:

1. Afvis hvis `auth.uid() is null` (service_role/admin-client ville ellers
   køre uden RLS).
2. `select ... from plan.steps s join plan.projects p ... where s.id = p_step_id for update`.
   RLS begrænser til egen husstand. Ikke fundet → fejl.
3. Kræv `amount` og `month` sat. Er `transaction_id` allerede sat, returnér
   det (idempotent ved dobbeltklik).
4. `insert into public.transactions (household_id, account_id, category_id, amount, description, occurs_on, recurrence)`
   med `s.household_id`, `s.amount`, `p.title || ': ' || s.title`, `s.month`, `'once'`.
5. `update plan.steps set transaction_id = <ny id>`.
6. `revoke all ... from public, anon; grant execute ... to authenticated`.

**Hvorfor `security invoker`:** insert'en går gennem præcis de samme regler
som en almindelig post: `can_write_account` + private konti (0030/0069) og
konsistens-triggers for konto/kategori i samme husstand (0045/0047). Med
`security definer` skulle vi genimplementere alt det manuelt.

## funding_source → konto

| funding_source | Hvad oprettes                                           | Version |
|----------------|---------------------------------------------------------|---------|
| `overskud`     | Én udgift på fælles budget-/lønkonto i `month`          | v1      |
| `opsparing`    | Én udgift fra opsparingskontoen i `month`               | v1      |
| `spare_op`     | Månedlig overførsel frem til `month` + udgift i `month` | v2      |

UI'et foreslår konto ud fra `funding_source`, men RPC'en tager `account_id`
eksplicit og gætter ikke. `spare_op` er i praksis begivenheds-modellen
(`life_events` + `transfers.life_event_id`). Før v2 bør vi afgøre om et
projekt med spare-op-skridt skal linke til en `life_event` i stedet for at
duplikere den logik.

## Når skridtet ændres bagefter

- v1: ingen to-vejs-sync. Har skridtet `transaction_id`, låser UI'et
  `amount`/`month` og tilbyder "Fjern fra budget" (`plan.unschedule_step`:
  slet posten, nulstil linket) og planlæg igen.
- Slettes skridtet, bliver posten i Fambud stående. Budgettet må ikke ændre
  sig uden at brugeren ser det.

## App-lag

- Kald med user-client: `supabase.schema('plan').rpc('schedule_step', ...)`,
  efterfulgt af `revalidateCashflowPaths()` (CLAUDE.md §6).
- Proxy-mode understøttes ikke i v1 (admin-client afvises i trin 1).
- `db:types` skal udvides med `--schema plan`, når UI'et bygges.
