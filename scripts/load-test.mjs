// Load Test Script for Platform Qalb El-Elm
// Simulates concurrent users accessing health check and student APIs

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = 50;

async function runTest() {
  console.log(`🚀 Starting load test on ${BASE_URL} with ${CONCURRENT_REQUESTS} requests...`);
  const start = Date.now();
  let success = 0;
  let failure = 0;

  const requests = Array.from({ length: CONCURRENT_REQUESTS }, async (_, i) => {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        success++;
      } else {
        failure++;
      }
    } catch (err) {
      failure++;
    }
  });

  await Promise.all(requests);
  const duration = (Date.now() - start) / 1000;
  console.log(`✅ Completed in ${duration.toFixed(2)}s: Success: ${success}, Failed: ${failure}`);
}

runTest();
