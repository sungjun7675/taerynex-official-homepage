import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { locales, localeCodes } from '../src/marketing/locales.js';

export const origin = 'https://taerynex.com';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const ogLocales = { ko:'ko_KR', en:'en_US', ja:'ja_JP', 'zh-Hans':'zh_CN', 'zh-Hant':'zh_TW', es:'es_ES', pt:'pt_BR', fr:'fr_FR', de:'de_DE', id:'id_ID', th:'th_TH', vi:'vi_VN', hi:'hi_IN' };
const template = await readFile('dist/index.html', 'utf8');
if (!template.includes('<!-- marketing:metadata -->') || !template.includes('<div id="root"></div>')) throw new Error('Missing prerender template markers');
const server = await createServer({ configFile: resolve('vite.config.js'), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  for (const locale of localeCodes) {
    const c = locales[locale];
    const canonical = `${origin}/app/${locale}`;
    const metadata = [
      `<meta name="description" content="${escape(c.description)}" />`,
      '<meta name="robots" content="index,follow,max-image-preview:large" />',
      `<link rel="canonical" href="${canonical}" />`,
      ...localeCodes.map(code => `<link rel="alternate" hreflang="${code}" href="${origin}/app/${code}" />`),
      `<link rel="alternate" hreflang="x-default" href="${origin}/app/en" />`,
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="TAERYNEX" />',
      `<meta property="og:locale" content="${ogLocales[locale]}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      `<meta property="og:title" content="${escape(c.title)}" />`,
      `<meta property="og:description" content="${escape(c.description)}" />`,
      `<meta property="og:image" content="${origin}/brand/hero-landscape.webp" />`,
      `<meta property="og:image:alt" content="${escape(c.eyebrow)}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${escape(c.title)}" />`,
      `<meta name="twitter:description" content="${escape(c.description)}" />`,
      `<meta name="twitter:image" content="${origin}/brand/hero-landscape.webp" />`,
      '<link rel="preload" href="/brand/hero-landscape.webp" as="image" fetchpriority="high" />',
    ].join('\n    ');
    const body = renderToString(createElement(App, { locale }));
    const html = template.replace('<html lang="ko">', `<html lang="${locale}">`).replace('<!-- marketing:metadata -->', metadata).replace(/<title>.*?<\/title>/, `<title>${escape(c.title)}</title>`).replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
    const routes = [`app/${locale}.html`];
    if (locale === 'ko') routes.push('index.html');
    if (locale === 'en') routes.push('app/index.html');
    for (const route of routes) { const path = resolve('dist', route); await mkdir(dirname(path), { recursive: true }); await writeFile(path, html); }
  }
  const urls = localeCodes.map(code => `<url><loc>${origin}/app/${code}</loc>${localeCodes.map(other => `<xhtml:link rel="alternate" hreflang="${other}" href="${origin}/app/${other}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/app/en"/></url>`).join('\n');
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  // Real unknown routes must not silently render a marketing or legacy admin page.
  await writeFile('dist/404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/brand/app-icon.webp"><title>Page not found | TAERYNEX</title><body><main><h1>404 — Page not found</h1><p>TAERYNEX</p><a href="/app/en">English</a> · <a href="/app/ko" lang="ko">한국어</a></main></body></html>');
  console.log(`Prerendered ${localeCodes.length} complete localized pages + Korean root + English /app/. Legal files untouched.`);
} finally { await server.close(); }
