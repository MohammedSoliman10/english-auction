import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDotEnv, parseDotEnv } from '../src/env';
import { loadDotEnvFile } from '../src/env';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'env-'));
  tempDirs.push(dir);
  const file = join(dir, '.env');
  writeFileSync(file, contents);
  return file;
}

describe('parseDotEnv — deploy.sh writes backend/.env (quickstart step 3)', () => {
  it('parses KEY=VALUE lines and skips comments/blanks/invalid lines', () => {
    const parsed = parseDotEnv(
      [
        '# Written by scripts/deploy.sh',
        '',
        'PORT=3000',
        'AUCTION_ADDRESS=0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
        'not a kv line',
        '=novalue',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      PORT: '3000',
      AUCTION_ADDRESS: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    });
  });

  it('strips surrounding quotes from values', () => {
    expect(parseDotEnv('CHAIN_NAME="English Auction Chain"\nX=\'quoted\'')).toEqual({
      CHAIN_NAME: 'English Auction Chain',
      X: 'quoted',
    });
  });
});

describe('applyDotEnv — existing environment wins (12-factor)', () => {
  it('sets only keys that are not already present', () => {
    const env: NodeJS.ProcessEnv = { PORT: '4000' };
    applyDotEnv({ PORT: '3000', CHAIN_ID: '2026' }, env);
    expect(env).toEqual({ PORT: '4000', CHAIN_ID: '2026' });
  });
});

describe('loadDotEnvFile — entry loads backend/.env before loadConfig', () => {
  it('reads and applies a real file', () => {
    const file = tempFile('AUCTION_ADDRESS=0xabc\ndeep=false\n');
    const env: NodeJS.ProcessEnv = {};
    loadDotEnvFile(file, env);
    expect(env).toEqual({ AUCTION_ADDRESS: '0xabc', deep: 'false' });
  });

  it('is a silent no-op when the file does not exist', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() => loadDotEnvFile(join(tmpdir(), 'definitely-missing.env'), env)).not.toThrow();
    expect(env).toEqual({});
  });
});
