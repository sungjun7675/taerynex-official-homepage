import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The frontend .yml intentionally uses JSON, a YAML subset, so this contract
// can parse its actual structure without adding a dependency or local service.
export function frontendCiFindings() {
  const source = readFileSync('.github/workflows/frontend-verification.yml', 'utf8');
  const workflow = JSON.parse(source);
  const findings = [];
  const check = (name, ok) => findings.push({ name, pass: Boolean(ok) });
  check('read-only repository permission', JSON.stringify(workflow.permissions) === '{"contents":"read"}');
  const paths = ['src/**', 'public/**', 'scripts/**', 'tests/**', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'vercel.json', '.gitattributes', '.vercelignore', '.github/workflows/**', 'docs/legal-integrity.json'];
  for (const event of ['push', 'pull_request']) check(`automatic ${event} covers frontend inputs`, paths.every(path => workflow.on?.[event]?.paths?.includes(path)) && !workflow.on[event].branches);
  check('no privileged event or workflow environment', Object.keys(workflow.on).every(key => ['push', 'pull_request', 'workflow_dispatch'].includes(key)) && !workflow.env);
  check('single enabled verification job', Object.keys(workflow.jobs).length === 1 && workflow.jobs.verify && !Object.hasOwn(workflow.jobs.verify, 'if'));
  const job = workflow.jobs.verify;
  check('bounded hosted runner without deployment environment', job['runs-on'] === 'ubuntu-latest' && job['timeout-minutes'] === 15 && !job.environment && !job.permissions && !job.env);
  const steps = job.steps;
  check('existing trusted actions only', steps.filter(step => step.uses).map(step => step.uses).join('|') === 'actions/checkout@v4|actions/setup-node@v4');
  check('checkout does not persist credentials', steps.find(step => step.uses === 'actions/checkout@v4')?.with?.['persist-credentials'] === false);
  check('existing Node 22 toolchain', steps.find(step => step.uses === 'actions/setup-node@v4')?.with?.['node-version'] === 22);
  const expectedCommands = ['npm ci --ignore-scripts --no-audit --no-fund', 'node scripts/frontend-ci-check.mjs', 'npm run build', 'npm run launch:check', 'npm run security:check', 'npm run security:headers', 'npm test', 'npm audit --omit=dev --audit-level=moderate'];
  check('only ordered frontend checks, no deployment commands', JSON.stringify(steps.filter(step => step.run).map(step => step.run)) === JSON.stringify(expectedCommands));
  check('no secrets, publishing, conditional skips or ignored failures', !/secrets\.|pull_request_target|vercel deploy|supabase|deploy-pages|pages:|id-token:/.test(source) && steps.every(step => !step.env && !step.if && !step['continue-on-error']));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  check('all referenced npm scripts exist', ['build', 'launch:check', 'security:check', 'security:headers', 'test'].every(script => typeof pkg.scripts[script] === 'string'));
  for (const file of ['deploy-pages.yml', 'deploy-supabase-security.yml', 'security-audit.yml']) {
    const legacy = readFileSync(`.github/workflows/${file}`, 'utf8');
    const jobs = [...legacy.matchAll(/^  (build|deploy|audit):\r?\n([\s\S]*?)(?=^  \w+:|$(?![\s\S]))/gm)];
    check(`legacy remains manual and disabled: ${file}`, legacy.includes('workflow_dispatch:') && !/^\s+(?:push|pull_request|schedule):/m.test(legacy) && jobs.length > 0 && jobs.every(match => match[2].includes('if: ${{ false }}')));
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = frontendCiFindings();
  for (const {name, pass} of findings) console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}`);
  console.log(`Frontend CI contract: ${findings.filter(item => item.pass).length}/${findings.length} checks passed; GitHub-hosted execution NOT RUN`);
  if (findings.some(item => !item.pass)) process.exitCode = 1;
}
