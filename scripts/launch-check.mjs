import { existsSync, statSync } from 'node:fs';
import { locales, localeCodes } from '../src/marketing/locales.js';
import { read, json, sha, walk, reporter } from './check-utils.mjs';
const {check,finish} = reporter();
if (!existsSync('dist/app/ko.html')) throw Error('Build the whole candidate first: npm run build');
const integrity = json('docs/legal-integrity.json');
for (const [file,hash] of Object.entries(integrity.files)) {
  check(`frozen public body ${file}`,sha(`public/${file}`) === hash);
  check(`frozen dist body ${file}`,sha(`dist/${file}`) === hash);
}
check('original root privacy retained at Korean legal endpoint',sha('dist/ko.html') === integrity.originalRootSha256);
const requiredAssets = ['hero-landscape.webp','app-icon.webp',...localeCodes.flatMap(code => ['home','saju','calendar'].map(screen => `app-${screen}-${code}.webp`))];
for (const asset of requiredAssets) {
  check(`provided brand asset ${asset}`,existsSync(`dist/brand/${asset}`));
  if (existsSync(`dist/brand/${asset}`)) check(`asset has content ${asset}`,statSync(`dist/brand/${asset}`).size > 200);
}
check('exactly 13 supported locales',localeCodes.length === 13);
const requiredKeys = Object.keys(locales.ko).sort().join('|');
const allTitles = new Set(); const allDescriptions = new Set();
for (const code of localeCodes) {
  const c=locales[code], html=read(`dist/app/${code}.html`);
  check(`complete schema ${code}`,Object.keys(c).sort().join('|') === requiredKeys);
  check(`no empty translated text ${code}`,!JSON.stringify(c).includes('""'));
  check(`correct document language ${code}`,html.includes(`<html lang="${code}">`));
  check(`localized title ${code}`,html.includes(`<title>${c.title}</title>`));
  check(`canonical ${code}`,html.includes(`<link rel="canonical" href="https://taerynex.com/app/${code}"`));
  check(`unique heading ${code}`,html.includes(c.headline[0]));
  check(`four features and relationships ${code}`,c.features.length === 4 && c.relationships.length === 4 && c.steps.length === 3 && c.faq.length === 5);
  check(`DOM readable sections ${code}`,['story','features','guide','support','join'].every(id => html.includes(`id="${id}"`)));
  check(`one h1 ${code}`,(html.match(/<h1\b/g)||[]).length === 1);
  check(`all reciprocal hreflang ${code}`,localeCodes.every(other => html.includes(`hreflang="${other}" href="https://taerynex.com/app/${other}"`)) && html.includes('hreflang="x-default"'));
  check(`localized real screen ${code}`,html.includes(`/brand/app-home-${code}.webp`) && html.includes(`/brand/app-saju-${code}.webp`) && html.includes(`/brand/app-calendar-${code}.webp`));
  check(`localized legal links ${code}`,html.includes(`href="/${code}.html"`) && html.includes(`href="/terms/${code}.html"`));
  check(`no public installation or restaurant links ${code}`,!/play\.google\.com|apps\.apple\.com|map\.naver|Restaurant|동해회|조개구이/.test(html));
  check(`no forms or birthday inputs ${code}`,!/<form\b|<input\b|<iframe\b/.test(html));
  check(`OG and description localized ${code}`,html.includes(`property="og:title" content="${c.title}"`) && html.includes(`property="og:locale"`));
  check(`English or localized copy, no Korean fallback ${code}`,code === 'ko' || !/[가-힣]/.test(c.headline.join('') + c.story.join('') + c.features.map(x=>x.detail).join('') + c.faq.flat().join('')));
  for (const href of html.matchAll(/(?:src|href)="(\/(?:assets|brand)\/[^"#]+)"/g)) check(`resolved asset ${code} ${href[1]}`,existsSync(`dist${href[1]}`));
  allTitles.add(c.title); allDescriptions.add(c.description);
}
check('13 distinct titles and descriptions',allTitles.size === 13 && allDescriptions.size === 13);
check('root Korean marketing, not privacy',read('dist/index.html').includes(locales.ko.headline[0]) && !read('dist/index.html').includes('policy-version'));
check('Google homepage /app/ remains English',read('dist/app/index.html') === read('dist/app/en.html'));
const known = new Set(['dist/index.html','dist/app/index.html','dist/404.html','dist/sw.js','dist/robots.txt','dist/sitemap.xml',...localeCodes.map(c=>`dist/app/${c}.html`),...Object.keys(integrity.files).map(f=>`dist/${f}`),...requiredAssets.map(f=>`dist/brand/${f}`)]);
for (const file of walk('dist')) check(`no unexpected public file ${file}`,known.has(file) || /^dist\/assets\/[\w-]+\.(js|css)$/.test(file));
const vercel=json('vercel.json');
check('static Vercel routing without SPA catch-all',vercel.cleanUrls === true && !vercel.rewrites && !vercel.redirects);
check('deployment output matches build',vercel.outputDirectory === 'dist' && vercel.buildCommand === 'npm run build');
finish('Marketing launch validation');
