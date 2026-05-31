# RLS-baseret proxy: design-dokument

**Status:** DRAFT - ikke implementeret. Kandidat til focuseret session efter
v2.1-stabiliseringen.

**Motivation:** v1.5-v2.1 implementerede setup-proxy via app-layer-bypass
(admin-client + manuel `privateAccountFilter`). Det virker, men har kendte
risici:

- Forglemt manuel filter = cross-perspective data-leak (mitigeret via
  Semgrep-regel `fambud-admin-client-needs-household-filter`, men kun WARNING)
- Admin-client bruger SUPABASE_SERVICE_ROLE_KEY der bypasser RLS - "defense
  in depth" går tabt
- DAL har dobbelt-mønster: getPerspective() returnerer enten user-client
  eller admin-client baseret på cookie, og caller skal vide hvad de gør

Mål: flyt access-control til DB-niveau via RLS, så user-client virker i
proxy-mode uden bypass. Cookie reduceres til UI-mode-toggle.

## Den naive migration (utilstrækkelig)

```sql
-- 0068_proxy_aware_account_permissions.sql (DRAFT - virker ikke alene)

-- Udvid can_write_account til at honorere active proxy
create or replace function public.can_write_account(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts a
    where a.id = account_id
      and public.is_household_member(a.household_id)
      and (
        a.editable_by_all
        or a.created_by = auth.uid()
        or public.has_active_proxy(a.created_by, auth.uid(), 'setup')
      )
  );
$$;

-- Udvid accounts SELECT
drop policy if exists "private-aware read accounts" on accounts;
create policy "private-aware read accounts"
  on accounts for select
  using (
    public.is_household_member(household_id)
    and (
      editable_by_all
      or created_by = auth.uid()
      or public.has_active_proxy(created_by, auth.uid(), 'setup')
    )
  );

-- Tilsvarende for UPDATE og DELETE på accounts (kopier policy med
-- proxy-clausen tilføjet i begge `using` og `with check`)
```

**Hvad virker:** Mikkel kan nu via almindelig auth-session (user-client)
læse OG skrive på Louises private konti sålænge en aktiv setup-grant
fra Louise til Mikkel eksisterer. admin-client behøves ikke længere.

**Hvad bryder:** Cookie-baseret UI-mode mister sin gating-effekt på data-
access. Nu hvor RLS altid lader Mikkel se Louises data under aktiv grant,
vil DAL-funktioner der bruger user-client returnere "union view" UANSET
om Mikkel har toggled proxy-mode i UI.

Eksempel-regression:
- Mikkel har aktiv grant, cookie OFF (normal-mode)
- /konti kalder getAccounts() → user-client query → RLS honorerer proxy
- Resultat: Mikkel ser Louises private konti i /konti uden at have toggled
- Han ser ikke ProxyBanner (ingen cookie) → forvirring

## Den fulde løsning

Tre adskilte ændringer skal til, ikke kun migration:

### Step 1: Migration som beskrevet ovenfor

Som-er. Tilføjer proxy-clausen til alle relevante RLS-policies.

### Step 2: DAL-laget filtrerer eksplicit baseret på cookie

`getPerspective()` returnerer altid user-client (ikke admin-client). DAL
applyer filter baseret på `isProxyActive` (cookie-state):

```ts
// lib/dal/accounts.ts (post-RLS-cutover)
export async function getAccounts() {
  const p = await getPerspective();
  let query = p.supabase
    .from('accounts')
    .select('*')
    .eq('household_id', p.householdId);

  if (!p.isProxyActive) {
    // Cookie OFF: tving "min view" - filtrer Louises data ud selv om
    // RLS ville have ladet dem gennem
    query = query.or(
      `editable_by_all.eq.true,created_by.eq.${p.authUserId}`
    );
  }
  // Cookie ON: ingen ekstra filter - RLS giver os union

  const { data } = await query;
  return data ?? [];
}
```

