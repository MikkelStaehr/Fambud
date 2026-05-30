// Lille "AI hjælper" på dashboardet: analysér pr.-konto cashflow og find
// strukturelle problemer som brugeren bør løse manuelt. Det er IKKE en ML-
// model - bare en samling af pragmatiske regler om "hvis X er sandt, så er
// kontoen sandsynligvis sat forkert op". Reglerne lever her samlet så
// dashboardet og fremtidige steder (fx wizard-completion-tjek) kan dele dem.

import { formatAmount } from './format';
import type { Account } from './database.types';
import type { AccountCashflowDetail, AdvisorContext } from './dal';

export type CashflowIssue =
  | {
      type: 'deficit';
      account: Account;
      deficit: number; // positivt øre-beløb / md
      inflow: number;
      outflow: number;
      message: string;
      suggestion: string;
    }
  | {
      type: 'no-inflow';
      account: Account;
      outflow: number;
      message: string;
      suggestion: string;
    };

// Konkret forslag til hvordan en CashflowIssue kan løses: en månedlig
// overførsel fra en bestemt konto med et bestemt beløb. Adviser-kortet
// pre-udfylder /overforsler/ny med disse værdier så brugeren bare skal
// trykke "Opret".
//
// `share` indikerer om beløbet er hele underskuddet (personal) eller
// kun den indloggede brugers andel af et fælles-underskud. UI'et bruger
// den til at formulere forslaget korrekt ("din halvdel" vs "hele beløbet").
export type CashflowFix = {
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amountOere: number;
  share: 'full' | 'partial';
  totalDeficit: number;       // det samlede underskud (også når brugeren kun dækker en del)
  numContributors: number;    // hvor mange forventes at bidrage (1 for personlige konti)
};

// Find husstandens primære indkomst-konto. Heuristik:
//   1. Konto med højest income-flow (typisk Lønkonto)
//   2. Fallback til første ikke-arkiverede 'checking'-konto
//   3. Sidste fallback: enhver ikke-credit konto (undtagen destination'en)
//
// Vi ekskluderer destination-kontoen så forslaget ikke peger på sig selv.
export function findSuggestedSource(
  accounts: Account[],
  perAccount: Map<string, AccountCashflowDetail>,
  excludeId: string
): Account | null {
  const candidates = accounts.filter(
    (a) =>
      !a.archived &&
      a.id !== excludeId &&
      a.kind !== 'credit' &&
      a.kind !== 'savings' &&
      a.kind !== 'investment'
  );
  if (candidates.length === 0) return null;

  // 1. Sortér efter income-flow, største først
  const byIncome = [...candidates].sort((a, b) => {
    const ai = perAccount.get(a.id)?.income ?? 0;
    const bi = perAccount.get(b.id)?.income ?? 0;
    return bi - ai;
  });
  const top = byIncome[0];
  if ((perAccount.get(top.id)?.income ?? 0) > 0) return top;

  // 2. Hvis ingen har registreret indkomst endnu (fx tomt setup), foretræk
  //    en checking-konto
  const checking = candidates.find((a) => a.kind === 'checking');
  if (checking) return checking;

  // 3. Tag den første tilgængelige
  return candidates[0];
}

// Bygger en CashflowFix til en given issue ved at slå suggested source op.
//
// Hvis `ctx` er sat OG kontoen er fælles, fordeles underskuddet på antallet
// af bidragsydere. Den indloggede brugers eksisterende bidrag (transfers fra
// konti han/hun har oprettet til denne konto) trækkes fra forslaget - så
// rådgiveren ikke nagger Mikkel videre når han har lagt sin halvdel ind.
//
// Returnerer null hvis ingen kandidat-kilde findes, eller hvis den indloggede
// brugers manglende andel allerede er dækket (= 0).
export function buildFixFor(
  issue: CashflowIssue,
  accounts: Account[],
  perAccount: Map<string, AccountCashflowDetail>,
  ctx?: AdvisorContext
): CashflowFix | null {
  const source = findSuggestedSource(accounts, perAccount, issue.account.id);
  if (!source) return null;

  const totalDeficit = issue.type === 'deficit' ? issue.deficit : issue.outflow;
  const isShared = issue.account.owner_name === 'Fælles';

  // Personal-konto eller manglende ctx → fald tilbage til den simple
  // "dæk hele underskuddet"-adfærd.
  if (!isShared || !ctx) {
    return {
      fromAccountId: source.id,
      fromAccountName: source.name,
      toAccountId: issue.account.id,
      toAccountName: issue.account.name,
      amountOere: totalDeficit,
      share: 'full',
      totalDeficit,
      numContributors: 1,
    };
  }

  // Shared: udregn forventet andel og indloggede brugers eksisterende bidrag.
  // Forventet andel = TOTAL outflow på kontoen / antal bidragsydere. Vi
  // bruger total outflow (ikke deficit) så formlen holder uanset hvad der
  // allerede er overført - så Mikkel der har lagt sin halvdel ind ser
  // missing=0, ikke missing=halvdelen-af-resterende-deficit.
  const detail = perAccount.get(issue.account.id);
  const totalOutflow = (detail?.expense ?? 0) + (detail?.transfersOut ?? 0);
  const expectedShare = Math.round(totalOutflow / ctx.numContributors);

  // Sum af brugerens eksisterende månedlige overførsler til kontoen
  // (fra konti han/hun har oprettet).
  const existingFromUser = ctx.transfersByCreator
    .filter(
      (t) =>
        t.toAccountId === issue.account.id &&
        t.creatorUserId === ctx.currentUserId
    )
    .reduce((sum, t) => sum + t.monthly, 0);

  const missingShare = Math.max(0, expectedShare - existingFromUser);
  // Cap suggested ved deficit - hvis fælles-kontoen næsten er dækket fordi
  // partneren har overdækket, behøver brugeren ikke betale sin fulde andel.
  const suggested = Math.min(missingShare, totalDeficit);

  if (suggested === 0) return null;

  return {
    fromAccountId: source.id,
    fromAccountName: source.name,
    toAccountId: issue.account.id,
    toAccountName: issue.account.name,
    amountOere: suggested,
    share: 'partial',
    totalDeficit,
    numContributors: ctx.numContributors,
  };
}

