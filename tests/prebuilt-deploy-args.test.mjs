import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('ops/deploy-prebuilt-hales-ai.sh'), source = readFileSync(script, 'utf8');
const syntax = spawnSync('bash', ['-n', script], { encoding: 'utf8' }); assert.equal(syntax.status, 0, syntax.stderr);
const remote = source.split("<<'REMOTE_SCRIPT'\n")[1]?.split('\nREMOTE_SCRIPT')[0]; assert.ok(remote);
const remoteSyntax = spawnSync('bash', ['-n'], { input: remote, encoding: 'utf8' }); assert.equal(remoteSyntax.status, 0, remoteSyntax.stderr);
const root = mkdtempSync(path.join(tmpdir(), 'hales-prebuilt-args-')), marker = path.join(root, 'unexpected-command');
try {
  // A missing/invalid explicit choice must stop before Git, build or remote work.
  for (const tool of ['git', 'npm', 'npx', 'ssh', 'scp']) {
    const file = path.join(root, tool); writeFileSync(file, '#!/bin/sh\n: > "$PREFLIGHT_TEST_MARKER"\nexit 91\n'); chmodSync(file, 0o755);
  }
  const required = ['--release-commit', 'a'.repeat(40), '--page-sha256', 'b'.repeat(64)];
  const cases = [[], required, [...required, '--account-sessions'], [...required, '--account-sessions', '--apply'], ...['', 'TRUE', 'yes', '0', '1'].map(value => [...required, '--account-sessions', value]), [...required, '--account-sessions', 'true', '--account-sessions', 'false']];
  for (const args of cases) {
    const result = spawnSync('bash', [script, ...args], { encoding: 'utf8', env: { ...process.env, PATH: root + path.delimiter + process.env.PATH, PREFLIGHT_TEST_MARKER: marker, VITE_CUPCAKE_ACCOUNT_SESSIONS: 'true' } });
    assert.equal(result.status, 2, JSON.stringify({ args, stdout: result.stdout, stderr: result.stderr }));
    assert.match(result.stdout, /--account-sessions/); assert.equal(existsSync(marker), false);
  }
  console.log(`PASS: local/remote shell syntax and ${cases.length} missing/invalid account-session argument cases stop before Git/build/remote actions, even with inherited enabled mode.`);
} finally { rmSync(root, { recursive: true, force: true }); }
