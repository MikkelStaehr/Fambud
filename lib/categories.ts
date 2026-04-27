// Standard expense categories auto-created the first time a user enters
// /budget. The colours are picked to be distinguishable on small dots in
// transaction lists. Users can still create custom categories via
// /indstillinger if these don't fit.
//
// The list mixes "shared-context" categories (Bolig, Forsyning, …) and
// "private-context" categories (Træning, A-kasse, Privat forsikring, …).
// The /budget step uses PRIVATE_ONLY_CATEGORY_NAMES below to hide the
// private ones from shared accounts (Budgetkonto, Husholdningskonto) —
// those would feel out of place in a "fælles husleje"-context.
export const STANDARD_EXPENSE_CATEGORIES = [
  // Shared/fixed-expense categories
  { name: 'Bolig',             color: '#7c3aed' }, // husleje, ejendomsskat
  { name: 'Forsyning',         color: '#0891b2' }, // el, vand, varme, internet, TV
  { name: 'Forsikring',        color: '#dc2626' }, // bil, indbo, hus, ulykke
  { name: 'Lån',               color: '#ea580c' }, // realkredit, billån
  { name: 'Abonnement',        color: '#9333ea' }, // software, fitness, news
  { name: 'Medie',             color: '#f43f5e' }, // streaming, TV-pakker, aviser, podcasts
  { name: 'Transport',         color: '#2563eb' }, // benzin, månedskort
  { name: 'Bil',               color: '#475569' }, // service, vægtafgift, syn, dæk
  { name: 'Institution',       color: '#eab308' }, // børnehave, SFO, daginstitution
  { name: 'Mad',               color: '#16a34a' }, // dagligvarer, restaurant
  // Private-context categories — typically only relevant on a personal account
  { name: 'A-kasse & Fagforening', color: '#0ea5e9' }, // bundlet kontingent
  { name: 'Privat forsikring',     color: '#b91c1c' }, // ulykke, liv, sundhed
  { name: 'Træning',           color: '#be185d' }, // fitness, klub, holdsport
  { name: 'Frisør',            color: '#c026d3' }, // klip, hårpleje
  { name: 'Tøj',               color: '#db2777' }, // beklædning
  { name: 'Hobby',             color: '#ca8a04' }, // udstyr, materialer
  { name: 'Personlig pleje',   color: '#0d9488' }, // kosmetik, sundhed
  // Catch-all
  { name: 'Andet',             color: '#64748b' },
] as const;

// Categories we hide from shared-account dropdowns (Budgetkonto,
// Husholdningskonto). They stay in the database — Mikkel's Træning-udgift
// shouldn't disappear if he later shares a Budgetkonto with someone else —
// they just don't show up in the picker for shared contexts.
export const PRIVATE_ONLY_CATEGORY_NAMES: ReadonlySet<string> = new Set([
  'A-kasse & Fagforening',
  'Privat forsikring',
  'Træning',
  'Frisør',
  'Tøj',
  'Hobby',
  'Personlig pleje',
]);
