// /indstillinger landing-route - redirecter til Profil-fanen som default
// view. Tab-nav i layout viser de øvrige sektioner (Husstand, Kategorier,
// Aktivitet). Eksisterende links til '/indstillinger' fortsætter med at
// virke og lander på Profil.

import { redirect } from 'next/navigation';

export default function IndstillingerIndex() {
  redirect('/indstillinger/profil');
}
