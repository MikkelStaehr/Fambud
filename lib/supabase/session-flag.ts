// "Husk mig"-flag: when set ('1') we strip maxAge/expires from the sb-* auth
// cookies so they become session cookies (cleared on browser close). The flag
// itself is httpOnly and lives across requests so the SSR proxy can apply the
// same treatment as the server clients.
export const SESSION_ONLY_COOKIE = 'fambud_session_only';

export function stripPersistenceIfSessionOnly<
  T extends { name: string; value: string; options?: { maxAge?: number; expires?: Date } },
>(cookiesToSet: T[], sessionOnly: boolean): T[] {
  if (!sessionOnly) return cookiesToSet;
  return cookiesToSet.map((c) => {
    if (!c.name.startsWith('sb-')) return c;
    const { maxAge: _maxAge, expires: _expires, ...rest } = c.options ?? {};
    return { ...c, options: rest };
  });
}
