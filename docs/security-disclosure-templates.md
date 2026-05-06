# Email-templates til responsible disclosure

Templates til brug når en security-rapport modtages via
`support@fambud.dk`. Tilpas hver gang — de er ikke ment som
copy-paste-uden-redigering.

Alle templates er på dansk som default. Hvis researcher skriver til os
på engelsk, så svar på engelsk.

Reference: [/security](../app/security/page.tsx) public-facing policy +
[SECURITY_AUDITS.md](../SECURITY_AUDITS.md) Prompt 13 runbook.

---

## 1. Initial acknowledgment (sendes inden 48h)

**Subject**: `Re: [original subject] — Modtaget af Fambud security`

```
Hej [navn / pseudonym],

Tak fordi du tog dig tid til at melde dette til os. Vi har modtaget
din rapport og er begyndt at undersøge.

Hvad sker der nu:
- Vi vurderer severity og scope inden for de næste 7 dage
- Du hører fra os igen med en plan eller opklarende spørgsmål
- Hvis vi skal have flere detaljer, kontakter vi dig direkte

I mellemtiden:
- Behold detaljerne for dig selv indtil vi har fixet det
- Du må gerne fortsætte din undersøgelse af FamBud-platformen i
  henhold til vores responsible disclosure policy:
  https://www.fambud.dk/security

Hvis du vil i Hall of Fame med navn eller pseudonym når sårbarheden
er fixet, så lad os vide hvilket - vi opfører dig kun hvis du
udtrykkeligt ønsker det.

Tak igen.

Mikkel
support@fambud.dk
```

**Hvornår sendes den**: inden for 48 timer fra modtagelse. Hvis du er
på ferie eller på anden vis utilgængelig, sæt en out-of-office der
peger på en alternativ kontakt eller forklarer forsinkelsen.

---

## 2. Status-opdatering (sendes inden 7 dage hvis fix ikke er deployet)

**Subject**: `Re: [original subject] — Status-opdatering`

```
Hej [navn],

Status på din rapport om [kort beskrivelse]:

Vurdering:
- Severity: [Critical / High / Medium / Low]
- Scope: [hvilke dele af FamBud er påvirket]
- Reproduceret: [ja / nej / delvist]

Plan:
- [Konkret fix-plan med dato]
- [Eventuelle workarounds vi har implementeret allerede]

Forventet fix-deploy: [dato baseret på severity-SLA]
- Critical: 24h
- High: 7 dage
- Medium: 30 dage
- Low: 90 dage

Vi opdaterer dig igen når fix'et er deployet, eller hvis tidsplanen
ændrer sig.

Mikkel
```

**Hvornår sendes den**: inden for 7 dage fra initial acknowledgment.
Hvis severity er Critical og fix allerede er deployet, kombinér med
template 3 nedenfor.

---

## 3. Disclosure-completion (sendes når fix er deployet)

**Subject**: `Re: [original subject] — Fixet og deployet`

```
Hej [navn],

Vi har deployet et fix til den sårbarhed du rapporterede. Detaljer:

Sårbarhed: [kort beskrivelse, ingen tekniske implementation-detaljer
hvis det er en igangværende klasse af angreb]
Fix-commit: [git-SHA eller PR-link hvis offentligt]
Deployet: [dato + tidspunkt]
Verifikation: [hvad vi har testet for at bekræfte fix virker]

Hvis du gerne vil verificere det selv, så er du velkommen.

Public disclosure:
- Du må gerne offentliggøre detaljer fra dags dato
- Vi sætter pris på hvis du linker til https://www.fambud.dk/security
  i din writeup
- Hvis du vil have os til at koordinere offentliggørelsen (samtidig
  blog-post, etc.), så lad os vide

Anerkendelse:
- [Hvis researcher har bedt om HOF: "Vi har tilføjet dig til Hall of
  Fame på /security"]
- [Hvis researcher har bedt om reference: "Vi har skrevet en kort
  reference vedlagt"]
- [Hvis researcher har bedt om anonymitet: "Du forbliver anonym i
  alle vores public mentions"]

Tak igen for din hjælp - det her gør Fambud bedre for alle vores
brugere.

Mikkel
```

**Hvornår sendes den**: samme dag fix er deployet til produktion.
Verificér via `bash scripts/check-headers.sh` + manual testing før
du sender.

---

## 4. "Out of scope"-svar (sendes inden 48h hvis rapport ikke er in-scope)

**Subject**: `Re: [original subject] — Tak, men out of scope`

```
Hej [navn],

Tak fordi du tog dig tid til at melde dette. Efter at have læst din
rapport, er den desværre uden for scope for vores responsible
disclosure policy.

Konkret årsag:
- [Vælg én eller fler:]
- DoS / DDoS-relaterede issues testes vi ikke aktivt
- Det her er en third-party-tjeneste (Supabase / Vercel / Resend) -
  rapportér direkte til dem
- Det er en kendt accepteret risiko (se
  https://github.com/MikkelStaehr/Fambud/blob/main/SECURITY_AUDITS.md)
- Rapport handler om en bruger der manuelt eksponerer sin egen data
  (selv-XSS, public sharing, etc.)
- Issuet er kosmetisk eller UX-relateret, ikke security

Hvis du mener vi har misforstået rapporten, så uddyb og vi kigger
igen.

Tak alligevel - det er bedre at få for mange end for få.

Mikkel
```

**Hvornår sendes den**: inden for 48 timer fra modtagelse, samme SLA
som template 1. Vær venlig - selv hvis rapporten er klart out-of-scope,
har researcheren brugt tid på den, og vi vil have at de melder ind
igen næste gang.

---

## 5. Specialhåndtering: ekstortion / uautoriseret access

**Subject**: `Vi modtager ikke betaling for ikke at offentliggøre sårbarheder`

```
Hej,

Vi har modtaget din henvendelse. Inden vi går videre, er det vigtigt
at sige følgende:

1. Fambud betaler ikke for at undgå offentliggørelse. Vi har en
   responsible disclosure policy
   (https://www.fambud.dk/security) der tilbyder anerkendelse, ikke
   penge.

2. Hvis du har fået adgang til data der ikke er din - også selv om
   det var via en bug i vores app - så har du potentielt overtrådt
   straffeloven og GDPR. Slet alt data du har eksfiltreret nu, og
   bekræft skriftligt at det er gjort.

3. Hvis du følger trin 2 og din research var i god tro, vil vi
   behandle dig som enhver anden disclosure-rapportør. Hvis ikke,
   forbeholder vi os retten til at anmelde til Datatilsynet og
   politiet.

Hvis det her var et misforståelse, og du ikke krævede penge eller
har eksfiltreret data, så undskyld for tonen og send os en almindelig
rapport.

Mikkel
support@fambud.dk
```

**Hvornår sendes den**: aldrig som standard, kun ved tydelige tegn på
afpresning ("vi offentliggør medmindre I betaler X"). Konsulter med
projektleder før send. Gem original rapport som bevis.
