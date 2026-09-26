import { readFileSync } from 'node:fs';

/**
 * Minimal `.env` reader for `backend/.env` (written by `scripts/deploy.sh`,
 * consumed by the server entry before `loadConfig()` — quickstart step 3).
 *
 * Deliberately dependency-free: the file format is exactly what deploy.sh
 * emits (`KEY=VALUE`, `#` comments, blank lines). Existing environment
 * variables always win (12-factor), and a missing file is a no-op so the
 * process can be configured purely through the environment.
 */

/** Parse `.env` contents into a plain record (invalid lines are skipped). */
export function parseDotEnv(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const trimmed = rawValue.trim();
    const quoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2);
    result[key] = quoted ? trimmed.slice(1, -1) : trimmed;
  }
  return result;
}

/** Merge parsed pairs into `env` without overriding existing keys. */
export function applyDotEnv(parsed: Record<string, string>, env: NodeJS.ProcessEnv): void {
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) env[key] = value;
  }
}

/** Read `filePath` (if present) and apply it to `env`. Missing file: no-op. */
export function loadDotEnvFile(filePath: string, env: NodeJS.ProcessEnv = process.env): void {
  let contents: string;
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  applyDotEnv(parseDotEnv(contents), env);
}
