// Loader alle fonte i font/-mappen som CSS-variabler, kun til brug på
// /wordmark-test-siden. Vi loader hele familier (multi-weight) som
// localFont-arrays så vi kan bruge font-weight CSS til at vælge variant
// i stedet for at have 25 separate font-objekter.
//
// Bemærk: alle PERSONAL USE-fonts er kun licenseret til ikke-kommerciel
// brug. Hvis vi vælger en af MADE-fonterne som det rigtige wordmark,
// skal vi købe en kommerciel licens før brug i prod.

import localFont from 'next/font/local';

export const madeAwelier = localFont({
  src: [
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-ExtraBold.otf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../font/made_awelier/MADEAwelierPERSONALUSE-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-made-awelier',
  display: 'swap',
});

export const madeInfinity = localFont({
  src: [
    {
      path: '../../font/made_infinity/MADEINFINITYPersonalUse-Thin.otf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYPersonalUse-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYPersonalUse-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYPersonalUse-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYPersonalUse-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-made-infinity',
  display: 'swap',
});

export const madeInfinityBeside = localFont({
  src: [
    {
      path: '../../font/made_infinity/MADEINFINITYBesidePersonalUse-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYBesidePersonalUse-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-made-infinity-beside',
  display: 'swap',
});

export const madeInfinityOutline = localFont({
  src: [
    {
      path: '../../font/made_infinity/MADEINFINITYOutlinePersonalUse-Thin.otf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYOutlinePersonalUse-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYOutlinePersonalUse-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYOutlinePersonalUse-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../font/made_infinity/MADEINFINITYOutlinePersonalUse-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-made-infinity-outline',
  display: 'swap',
});

export const madeVoyager = localFont({
  src: [
    {
      path: '../../font/made_voyager/MADEVoyagerPERSONAL_USE-Thin.otf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../../font/made_voyager/MADEVoyagerPERSONAL_USE-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../font/made_voyager/MADEVoyagerPERSONAL_USE-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../font/made_voyager/MADEVoyagerPERSONAL_USE-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../font/made_voyager/MADEVoyagerPERSONAL_USE-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-made-voyager',
  display: 'swap',
});

export const magnolia = localFont({
  src: '../../font/Magnolia.ttf',
  weight: '400',
  style: 'normal',
  variable: '--font-magnolia',
  display: 'swap',
});

export const ztNatureFull = localFont({
  src: [
    {
      path: '../../font/zt-nature/ZTNature-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../font/zt-nature/ZTNature-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../font/zt-nature/ZTNature-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../font/zt-nature/ZTNature-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-zt-nature-full',
  display: 'swap',
});

// Beskrivelse til UI: hver familie + dens varianter med korrekt
// fontWeight-CSS-værdi. Bruges af page.tsx til at rendere alle
// kombinationer automatisk.
export type WordmarkVariant = {
  label: string;
  weight: number;
  italic?: boolean;
};

export type WordmarkFamily = {
  name: string;
  description: string;
  cssVar: string;
  variants: WordmarkVariant[];
};

// Manuelt justerede kandidater - specifikke (font, vægt, letter-spacing)-
// kombinationer brugeren vil sammenligne side om side øverst på siden.
// Default letter-spacing i family-sektionen er -0.02em (tæt). Disse
// kandidater overskriver letter-spacing til andre værdier brugeren har
// bedt om.
export type TunedCandidate = {
  label: string;
  cssVar: string;
  weight: number;
  italic?: boolean;
  letterSpacing: string;
  note?: string;
};

export const TUNED_CANDIDATES: readonly TunedCandidate[] = [
  {
    label: 'MADE Awelier · Regular 400 · +0.05em',
    cssVar: 'var(--font-made-awelier)',
    weight: 400,
    letterSpacing: '0.05em',
    note: 'Let, åben',
  },
  {
    label: 'MADE Awelier · Black 900 · +0.05em',
    cssVar: 'var(--font-made-awelier)',
    weight: 900,
    letterSpacing: '0.05em',
    note: 'Stærk, åben',
  },
  {
    label: 'ZT Nature · Bold Italic 700 · +0.04em',
    cssVar: 'var(--font-zt-nature-full)',
    weight: 700,
    italic: true,
    letterSpacing: '0.04em',
    note: 'Den nuværende stil med mere luft',
  },
  {
    label: 'Magnolia · Regular 400 · -0.05em',
    cssVar: 'var(--font-magnolia)',
    weight: 400,
    letterSpacing: '-0.05em',
    note: 'Script tættere sammen',
  },
];

export const FAMILIES: readonly WordmarkFamily[] = [
  {
    name: 'MADE Awelier',
    description: 'Sans-serif, geometrisk, lav x-højde. Personal-use licens.',
    cssVar: 'var(--font-made-awelier)',
    variants: [
      { label: 'Light 300', weight: 300 },
      { label: 'Regular 400', weight: 400 },
      { label: 'Medium 500', weight: 500 },
      { label: 'Bold 700', weight: 700 },
      { label: 'ExtraBold 800', weight: 800 },
      { label: 'Black 900', weight: 900 },
    ],
  },
  {
    name: 'MADE INFINITY',
    description: 'Display-sans, modern. Personal-use licens.',
    cssVar: 'var(--font-made-infinity)',
    variants: [
      { label: 'Thin 100', weight: 100 },
      { label: 'Light 300', weight: 300 },
      { label: 'Regular 400', weight: 400 },
      { label: 'Medium 500', weight: 500 },
      { label: 'Black 900', weight: 900 },
    ],
  },
  {
    name: 'MADE INFINITY Beside',
    description: 'Display med "beside"-detail. Personal-use licens.',
    cssVar: 'var(--font-made-infinity-beside)',
    variants: [
      { label: 'Medium 500', weight: 500 },
      { label: 'Black 900', weight: 900 },
    ],
  },
  {
    name: 'MADE INFINITY Outline',
    description: 'Outlined display-variant. Personal-use licens.',
    cssVar: 'var(--font-made-infinity-outline)',
    variants: [
      { label: 'Thin 100', weight: 100 },
      { label: 'Light 300', weight: 300 },
      { label: 'Regular 400', weight: 400 },
      { label: 'Medium 500', weight: 500 },
      { label: 'Black 900', weight: 900 },
    ],
  },
  {
    name: 'MADE Voyager',
    description: 'Sans-serif, mere humanist. Personal-use licens.',
    cssVar: 'var(--font-made-voyager)',
    variants: [
      { label: 'Thin 100', weight: 100 },
      { label: 'Light 300', weight: 300 },
      { label: 'Regular 400', weight: 400 },
      { label: 'Medium 500', weight: 500 },
      { label: 'Bold 700', weight: 700 },
    ],
  },
  {
    name: 'Magnolia',
    description: 'Script/håndskrevet display.',
    cssVar: 'var(--font-magnolia)',
    variants: [{ label: 'Regular 400', weight: 400 }],
  },
  {
    name: 'ZT Nature (nuværende wordmark)',
    description:
      'Den font vi bruger i FambudMark i dag - til reference. 1001Fonts FFC licens.',
    cssVar: 'var(--font-zt-nature-full)',
    variants: [
      { label: 'Regular 400', weight: 400 },
      { label: 'Italic 400', weight: 400, italic: true },
      { label: 'Bold 700', weight: 700 },
      { label: 'Bold Italic 700', weight: 700, italic: true },
    ],
  },
];