Bemærk: filteret er nu det MODSATTE af v1.5-mønsteret. I v1.5 tilføjede
vi filter for at INKLUDERE Louises data via admin-client. Post-cutover
tilføjer vi filter for at EKSKLUDERE den når cookie OFF.

### Step 3: Fjern admin-client fra getPerspective + alle DAL-filer

Når step 1+2 er kørt, kan vi:
- Fjerne `createAdminClient()`-kald fra getPerspective
- Fjerne `getVisibleAccountIds()` (RLS håndterer det)
- Fjerne `privateAccountFilter()` (eller behold som "exclude-partner"-form
  for cookie-OFF-mode)
- Slette `getActionPerspective`-helper (eller forenkle til just
  perspective-context uden supabase-swap)

DAL'er der skal røres: accounts, transactions, transfers, dashboard,
cashflow, income, advisor, economy-plan, expenses-by-category,
upcoming-events, life-events, loans. Plus 16+ server-actions.

## Trade-offs

**Pro:**
- Defense-in-depth: hvis app-layer filter glemmes, RLS afviser stadig
  cross-household-leak. Per-perspective-isolation kan dog brydes (UX-bug
  ikke security-leak)
- Single source of truth for access (DB)
- Mindre kode (færre wrapper-helpers)
- admin-client-import-rule fra CLAUDE.md sektion 4 bliver strammere
  håndhævet automatisk

**Con:**
- Migrationen er bigbang - inkonsistens hvis migration kører før app-
  deploy
- DAL skal stadig filtrere baseret på cookie (forskellen er bare hvilken
  retning filteret går)
- RLS-policy-evaluation er dyrere end app-layer filter (selvom
  `has_active_proxy()` er indexed på den underliggende tabel)
- Audit-log-mønstret skal tjekkes: hvis Mikkel læser Louises data via
  user-client+RLS, logger vi det ikke nødvendigvis som proxy-aktion

## Åbne spørgsmål

1. **Audit-logging af reads:** Skal vi tilføje en SQL-trigger der logger
   når `has_active_proxy()` returnerer true under en SELECT? Eller er
   write-only audit nok?

2. **Cookie semantik:** Skal vi beholde cookie-baseret toggle eller går
   vi til "always show partner data when grant active"? Det sidste er
   simplere men kan føles invaderende ("hver gang jeg åbner appen ser
   jeg min partners data").

3. **Migration-timing:** Skal vi køre migrationen som ZERO-downtime
   (først migration, så deploy), eller risikere kort vindue hvor app
   forventer admin-client men RLS allerede er udvidet?

4. **Test-strategi:** Manuel test af 5-6 flows i staging? Eller bygger
   vi automatiske integration-tests først (kræver Supabase-mock eller
   test-DB)?

5. **Backout-plan:** Hvis post-cutover viser en regression, hvor hurtigt
   kan vi rulle migration tilbage? Drop+recreate af policies er hurtigt
   men en mislykket migration midt under deploy er værre end nuværende.

## Effort-estimat

- Migration draft: 30 min (denne fil indeholder den)
- Migration test mod staging: 1 time
- DAL refactor (10+ filer): 2-3 timer
- Action refactor (16 filer): 1 time
- Cookie-semantik-beslutning: 30 min (kræver bruger-feedback)
- End-to-end test: 1-2 timer
- Documentation update (CLAUDE.md sektion 6 + DEVLOG): 30 min

Total: 6-8 timer focuseret arbejde. Bør tages som dedikeret session, ikke
incremental.

## Beslutning

DEFER til senere session. Det er en arkitektur-cutover, ikke en quick win.
Indtil da:
- admin-client + manuel filter er solid (CI Semgrep-håndhævet)
- Tests fanger mest farlige regressioner
- Vi kan håndtere yderligere proxy-features oven på nuværende model uden
  problem

Reference: DEVLOG 30.-31. maj 2026 (v2.0-v2.2-arbejdet).
