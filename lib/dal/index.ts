// Barrel-export af hele DAL'en. Bevarer bagudkompatibilitet med callers
// der importerer fra `@/lib/dal` (Next.js-resolveren finder denne fil
// automatisk når mappen tilgås uden filsuffiks).
//
// Modul-opdelingen blev introduceret efter at `lib/dal.ts` voksede til
// 1232 linjer og blandede 7-8 funktionelle domæner. Hver modul-fil holder
// sig under ~300 linjer og dækker ét konceptuelt område. Auth er fælles
// fundament; resten importerer kun fra `./auth`.
//
// Hvis en helper hører i flere domæner: placer den hvor dens consumers
// oftest leder efter den. fx getAccountFlows ligger i accounts.ts (selvom
// den læser transactions+transfers) fordi /konti er den primære consumer.

export * from './auth';
export * from './family';
export * from './categories';
export * from './accounts';
export * from './transactions';
export * from './transfers';
export * from './cashflow';
export * from './dashboard';
export * from './advisor';
export * from './expenses-by-category';
export * from './upcoming-events';
export * from './income';
export * from './loans';
export * from './life-events';
export * from './predictable';
