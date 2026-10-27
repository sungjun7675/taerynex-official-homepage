import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { h10CutoverGateDocumented } from '../scripts/security-check.mjs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const waiver = 'Explicitly waived by CEO for project edfrlptpeuhjsgxdfwke; H7 retirement already executed';

test('H10 accepts the recorded CEO approval and completed-H7 backup waiver', () => {
  assert.equal(h10CutoverGateDocumented(readme), true);
  // Prose wrapping and checkout line endings do not change the policy state.
  assert.equal(h10CutoverGateDocumented(readme.replaceAll('\n', '\r\n')), true);
});

test('H10 fails closed for unknown approval, false waiver and missing restrictions', async t => {
  const cases = [
    ['unknown current approval', 'Explicitly approved by CEO', 'Approval unknown'],
    ['unapproved replacement', 'Explicitly approved by CEO', 'Not approved by CEO'],
    ['future blanket approval', 'Explicit CEO authorization required', 'No further CEO authorization required'],
    ['paid hosting change', 'Existing Vercel Hobby; no paid upgrade', 'Vercel Pro upgrade approved'],
    ['compliance inferred from deployment', 'Disclosed; deployment does not establish compliance', 'Deployment proves compliance'],
    ['unknown waiver', waiver, waiver.replace('Explicitly waived by CEO', 'Waiver unknown')],
    ['agent-granted waiver', waiver, waiver.replace('CEO', 'engineer')],
    ['waiver expanded beyond retired data', waiver, 'Explicitly waived by CEO for all future production data'],
  ];
  for (const [name, before, after] of cases) {
    await t.test(name, () => {
      const changed = readme.replace(before, after);
      assert.notEqual(changed, readme);
      assert.equal(h10CutoverGateDocumented(changed), false);
    });
  }
  await t.test('missing restriction acknowledgment', () => {
    assert.equal(h10CutoverGateDocumented(readme.replace(/^\| Hobby commercial-use restriction .*\r?\n/m, '')), false);
  });
});

test('H10 binds the waiver exclusively to the retired website project', async t => {
  const row = `| Old restaurant backups | ${waiver} |`;
  const wrongTarget = row.replace('edfrlptpeuhjsgxdfwke', 'aaaaaaaaaaaaaaaaaaaa');
  const protectedTarget = row.replace('edfrlptpeuhjsgxdfwke', 'tlrwsabbgbtdcsoayceg');
  const cases = [
    ['missing project target', row.replace(' for project edfrlptpeuhjsgxdfwke', '')],
    ['wrong project target', wrongTarget],
    ['protected app target', protectedTarget],
    ['missing project disposition', ''],
    ['duplicate conflicting project dispositions', `${row}\n${wrongTarget}`],
    ['duplicate disposition targeting protected app', `${row}\n${protectedTarget}`],
  ];
  assert.ok(readme.includes(row));
  for (const [name, replacement] of cases) {
    await t.test(name, () => {
      const changed = readme.replace(row, replacement);
      assert.notEqual(changed, readme);
      // Existing project IDs elsewhere in README cannot supply waiver scope.
      assert.equal(h10CutoverGateDocumented(changed), false);
    });
  }
});

test('H10 rejects unrelated evidence and duplicate contradictory dispositions', () => {
  assert.equal(h10CutoverGateDocumented('H10 Hobby back up'), false);
  assert.equal(h10CutoverGateDocumented(readme.replace('## H10', '## Historical H10')), false);
  const outsideH10 = readme.replace(/(## H10[^\n]*\n)/, '$1\n## Unrelated policy\n');
  assert.equal(h10CutoverGateDocumented(outsideH10), false);
  const conflicting = readme.replace('| Current replacement | Explicitly approved by CEO |',
    '| Current replacement | Explicitly approved by CEO |\n| Current replacement | Approval unknown |');
  assert.equal(h10CutoverGateDocumented(conflicting), false);
});
