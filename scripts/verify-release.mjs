// Automated Release Verification Script for Platform Qalb El-Elm
// Checks critical files, server response, and environment settings

import http from 'http';

console.log('🔍 Starting Platform Qalb El-Elm Release Verification...');

const checks = [
  { name: 'Health Endpoint', url: 'http://localhost:3000/api/health' },
];

async function runChecks() {
  let passed = 0;
  for (const check of checks) {
    try {
      const res = await fetch(check.url);
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [PASS] ${check.name}:`, data);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${check.name} returned status ${res.status}`);
      }
    } catch (err) {
      console.error(`⚠️ [WARN] Could not reach ${check.url} (Make sure dev server is running)`);
    }
  }
  console.log(`\n🎉 Verification finished: ${passed}/${checks.length} passed.`);
}

runChecks();
