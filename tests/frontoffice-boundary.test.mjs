import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const frozen = fs.readFileSync('app/lib/route2own.ts', 'utf8');
const nextConfig = fs.readFileSync('next.config.ts', 'utf8');

test('route2own.ts remains a pure frozen re-export', () => {
  assert.match(frozen, /FINAL \/ FROZEN FOR COMPETITION/);
  assert.match(frozen, /from "\.\.\/\.\.\/public\/route2own-engine\.js"/);
  assert.doesNotMatch(frozen, /function\s+scoreRoute2Own/);
});

test('root no longer rewrites over the Next registration entry', () => {
  assert.doesNotMatch(nextConfig, /source:\s*["']\/["'].*route2own\.html/s);
});

test('the frozen standalone front office stays reachable as a static asset', () => {
  assert.ok(fs.existsSync('public/route2own.html'), '/route2own.html must remain published');
  const html = fs.readFileSync('public/route2own.html', 'utf8');
  assert.match(html, /FINAL \/ FROZEN FOR COMPETITION/);
});

function sourceFiles(dir, exts = /\.(ts|tsx|mjs|sql)$/) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .map((p) => `${dir}/${p}`)
    .filter((p) => exts.test(p) && fs.statSync(p).isFile());
}

test('this repository stays System A — no post-approval implementation', () => {
  // System B (Post-Approval Operational Digital Twin) ต้องไม่ถูกนำเข้ามาใน repository นี้
  // ตรวจที่ระดับโค้ด (identifier / ตาราง / เส้นทาง API) ไม่ใช่ข้อความอธิบายขอบเขต
  // ประโยคที่ "ประกาศว่าสิ่งนั้นอยู่นอกระบบนี้" ต้องเขียนได้ ไม่ใช่ความผิด
  const declarations = [
    /\b(?:function|const|let|class|type|interface|enum)\s+\w*(?:childElg|microSweep|actualSweep|dpd|controlTower|promptCure|debtLedger|claimCase|recovery)\w*/i,
    /create\s+table\s+\w*(?:child_elg|sweep|dpd|debt_ledger|claim|recovery|control_tower)\w*/i,
    /export\s+(?:async\s+)?function\s+\w*(?:Sweep|Dpd|Claim|Recovery|Cure)\w*/
  ];

  for (const file of [...sourceFiles('app'), ...sourceFiles('components'), ...sourceFiles('db')]) {
    const body = fs.readFileSync(file, 'utf8');
    for (const pattern of declarations) {
      assert.doesNotMatch(body, pattern, `${file} must not implement a post-approval concept: ${pattern}`);
    }
  }
});

test('no post-approval API surface exists in this repository', () => {
  const routes = sourceFiles('app/api')
    .filter((p) => p.endsWith('route.ts'))
    .map((p) => p.replace(/^app/, '').replace(/\/route\.ts$/, ''));

  for (const route of routes) {
    assert.doesNotMatch(
      route,
      /(sweep|payd-actual|dpd|ledger|claim|recovery|cure|control-tower|child-elg)/i,
      `API route ${route} belongs to System B, not this Front Office`
    );
  }
});