// Diagnose af et husstands-niveau underskud: HVORFOR dækker indkomne
// midler ikke kontoens udgifter? Bruges af dashboard-advisoren til at
// forklare hvorfor en konto er underdækket selv når den indloggede
// bruger har lagt sin egen halvdel ind.
//
// To kilder vi differentierer mellem i V1:
//   - pending_member: husstanden har family_members med email men ingen
//     user_id (pre-godkendt, ikke signet up endnu). Hvis konto er
//     'Fælles' og der er pending-medlemmer, er det den mest sandsynlige
//     forklaring.
//   - underfunded: alle aktive bidragsydere har sat overførsler op,
//     men summen er stadig under outflow. Brugeren skal forhandle med
//     partneren eller skære udgifter.
//
// Mere granulær diagnose (fx "Louise er signet up men har ikke oprettet
// overførsel endnu") kræver at vi udvider AdvisorContext med en
// contributors-liste - kan komme i v2.
export type DeficitReason =
  | { kind: 'pending_member'; memberNames: string[] }
  | { kind: 'underfunded' };

export function diagnoseDeficit(
  account: Account,
  ctx: AdvisorContext
): DeficitReason {
  if (
    account.owner_name === 'Fælles' &&
    ctx.pendingMembers.length > 0
  ) {
    return {
      kind: 'pending_member',
      memberNames: ctx.pendingMembers.map((m) => m.name),
    };
  }
  return { kind: 'underfunded' };
}

// ----------------------------------------------------------------------------
// Privat / Fælles - den gennemgående "røde tråd" på tværs af alle sider
// ----------------------------------------------------------------------------
// Hele appen skelner mellem to klart adskilte spor, og INTET tal blander dem:
//   • Privat  = den indloggede brugers egen økonomi (egne paychecks, eget
//               privat forbrug, egne overførsler ud). Klassificeres som
//               konti der IKKE er 'Fælles' og er oprettet af brugeren selv.
//   • Fælles  = husstandens delte konti (owner_name='Fælles': Budget,
//               Husholdning, Buffer, lån). Begge partnere bidrager.
//
// Partnerens private konti (oprettet af en anden, ikke-Fælles) tælles IKKE
// med - de er private for partneren. Partnerens INDKOMST vises kun på
// /indkomst (via RLS-policy 0063), ikke i Privat/Fælles-aggregeringen her.
//
// Vi bruger myIncome (ikke income) til Privat, så en evt. delt lønkonto ikke
// lægger partnerens løn på som din indtægt - samme regel som dashboard-grafen.
export type PrivatFaellesSummary = {
  privat: {
    income: number;        // mine paychecks + recurring income på mine konti
    expense: number;       // mit private forbrug
    transfersOut: number;  // overført ud (til fælles + egen opsparing)
    net: number;           // income - expense - transfersOut
  };
  faelles: {
    expense: number;       // udgifter på fælleskonti
    transfersIn: number;   // overført ind til fælleskonti (begge partnere)
    net: number;           // transfersIn - expense (negativ = underdækket)
  };
  // I proxy-mode: aggregat for grantorens private konti (Louises i Mikkels
  // hjælper-flow). Undefined udenfor proxy så det eksisterende UI ikke
  // viser et tomt 3. panel.
  partner?: {
    income: number;
    expense: number;
    transfersOut: number;
    net: number;
    name: string;        // grantorens navn ("Louise") - vises som badge
  };
};

// Per-konto klassificering - den ENE kilde til sandhed om hvilket spor en
// konto hører til. Bruges af både dashboardet (aggregering) og /konti
// (gruppering), så en konto altid lander samme sted overalt.
//   • faelles = owner_name 'Fælles' (Budget, Husholdning, Buffer, lån)
//   • privat  = mine egne konti (oprettet af mig, ikke fælles) - inkl.
//               børnekonti jeg administrerer
//   • other   = partnerens egne private konti (ekskluderes fra mit overblik)
export type AccountTrack = 'privat' | 'faelles' | 'other';

