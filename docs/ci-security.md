# CI/CD security gates

Dokumenterer hvad der køres automatisk på hver PR + push, hvordan man
fixer fejl, og hvilke gates der kræver manuel branch-protection-konfig
på GitHub-siden.

Reference: [SECURITY_AUDITS.md](../SECURITY_AUDITS.md) Prompt 12.

## Workflows

### `.github/workflows/security.yml`

Kører på hver PR mod main + push til main + manuel trigger.

| Job | Hvad | Fail-betingelse |
| --- | --- | --- |
| `gitleaks` | Scanner git-historik for committede secrets (API-keys, JWTs, private keys) | Hvis nogen secret findes |
| `dependencies` | npm audit (high+critical) + OSV-Scanner | Hvis nogen vulnerability findes |
| `typecheck-and-build` | `npx tsc --noEmit` + `npm run build` | TS-error eller build-fejl |
| `semgrep` | OWASP Top 10 + Next.js + TypeScript + JavaScript + custom regler | Hvis nogen ERROR-severity match |

**Concurrency**: kun én run per branch — nye pushes cancellerer ældre kørsler.

### `.github/workflows/headers-check.yml`

Kører nightly (06:00 CEST), efter push til main, og on-demand. Verificerer
at production-deploy serverer alle required security headers via
[scripts/check-headers.sh](../scripts/check-headers.sh).

| Header | Forventet |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`, `form-action 'self'`, `base-uri 'self'` |
| `Strict-Transport-Security` | `max-age=...; includeSubDomains` (preload defereret til P4) |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=()`, `microphone=()`, `geolocation=()` |
| `X-Powered-By` | **fraværende** (info-disclosure) |

## Configs

### `.gitleaks.toml`

Allowlister kendte safe patterns (Supabase publishable key, lock-files,
auto-genererede types). Tilføj nye false-positives som `regexes` eller
`paths`-entries — IKKE som global disable.

### `semgrep-rules/fambud.yaml`

Custom regler oven på standard-regelsæt. Håndhæver mønstre dokumenteret
i SECURITY_AUDITS.md som "konvention, ikke automatisk håndhævet":

| Regel | Severity | Hvad |
| --- | --- | --- |
| `fambud-no-admin-client-import` | ERROR | `createAdminClient` må ikke imports'es i `_components/` eller `*.client.tsx` (bundles til klient + lækker service-role-key) |
| `fambud-no-form-data-spread` | ERROR | `Object.fromEntries(formData)` bypasser eksplicit field-whitelist (P8 IDOR) |
| `fambud-no-privileged-field-from-formdata` | ERROR | `formData.get('household_id'\|'user_id'\|'role'\|...)` — privilegerede felter må kun komme server-side |
| `fambud-no-zod-passthrough` | ERROR | `.passthrough()` på Zod schema fjerner whitelist-effekt (P5) |
| `fambud-no-pii-console-log` | WARNING | `console.log` af user-objekter eller email/password (PII-leak til Vercel logs) |
| `fambud-dangerously-set-inner-html` | WARNING | `dangerouslySetInnerHTML` skal verificeres for ikke at indeholde user-input (XSS) |
| `fambud-no-em-dash` | ERROR | Em-dash (—) i `app/**/*.{tsx,ts}` eller `lib/**/*.{tsx,ts}` — AI-fingeraftryk i copy. Se [CLAUDE.md](../CLAUDE.md) for begrundelse. |

Test reglerne lokalt:

```sh
semgrep scan --config=./semgrep-rules/fambud.yaml app/
```

### `.github/dependabot.yml`

Ugentlige PR'er (mandag morgen):

- npm minor + patch updates bundlet til én PR
- npm major updates som separate PR'er (kræver manuel review)
- GitHub Actions versioner

Maks 5 åbne npm-PR'er + 3 GH-Actions-PR'er ad gangen.

## Branch protection (manuel konfig på GitHub)

Følgende skal sættes i GitHub → Settings → Branches → main → Edit rule:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required checks (alle fra security.yml):
    - `Secret scan (gitleaks)`
    - `Dependency CVEs`
    - `TypeScript + build`
    - `Static analysis (semgrep)`
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings**
- [ ] **Allow force pushes** — UNCHECKED
- [ ] **Allow deletions** — UNCHECKED

**Vigtigt**: branch protection er på GitHub-side, ikke i koden. Det er
en eksplicit manuel konfig der skal repeteres hvis vi nogensinde
sletter og genopretter main, eller skifter til en anden default branch.

## Vercel-side automation (allerede aktivt)

Vercel har sin egen build-validation der vi ikke skal duplikere:

- [x] **Build fails på TypeScript errors** — verificeret 2026-05-06,
      `npm run build` fejler pages med type-errors
- [x] **Preview deployments per PR** — automatisk; vi kan teste mod
      preview-URL før merge
- [x] **Source-map upload til Sentry** — via `withSentryConfig` i
      `next.config.ts` (kun ved Vercel-build hvor `SENTRY_AUTH_TOKEN`
      er sat)

## Hvad vi IKKE har (og hvorfor)

| Manglende | Begrundelse |
| --- | --- |
| Snyk | Eksternt account + fri-tier-loft. OSV-Scanner dækker overlappet uden friction. |
| OWASP ZAP baseline scan | Komplekst at integrere mod Vercel preview-URL. P-item hvis brugerbase vokser. |
| Pre-commit hooks (husky) | Ekstra dev-dep + udviklerne skal manuelt installere; CI-checks fanger det samme. |
| Smoke tests af auth-flows | Kræver test-runner setup (Playwright/Vitest). Tracket som P-item. |
| Test coverage på security-modules | Vi har ingen test-suite endnu. Kommer med smoke tests. |

## Sådan kører du checks lokalt

```sh
# Type-check
npx tsc --noEmit

# Build (matches CI)
npm run build

# Audit
npm audit --audit-level=high

# Headers (kræver deployed prod)
bash scripts/check-headers.sh https://www.fambud.dk

# Semgrep custom rules (kræver semgrep installeret: pip install semgrep)
semgrep scan --config=./semgrep-rules/fambud.yaml app/

# RLS-tests (kræver test-brugere fra scripts/setup-test-users.sql)
npx tsx scripts/rls-test.ts
```
