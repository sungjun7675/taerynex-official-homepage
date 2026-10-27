import { createHash } from 'node:crypto';
import { locales } from '../src/marketing/locales.js';
import { headersForPath } from './preview-marketing.mjs';
import { read, reporter } from './check-utils.mjs';
const {check,finish}=reporter();
for (const path of ['/', '/app/', '/app/ko', '/app/en', '/ko.html', '/ko', '/terms/en.html', '/terms/en', '/google2233132a77c14ffe.html']) {
  const h=headersForPath(path);
  check(`CSP + nosniff + frame denial ${path}`,h['Content-Security-Policy']?.includes("default-src 'none'") && h['X-Content-Type-Options']==='nosniff' && h['X-Frame-Options']==='DENY');
  check(`no-transform for public HTML ${path}`,h['Cache-Control']?.includes('no-transform'));
}
for(const code of Object.keys(locales)) for(const prefix of ['', 'terms/']) {
  const html=read(`dist/${prefix}${code}.html`);
  for(const [,style] of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    const hash=`'sha256-${createHash('sha256').update(style).digest('base64')}'`;
    check(`exact frozen legal inline style allowed ${prefix}${code}`,headersForPath(`/${prefix}${code}`)['Content-Security-Policy'].includes(hash));
  }
}
check('hashed assets immutable',headersForPath('/assets/index-a.js')['Cache-Control'].includes('immutable'));
check('mutable brand images revalidated',!headersForPath('/brand/app-icon.webp')['Cache-Control'].includes('immutable'));
check('retirement worker never cached',headersForPath('/sw.js')['Cache-Control'].includes('no-store'));
finish('Local header contract (live Vercel UNVERIFIED)');
