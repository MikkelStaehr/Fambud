// Lille "AI hjælper" på dashboardet: analysér pr.-konto cashflow og find
// strukturelle problemer som brugeren bør løse manuelt. Det er IKKE en ML-
// model — bare en samling af pragmatiske regler om "hvis X er sandt, så er
// kontoen sandsynligvis sat forkert op". Reglerne lever her samlet så
// dashboardet og fremtidige steder (fx wizard-completion-tjek) kan dele dem.

import { formatAmount } from './format';
import type { Account } from './database.types';
import type { AccountCashflowDetail } from './dal';

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

// Regnet ud fra detalje-flow så vi separerer transfers fra
// expenses/income. En konto kan have transfersOut > income og stadig være
// "fin" — det er bare en sluse til opsparing. Underdækning kræver at de
// FAKTISKE udgifter overstiger de FAKTISKE indtægter (inkl. transfers ind).
export function detectCashflowIssues(
  accounts: Account[],
  perAccount: Map<string, AccountCashflowDetail>
): CashflowIssue[] {
  const issues: CashflowIssue[] = [];
  for (const account of accounts) {
    if (account.archived) continue;
    // Lån håndteres på /laan — irrelevant for cashflow-tjekket her.
    if (account.kind === 'credit') continue;
    // Opsparing/investering modtager pr. design; en udgift derfra er en
    // bevidst hævning, ikke et symptom på underdækning.
    if (account.kind === 'savings' || account.kind === 'investment') continue;

    const d = perAccount.get(account.id) ?? {
      income: 0,
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
        message: `${account.name} er underdækket med ${formatAmount(deficit)} kr./md — der går mere ud (${formatAmount(outflow)}) end der kommer ind (${formatAmount(inflow)}).`,
        suggestion:
          'Forhøj den månedlige overførsel hertil, eller skær udgifter ned på kontoen.',
      });
    }
  }
  return issues;
}
