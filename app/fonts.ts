// ZT Nature Bold - bruges som display-font i landing-flowet og store
// overskrifter rundt om i appen. Licens: 1001Fonts FFC (free for
// commercial use, ingen modifikation). Vi loader kun Bold-vægten så
// vi sparer payload.
//
// MADE Awelier Black 900 - selve FambudMark-wordmark'et.
// ⚠ LICENS: PERSONAL USE kun (Fontfabric). KAN IKKE deployes til prod
// før vi køber en kommerciel licens (~$50 hos Fontfabric.com). Indtil
// licensen er på plads er font'en kun til lokal udvikling / interne
// previews.
//
// next/font/local optimerer fonterne ved build (auto-subset, auto-
// preload, CSS-variabel-injection) så vi får zero layout shift og
// ingen flash.

import localFont from 'next/font/local';

export const ztNature = localFont({
  src: '../font/zt-nature/ZTNature-Bold.otf',
  weight: '700',
  style: 'normal',
  display: 'swap',
  variable: '--font-zt-nature',
});

export const madeAwelierBlack = localFont({
  src: '../font/made_awelier/MADEAwelierPERSONALUSE-Black.otf',
  weight: '900',
  style: 'normal',
  display: 'swap',
  variable: '--font-made-awelier-black',
});
