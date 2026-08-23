#!/usr/bin/env node
/**
 * How-it-works video CTA + PSCS One footer lockup (DEV public landing).
 *
 * Scope: public quote landing only. Does not change wizard/pricing/auth.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
let passed = 0;
let failed = 0;

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx');
const howItWorks = read('components/quotes/PublicQuoteHowItWorks.tsx');
const heroMedia = read('components/quotes/PublicQuoteHeroMedia.tsx');
const heroVideos = read('Lib/publicQuote/heroMedia.ts');
const videoPath = join(ROOT, 'public/cdl/video/cdl-como-funciona.mp4');
const posterPath = join(ROOT, 'public/cdl/video/cdl-como-funciona-poster.webp');
const officialMark = join(ROOT, 'public/brand/pscs-one.png');

report('TEST 01: Official how-it-works video exists', existsSync(videoPath), existsSync(videoPath) ? `${(statSync(videoPath).size / (1024 * 1024)).toFixed(2)} MB` : 'missing');
report('TEST 02: Video poster exists', existsSync(posterPath), existsSync(posterPath) ? `${Math.round(statSync(posterPath).size / 1024)} KB` : 'missing');
report('TEST 03: Official PSCS One lockup exists', existsSync(officialMark));

report('TEST 04: HowItWorks component exists', Boolean(howItWorks));
report(
  'TEST 05: Video src is the official CDL file',
  howItWorks.includes("/cdl/video/cdl-como-funciona.mp4") && howItWorks.includes("/cdl/video/cdl-como-funciona-poster.webp"),
);
report('TEST 06: Video uses preload="none" (no eager download)', howItWorks.includes('preload="none"'));
report('TEST 07: Video uses playsInline + controls', howItWorks.includes('playsInline') && howItWorks.includes('controls'));
report('TEST 08: Video is mounted only after user opens the modal', howItWorks.includes('{open ? (') && howItWorks.includes('<video'));
report('TEST 09: Modal is a dialog, not a new tab/route', howItWorks.includes('role="dialog"') && !howItWorks.includes('target="_blank"') && !howItWorks.includes('window.open'));
report('TEST 10: Close pauses and unmounts the player', howItWorks.includes('pauseAndReset') && howItWorks.includes('setOpen(false)'));
report('TEST 11: Landing does not autoplay the how-it-works video', !howItWorks.includes('autoPlay') && !howItWorks.includes('autoplay'));

report(
  'TEST 12: Hero carousel does not include the how-it-works video',
  /PUBLIC_QUOTE_HERO_VIDEO_SRCS[^=]*=\s*\[\s*\]/.test(heroVideos) &&
    !heroVideos.includes('cdl-como-funciona.mp4') &&
    !heroMedia.includes('cdl-como-funciona.mp4'),
);

report('TEST 13: Experience mounts HowItWorks under the primary CTA', read('components/quotes/PublicLandingCinematic.tsx').includes('<PublicQuoteHowItWorks') && read('components/quotes/PublicLandingCinematic.tsx').includes('data-landing-start-quote'));
report('TEST 14: PT copy is Conheça como funciona', experience.includes("howItWorks: 'Conheça como funciona'"));
report('TEST 15: EN copy is See how it works', experience.includes("howItWorks: 'See how it works'"));
report('TEST 16: ES copy is Conoce cómo funciona', experience.includes("howItWorks: 'Conoce cómo funciona'"));
report('TEST 17: Footer uses gray Powered by + full PSCS One mark', experience.includes("poweredBy: 'Powered by'") && experience.includes('variant="full"'));
report('TEST 18: Public quote routes remain listed as public', read('Lib/publicRoutes.ts').includes("'/quote'"));
report(
  'TEST 19: Proxy skips auth for public mp4 assets',
  read('proxy.ts').includes('mp4') &&
    read('Lib/publicRoutes.ts').includes("'/cdl/video'"),
);

console.log('');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
