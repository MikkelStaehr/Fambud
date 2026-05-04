// /wizard/oversigt - Trin 2 i partner-flowet. Read-only oversigt over
// hvad ejeren har sat op (fælleskonti + familiemedlemmer). Sætter
// kontekst inden partner skal til at oprette sine egne private opsparinger
// - så de ved hvilken buffer/husholdningskonto der allerede findes og
// undgår at gen-oprette dem.
//
// Trinet redirecter ejer-brugere til deres egen vej (ejeren kommer aldrig
// hertil i normalt flow, men hvis nogen taster URL'en direkte, sender vi
// dem videre).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Baby,
  Mail,
  PiggyBank,
  ShoppingBasket,
  TrendingUp,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';
import type { AccountKind } from '@/lib/database.types';

const KIND_ICON: Partial<Record<AccountKind, LucideIcon>> = {
  checking: Wallet,
  budget: Wallet,
  household: ShoppingBasket,
  savings: PiggyBank,
  investment: TrendingUp,
};

export default async function WizardOversigtPage() {
  const { membership } = await getMyMembership();
  if (membership?.role === 'owner') {
    // Ejer kommer aldrig hertil i normalt flow - vi router dem væk.
    redirect('/wizard/faelleskonti');
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Fælleskonti = konti hvor owner_name='Fælles'. Disse er det partneren
  // skal være opmærksom på - det er HER de har read+write som standard.
  const { data: sharedAccounts } = await supabase
    .from('accounts')
    .select('id, name, kind, savings_purposes, investment_type')
    .eq('household_id', householdId)
    .eq('archived', false)
    .eq('owner_name', 'Fælles')
    .order('kind', { ascending: true });

  // Familie-medlemmer (alle, inkl. partneren selv) - vi viser dem så
  // partneren ved hvem der er i husstanden og har et hurtigt overblik.
  const { data: familyMembers } = await supabase
    .from('family_members')
    .select('id, name, email, user_id, role')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  const owner = (familyMembers ?? []).find((m) => m.role === 'owner');
  const others = (familyMembers ?? []).filter(
    (m) => m.role !== 'owner' && m.user_id !== user.id
  );
  const adults = others.filter((m) => m.email != null || m.user_id != null);
  const children = others.filter(
    (m) => m.email == null && m.user_id == null
  );

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 2 af 4
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Oversigt over husstanden
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Det her er hvad {owner?.name ?? 'din partner'} allerede har sat op.
        Du behøver ikke gen-oprette nogle af kontiene - i næste trin
        opretter du kun dine egne private opsparinger.
      </p>

      {/* Fælleskonti */}
      <section className="mt-6">
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Fælleskonti
        </h2>
        {(sharedAccounts ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-4 text-center text-xs text-neutral-500">
            Ingen fælleskonti endnu. Du kan altid foreslå at oprette en
            efter wizarden via /konti.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            {sharedAccounts!.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? Wallet;
              const isBuffer = a.savings_purposes?.includes('buffer');
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="font-medium text-neutral-900">
                        {a.name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}
                        {isBuffer && ' · Buffer'}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    Fælles
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Familiemedlemmer */}
      <section className="mt-6">
        <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Familiemedlemmer
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {owner && (
            <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <User className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-neutral-900">{owner.name}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                Ejer
              </span>
            </div>
          )}
          {adults.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Mail className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-neutral-900">{a.name}</span>
              {a.email && (
                <span className="text-xs text-neutral-500">{a.email}</span>
              )}
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                Voksen
              </span>
            </div>
          ))}
          {children.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                <Baby className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-neutral-900">{c.name}</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
                Barn
              </span>
            </div>
          ))}
          {/* Du selv */}
          <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-700">
              <User className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-neutral-900">Dig</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
              Du er ved at sætte op
            </span>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <Link
          href="/wizard/opsparing"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Næste - opret dine private opsparinger
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
