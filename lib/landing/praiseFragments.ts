// Praise-blok-tekster på Step 3.
//
// Logik per spec:
//   0 brikker:    generisk "I er ved at finde formen"-tekst
//   1-2 brikker:  kombinér aktive brik-fragmenter + "Det har mange ikke"
//   3-4 brikker:  generisk "I har det meste på plads"-tekst
//   5-6 brikker:  generisk "I er længere end de fleste"-tekst
//
// Fragmenter er korte naturlige sætnings-stumper der kan kombineres
// grammatisk (med "og" mellem to, eller komma + "og" hvis der nogensinde
// kommer 3+).

import type { Brik } from './types';

// Per-brik-fragment til 1-2-brikker-cases. Skrevet så de kan stå alene
// eller kombineres ("I har {fragment1} og {fragment2}").
const BRIK_FRAGMENTS: Record<Brik, string> = {
  buffer: 'en buffer der dækker uventede udgifter',
  opsparing: 'en fast opsparing til større ting',
  alder: 'en aldersopsparing udover firmaets bidrag',
  boern: 'en børneopsparing der vokser med dem',
  raadighed: 'et fast rådighedsbeløb til hver',
  fordeling: 'et system til fælles udgifter',
};

export type PraiseContent = {
  headline: string;
  body: string;
};

// Generiske tekster. Tone matcher mockup'ens "Det har mange faktisk
// ikke. Det er to af de vigtigste byggesten i en sund familieøkonomi"-
// rytme: bekræftende, faktuel, ikke-overdreven.
const PRAISE_NONE: PraiseContent = {
  headline: 'I er ved at finde formen.',
  body: 'Det er der hvor mange starter, og det er faktisk en god ting. I har ikke vaner der skal aflæres, I bygger fra bunden. Det her viser jer hvor jeres tal kunne ende, og det er noget I selv kan tage med ind når I er klar.',
};

const PRAISE_MOST: PraiseContent = {
  headline: 'I har faktisk det meste på plads.',
  body: 'Det her handler om struktur, ikke om at lære nyt. I gør allerede tingene, men de ligger nok lidt spredt. Når der er ét sted at se det hele, og hver krone har et formål, så føles det mindre som at jonglere og mere som at have styr på det.',
};

const PRAISE_FURTHER: PraiseContent = {
  headline: 'I er længere end de fleste familier.',
  body: 'Det her handler om at få det sidste til at falde i hak. I har vanerne og brikkerne, og I har sikkert også gjort jer tanker om hvordan det hænger sammen. FamBud er det værktøj der binder det hele sammen så I kan se det visuelt og justere når noget ændrer sig.',
};

// Sammensæt brik-fragmenter til én sætning, dansk grammatik.
// 1 brik:   "I har en buffer der dækker uventede udgifter."
// 2 brikker: "I har en buffer der dækker uventede udgifter og en
//            fast opsparing til større ting."
function joinFragments(brikker: Brik[]): string {
  const fragments = brikker.map((b) => BRIK_FRAGMENTS[b]);
  if (fragments.length === 0) return '';
  if (fragments.length === 1) return `I har ${fragments[0]}.`;
  // 2: "X og Y"
  if (fragments.length === 2) {
    return `I har ${fragments[0]} og ${fragments[1]}.`;
  }
  // 3+ falls under 3-4-bucket og bruger generic - ikke denne path
  // i nuværende logik. Fallback til komma-kompositioner hvis spec
  // ændres senere.
  const last = fragments.pop()!;
  return `I har ${fragments.join(', ')} og ${last}.`;
}

export function buildPraiseContent(brikker: Brik[]): PraiseContent {
  const count = brikker.length;

  if (count === 0) return PRAISE_NONE;

  if (count <= 2) {
    return {
      headline: joinFragments(brikker),
      body: 'Det har mange faktisk ikke. Det er en af de vigtigste byggesten i en sund familieøkonomi, og det betyder at I aktivt bygger noget op i stedet for bare at håbe der bliver noget tilovers. I er længere end I tror.',
    };
  }

  if (count <= 4) return PRAISE_MOST;

  return PRAISE_FURTHER;
}
