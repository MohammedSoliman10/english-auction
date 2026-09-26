#!/usr/bin/env node
// Coverage gate for lcov reports (forge coverage) — constitution III:
// >= minLines% line coverage, >= minBranches% branch coverage.
import { readFileSync } from 'node:fs';

const [lcovPath, minLines = '95', minBranches = '90'] = process.argv.slice(2);

let raw;
try {
  raw = readFileSync(lcovPath, 'utf8');
} catch (err) {
  console.error(`coverage-check: cannot read ${lcovPath}: ${err.message}`);
  process.exit(1);
}

let lf = 0,
  lh = 0,
  brf = 0,
  brh = 0;
for (const line of raw.split('\n')) {
  if (line.startsWith('LF:')) lf += Number(line.slice(3));
  else if (line.startsWith('LH:')) lh += Number(line.slice(3));
  else if (line.startsWith('BRF:')) brf += Number(line.slice(4));
  else if (line.startsWith('BRH:')) brh += Number(line.slice(4));
}

const linePct = lf === 0 ? 0 : (lh / lf) * 100;
const branchPct = brf === 0 ? 0 : (brh / brf) * 100;

console.log(
  `contracts/src coverage: lines ${lh}/${lf} (${linePct.toFixed(2)}%), ` +
    `branches ${brh}/${brf} (${branchPct.toFixed(2)}%)`,
);

const lineMin = Number(minLines);
const branchMin = Number(minBranches);
let failed = false;
if (linePct < lineMin) {
  console.error(`FAIL: line coverage ${linePct.toFixed(2)}% < ${lineMin}%`);
  failed = true;
}
if (branchPct < branchMin) {
  console.error(`FAIL: branch coverage ${branchPct.toFixed(2)}% < ${branchMin}%`);
  failed = true;
}
process.exit(failed ? 1 : 0);
