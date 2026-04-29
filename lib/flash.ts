// Helpers til server-actions der vil sende en toast-besked til den side
// brugeren lander på efter redirect. Vi pakker bare notice + kind ind i
// search-params; <Toast /> i (app)/layout.tsx læser dem og rydder URL'en
// efter 3s.
//
// Brug i en action:
//   redirect(noticeUrl('/konti', 'Konto gemt'));
//   redirect(noticeUrl('/konti', 'Kunne ikke slette', 'error'));

type Kind = 'success' | 'error' | 'info';

// Bygger en URL string med notice + kind appended som search params.
// Bevarer eksisterende search-params hvis de er sat på path'en.
export function noticeUrl(path: string, message: string, kind: Kind = 'success'): string {
  const [base, existingQuery] = path.split('?');
  const params = new URLSearchParams(existingQuery ?? '');
  params.set('notice', message);
  // 'success' er default i Toast så vi sparer query-bytes ved at undlade
  // den når den er default.
  if (kind !== 'success') params.set('kind', kind);
  return `${base}?${params.toString()}`;
}
