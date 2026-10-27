import { read, json, walk, reporter } from './check-utils.mjs';
import { frontendCiFindings } from './frontend-ci-check.mjs';
const {check,finish}=reporter();
const config=json('vercel.json');
const csp=config.headers.find(x=>x.source==='/(.*)').headers.find(x=>x.key==='Content-Security-Policy').value;
check('strict self-hosted script policy',csp.includes("script-src 'self'") && !/unsafe-inline|unsafe-eval|wasm-unsafe-eval|https:\/\/\*/.test(csp));
check('no unused remote connections',csp.includes("connect-src 'none'") && !csp.includes('supabase') && !csp.includes('google'));
check('no input forms or embedded frames',csp.includes("form-action 'none'") && csp.includes("frame-src 'none'") && csp.includes("frame-ancestors 'none'"));
check('environment loading disabled',read('vite.config.js').includes('envDir: false'));
const dependencies=Object.keys(json('package.json').dependencies);
check('only React public runtime',dependencies.length===2 && dependencies.includes('react') && dependencies.includes('react-dom'));
const activeFiles=walk('src');
check('restaurant UI archived outside active compilation',activeFiles.every(path=>path==='src/App.jsx' || path==='src/main.jsx' || path==='src/styles/marketing.css' || path.startsWith('src/marketing/')));
check('legacy archive excluded from Vercel uploads',read('.vercelignore').split(/\r?\n/).includes('legacy'));
check('frozen HTML disables Git newline conversion',read('.gitattributes').includes('public/*.html -text') && read('.gitattributes').includes('public/terms/*.html -text'));
const bundle=walk('dist/assets').filter(x=>x.endsWith('.js')).map(read).join('\n');
check('no restaurant, OCR or Supabase runtime in bundle',!/supabase\.co|edfrlptpeuhjsgxdfwke|tlrwsabbgbtdcsoayceg|tesseract|homepage_reviews|admin-review|map\.naver|조개구이|eulwangri/.test(bundle));
check('no fetch/XHR data collection in public source',!/(?:fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)/.test(read('src/App.jsx')+read('src/main.jsx')));
check('no unsafe HTML rendering',!read('src/App.jsx').includes('dangerouslySetInnerHTML'));
check('no new service worker registration',!read('src/main.jsx').includes('serviceWorker.register('));
const worker=read('public/sw.js');
check('retirement worker has no fetch interception',!worker.includes("addEventListener('fetch'"));
check('retirement worker scoped to legacy caches',worker.includes('/^donghae-homepage-v\\d+$/') && worker.includes('keys.filter(key => ownedCache.test(key))'));
check('retirement worker unregisters itself',worker.includes('self.registration.unregister()'));
for (const file of walk('.github/workflows')) {
  if (file === '.github/workflows/frontend-verification.yml') {
    for (const finding of frontendCiFindings()) check(`automated frontend CI: ${finding.name}`,finding.pass);
    continue;
  }
  const workflow=read(file);
  check(`manual-only legacy workflow ${file}`,workflow.includes('workflow_dispatch:') && !/^\s+(?:push|pull_request|schedule):/m.test(workflow));
  const jobs=[...workflow.matchAll(/^  (build|deploy|audit):\r?\n([\s\S]*?)(?=^  \w+:|$(?![\s\S]))/gm)];
  check(`all legacy jobs disabled ${file}`,jobs.length>0 && jobs.every(x=>x[2].includes('if: ${{ false }}')));
}
check('no executable inline scripts in marketing HTML',!/<script(?![^>]*\bsrc=)[^>]*>/.test(read('dist/app/ko.html')));
check('reduced-motion preference honored',read('src/styles/marketing.css').includes('@media(prefers-reduced-motion:reduce)'));
check('H10 cutover gate documented',read('README.md').includes('H10') && read('README.md').includes('Hobby') && read('README.md').includes('back up'));
finish('Marketing security validation');
