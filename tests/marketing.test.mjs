import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createPreviewServer } from '../scripts/preview-marketing.mjs';
import { locales, localeCodes } from '../src/marketing/locales.js';

test('retirement deletes only the exact legacy cache namespace and unregisters',async()=>{
  const handlers={},deleted=[];
  let unregistered=0;
  const caches=['donghae-homepage-v7','donghae-homepage-v1','other-app-v2','taerynex-app-v7','donghae-homepage-v7-other','other-donghae-homepage-v7','donghae-homepage-v'];
  const sandbox={self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},registration:{unregister:async()=>{unregistered++;}}},caches:{keys:async()=>caches,delete:async key=>{deleted.push(key);}}};
  vm.runInNewContext(await readFile('public/sw.js','utf8'),sandbox);
  let task; handlers.activate({waitUntil:promise=>{task=promise;}}); await task;
  assert.deepEqual(deleted,['donghae-homepage-v7','donghae-homepage-v1']);
  assert.equal(unregistered,1); assert.equal(handlers.fetch,undefined);
});

test('local static route contract: all locale, legal and negative routes',async t=>{
  const server=createPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=path=>fetch(base+path);
  const integrity=JSON.parse(await readFile('docs/legal-integrity.json','utf8'));
  const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
  for(const code of localeCodes) {
    await t.test(`marketing and same-locale links: ${code}`,async()=>{
      for(const suffix of [code,`${code}.html`]) {
        const response=await get(`/app/${suffix}`);
        assert.equal(response.status,200);
        const html=await response.text();
        assert.ok(html.includes(`<html lang="${code}">`)); assert.ok(html.includes(locales[code].headline[0]));
        assert.ok(html.includes(`href="/${code}.html"`)); assert.ok(html.includes(`href="/terms/${code}.html"`));
      }
    });
    await t.test(`exact legal bodies through both URL forms: ${code}`,async()=>{
      for(const prefix of ['', 'terms/']) for(const extension of ['.html','']) {
        const response=await get(`/${prefix}${code}${extension}`);
        assert.equal(response.status,200);
        assert.equal(digest(Buffer.from(await response.arrayBuffer())),integrity.files[`${prefix}${code}.html`]);
        assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      }
    });
  }
  for(const path of ['/admin','/admin/login','/menu','/reviews','/reservation','/unknown','/app/unknown','/_headers','/.env','/supabase/config.toml','/og-hero-cinematic.jpg','/manifest.webmanifest']) {
    const response=await get(path); assert.equal(response.status,404,path); assert.ok(!(await response.text()).includes('조개구이'));
  }
  for(const [path,code] of [['/','ko'],['/app/','en'],['/app','en']]) {
    const response=await get(path); assert.equal(response.status,200); assert.ok((await response.text()).includes(locales[code].headline[0]));
  }
  const proof=await get('/google2233132a77c14ffe.html'); assert.equal(proof.status,200); assert.equal(digest(Buffer.from(await proof.arrayBuffer())),integrity.files['google2233132a77c14ffe.html']);
  assert.equal((await get('/sw.js')).headers.get('cache-control'),'no-store, max-age=0');
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});
