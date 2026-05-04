// ZT Nature Bold - font kun til FambudMark wordmark.
// Licens: 1001Fonts FFC (free for commercial use, ingen modifikation).
// Vi loader kun Bold-vægten og kun til wordmark'et - ikke til body - så
// vi sparer payload (~57 KB OTF konverteres til subset af Next.js).
//
// next/font/local optimerer fonten ved build (auto-subset, auto-preload,
// CSS-variabel-injection) så vi får zero layout shift og ingen flash.

import localFont from 'next/font/local';

export const ztNature = localFont({
  src: '../font/zt-nature/ZTNature-Bold.otf',
  weight: '700',
  style: 'normal',
  display: 'swap',
  variable: '--font-zt-nature',
});
