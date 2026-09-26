#!/usr/bin/env node
// SC-006 bundle budget: fail if total gzipped JS+CSS exceeds budget (KB).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [distDir, budgetKb = '300'] = process.argv.slice(2);
const budget = Number(budgetKb) * 1024;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p;
  });
}

let total = 0;
const rows = [];
for (const file of walk(distDir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  rows.push([file.replace(distDir, '').replace(/^\//, ''), gz]);
}

for (const [name, gz] of rows.sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${(gz / 1024).toFixed(1).padStart(7)} KB gz  ${name}`);
}
console.log(`bundle: ${(total / 1024).toFixed(1)} KB gz / budget ${(budget / 1024).toFixed(0)} KB`);

if (total > budget) {
  console.error(`FAIL: bundle ${(total / 1024).toFixed(1)} KB exceeds budget ${(budget / 1024).toFixed(0)} KB`);
  process.exit(1);
}