export function classifyAccountTrack(
  account: Pick<Account, 'owner_name' | 'created_by'>,
  currentUserId: string
): AccountTrack {
  if (account.owner_name === 'Fælles') return 'faelles';
  if (account.created_by === currentUserId) return 'privat';
  return 'other';
}

export function computePrivatFaelles(
  accounts: Account[],
  perAccount: Map<string, AccountCashflowDetail>,
  currentUserId: string,
  // Optional proxy-context: når sat tilføjes en `partner`-blok der
  // aggregerer grantorens private konti separat (3. panel i dashboardet).
  // I proxy-mode bruger vi d.income (ikke d.myIncome) fordi myMemberId
  // i cashflow.ts kun peger på ÉN perspective ad gangen; for at vise
  // BÅDE Mikkels og Louises korrekt antager vi at paychecks lander på
  // konto-ejerens egen konto (normal case efter wizard'en).
  proxy?: { partnerUserId: string; partnerName: string }
): PrivatFaellesSummary {
  let pIncome = 0;
  let pExpense = 0;
  let pTransfersOut = 0;
  let fExpense = 0;
  let fTransfersIn = 0;
  let parIncome = 0;
  let parExpense = 0;
  let parTransfersOut = 0;

  for (const a of accounts) {
    if (a.archived) continue;
    if (a.kind === 'credit') continue;
    const d = perAccount.get(a.id);
    if (!d) continue;

    const track = classifyAccountTrack(a, currentUserId);
    if (track === 'faelles') {
      fExpense += d.expense;
      fTransfersIn += d.transfersIn;
    } else if (track === 'privat') {
      // I proxy-mode bruger vi d.income så Mikkels lønkonto rapporterer
      // hans paychecks korrekt (myMemberId = Louise i proxy → myIncome=0
      // på Mikkels konti). Udenfor proxy beholder vi myIncome for at
      // undgå shared-lønkonto-bias.
      pIncome += proxy ? d.income : d.myIncome;
      pExpense += d.expense;
      pTransfersOut += d.transfersOut;
    } else if (track === 'other' && proxy && a.created_by === proxy.partnerUserId) {
      // Partnerens (grantorens) private konti i proxy-mode.
      parIncome += d.income;
      parExpense += d.expense;
      parTransfersOut += d.transfersOut;
    }
  }

  return {
    privat: {
      income: pIncome,
      expense: pExpense,
      transfersOut: pTransfersOut,
      net: pIncome - pExpense - pTransfersOut,
    },
    faelles: {
      expense: fExpense,
      transfersIn: fTransfersIn,
      net: fTransfersIn - fExpense,
    },
    ...(proxy
      ? {
          partner: {
            income: parIncome,
            expense: parExpense,
            transfersOut: parTransfersOut,
            net: parIncome - parExpense - parTransfersOut,
            name: proxy.partnerName,
          },
        }
      : {}),
  };
}

// Regnet ud fra detalje-flow så vi separerer transfers fra
// expenses/income. En konto kan have transfersOut > income og stadig være
// "fin" - det er bare en sluse til opsparing. Underdækning kræver at de
// FAKTISKE udgifter overstiger de FAKTISKE indtægter (inkl. transfers ind).
export function detectCashflowIssues(
  accounts: Account[],
  perAccount: Map<string, AccountCashflowDetail>
): CashflowIssue[] {
  const issues: CashflowIssue[] = [];
  for (const account of accounts) {
    if (account.archived) continue;
    // Lån håndteres på /laan - irrelevant for cashflow-tjekket her.
    if (account.kind === 'credit') continue;
    // Opsparing/investering modtager pr. design; en udgift derfra er en
    // bevidst hævning, ikke et symptom på underdækning.
    if (account.kind === 'savings' || account.kind === 'investment') continue;

    const d = perAccount.get(account.id) ?? {
      income: 0,
      myIncome: 0,
      expense: 0,
      transfersIn: 0,
      transfersOut: 0,
    };
    const inflow = d.income + d.transfersIn;
    const outflow = d.expense + d.transfersOut;
    const deficit = outflow - inflow;

    if (outflow > 0 && inflow === 0) {
      issues.push({
        type: 'no-inflow',
        account,
        outflow,
        message: `${account.name} har faste udgifter for ${formatAmount(outflow)} kr./md, men intet kommer ind.`,
        suggestion:
          'Tilføj en månedlig overførsel fra lønkontoen, eller flyt udgifterne til en konto der har indkomst.',
      });
    } else if (deficit > 0) {
      issues.push({
        type: 'deficit',
        account,
        deficit,
        inflow,
        outflow,
        message: `${account.name} er underdækket med ${formatAmount(deficit)} kr./md - der går mere ud (${formatAmount(outflow)}) end der kommer ind (${formatAmount(inflow)}).`,
        suggestion:
          'Forhøj den månedlige overførsel hertil, eller skær udgifter ned på kontoen.',
      });
    }
  }
  return issues;
}
