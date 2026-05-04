'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdContext } from '@/lib/dal';
import { sendEmail } from '@/lib/email/resend';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export type FeedbackResult = { ok: true } | { ok: false; error: string };

// Opretter en feedback-row + sender notifikation til admin via Resend.
// Returnerer struktureret resultat (ikke redirect) så modalen kan vise
// success/error inline. DB-insert er kilden - hvis Resend fejler, lader
// vi feedback'en stå og logger fejlen, så vi ikke mister beskeden.
export async function submitFeedback(formData: FormData): Promise<FeedbackResult> {
  const message = String(formData.get('message') ?? '').trim();
  const pageUrl = String(formData.get('page_url') ?? '').trim() || null;
  const userAgent = String(formData.get('user_agent') ?? '').trim() || null;

  if (!message) {
    return { ok: false, error: 'Skriv en besked først' };
  }
  if (message.length > 5000) {
    return { ok: false, error: 'Besked er for lang (max 5000 tegn)' };
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Hent navn fra family_members så admin-mailen kan vise hvem der skrev
  // uden at skulle slå op manuelt. Single query, vi accepterer at den
  // koster en ekstra round-trip.
  const { data: member } = await supabase
    .from('family_members')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle();
  const fullName = member?.name ?? null;

  const { error: insertError } = await supabase.from('feedback').insert({
    user_id: user.id,
    household_id: householdId,
    email: user.email ?? null,
    full_name: fullName,
    message,
    page_url: pageUrl,
    user_agent: userAgent,
  });
  if (insertError) {
    return { ok: false, error: 'Kunne ikke gemme - prøv igen om lidt' };
  }

  // Notifikations-mail. Vi venter ikke på Resend i kritisk path (den
  // kan tage 1-2 sek og brugeren har ingen grund til at vente). Hvis
  // den fejler, har vi DB-rækken stadig.
  const adminEmail = process.env.FEEDBACK_NOTIFICATION_EMAIL;
  if (adminEmail) {
    try {
      await sendEmail({
        to: adminEmail,
        replyTo: user.email ?? undefined,
        subject: `Feedback fra ${fullName ?? user.email ?? 'ukendt bruger'}`,
        html: buildAdminNotificationHtml({
          fullName,
          email: user.email ?? null,
          message,
          pageUrl,
        }),
        text: `Fra: ${fullName ?? '-'} <${user.email ?? '-'}>\nSide: ${pageUrl ?? '-'}\n\n${message}`,
      });
    } catch (err) {
      // Log men fail ikke - DB er kilden
      console.error('Resend feedback notification failed:', err);
    }
  }

  return { ok: true };
}

function buildAdminNotificationHtml(params: {
  fullName: string | null;
  email: string | null;
  message: string;
  pageUrl: string | null;
}): string {
  const { fullName, email, message, pageUrl } = params;
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#171717;">
      <h2 style="margin:0 0 16px;font-size:18px;">Ny feedback fra Fambud</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:4px 0;color:#737373;width:80px;">Fra:</td><td>${fullName ?? '-'}</td></tr>
        <tr><td style="padding:4px 0;color:#737373;">Email:</td><td>${email ?? '-'}</td></tr>
        <tr><td style="padding:4px 0;color:#737373;">Side:</td><td>${pageUrl ?? '-'}</td></tr>
      </table>
      <div style="border-left:3px solid #065f46;padding:12px 16px;background:#f5f5f4;border-radius:4px;font-size:14px;line-height:1.6;">
        ${escapedMessage}
      </div>
    </div>
  `;
}
