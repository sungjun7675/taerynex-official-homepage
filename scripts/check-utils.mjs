import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
export const read = path => readFileSync(path,'utf8');
export const json = path => JSON.parse(read(path));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export function walk(path) { return readdirSync(path,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(join(path,entry.name)) : [join(path,entry.name).replaceAll('\\','/')]); }
export function reporter() {
  let count = 0; const failures = [];
  return {
    check(name,condition) { count++; if (!condition) failures.push(name); },
    finish(label) { for (const failure of failures) console.error(`FAIL: ${failure}`); console.log(`${label}: ${count-failures.length}/${count} checks passed${failures.length ? `; ${failures.length} FAILED` : ''}`); if (failures.length) process.exitCode = 1; },
  };
}
