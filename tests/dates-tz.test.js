// Runs the midnight tests again in timezones with DST and large offsets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('./dates.test.js', import.meta.url));
for (const tz of ['America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata', 'Europe/London']) {
  test(`date tests pass in ${tz}`, () => {
    execFileSync(process.execPath, ['--test', file], { env: { ...process.env, TZ: tz }, stdio: 'pipe' });
    assert.ok(true);
  });
}
