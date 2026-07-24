/**
 * ============================================================================
 * WORKSHOP PERFORMANCE TESTING SCRIPT
 * ============================================================================
 * 
 * Paste this into your browser console (F12) to run performance tests
 * 
 * Usage:
 * 1. Open the dashboard at http://localhost:5174/
 * 2. Open DevTools Console (F12)
 * 3. Copy and paste this entire file
 * 4. Run: testDashboardPerformance()
 * ============================================================================
 */

async function testDashboardPerformance() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   DASHBOARD PERFORMANCE TEST SUITE                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function assert(name, actual, expected, operator = '<=') {
    const passed = operator === '<=' ? actual <= expected : actual === expected;
    results.tests.push({ name, actual, expected, passed });
    
    if (passed) {
      console.log(`✅ ${name}: ${actual}ms (target: ${operator}${expected}ms)`);
      results.passed++;
    } else {
      console.error(`❌ ${name}: ${actual}ms (target: ${operator}${expected}ms)`);
      results.failed++;
    }
  }

  // Test 1: Memory Usage
  console.log('\n📊 Test 1: Memory Usage Check');
  console.log('─────────────────────────────');
  if (performance.memory) {
    const usedMemoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const totalMemoryMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    console.log(`   Memory Used: ${usedMemoryMB}MB / ${totalMemoryMB}MB`);
    
    const memoryUnderLimit = performance.memory.usedJSHeapSize < (200 * 1024 * 1024);
    results.tests.push({ 
      name: 'Memory Usage', 
      actual: `${usedMemoryMB}MB`, 
      expected: '<200MB', 
      passed: memoryUnderLimit 
    });
    
    if (memoryUnderLimit) {
      console.log('   ✅ Memory usage within acceptable limits');
      results.passed++;
    } else {
      console.error('   ❌ Memory usage too high');
      results.failed++;
    }
  }

  // Test 2: Network Activity
  console.log('\n🌐 Test 2: Network Activity Check');
  console.log('─────────────────────────────');
  
  const perfEntries = performance.getEntriesByType('resource');
  const parquetLoads = perfEntries.filter(e => e.name.includes('flood_control.parquet'));
  
  console.log(`   Total Resource Loads: ${perfEntries.length}`);
  console.log(`   Parquet File Loads: ${parquetLoads.length}`);
  
  if (parquetLoads.length === 1) {
    console.log('   ✅ Parquet file loaded exactly once (cached)');
    results.passed++;
  } else if (parquetLoads.length > 1) {
    console.error('   ⚠️  Parquet file loaded multiple times');
    results.failed++;
  }

  // Test 3: Simulated Query Performance
  console.log('\n⚡ Test 3: Query Performance Simulation');
  console.log('─────────────────────────────');
  console.log('   Run manual tests by:');
  console.log('   1. Click any region filter');
  console.log('   2. Watch console for "[Query] ✓ Completed in Xms"');
  console.log('   3. Verify duration < 100ms');
  console.log('');
  console.log('   Expected performance:');
  console.log('   - Simple queries: <50ms ⚡');
  console.log('   - Aggregations: <100ms ⚡');
  console.log('   - Complex queries: <500ms');

  // Test 4: DOM Performance
  console.log('\n🎨 Test 4: Rendering Performance');
  console.log('─────────────────────────────');
  
  const paintEntries = performance.getEntriesByType('paint');
  const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
  
  if (fcp) {
    assert('First Contentful Paint', fcp.startTime, 2000, '<=');
  } else {
    console.log('   ⚠️  Paint metrics not available');
  }

  // Test 5: Filter State in URL
  console.log('\n🔗 Test 5: URL State Persistence');
  console.log('─────────────────────────────');
  
  const currentUrl = new URL(window.location.href);
  const hasFilters = currentUrl.searchParams.toString().length > 0;
  
  if (hasFilters) {
    console.log(`   ✅ Filters found in URL: ${currentUrl.searchParams.toString()}`);
    console.log('   URL is shareable and bookmarkable!');
    results.passed++;
  } else {
    console.log('   ℹ️  No active filters (apply filters to test)');
    console.log('   Try clicking a region, then check URL again');
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   Total: ${results.tests.length}`);
  console.log('');

  if (results.failed === 0) {
    console.log('   🎉 ALL TESTS PASSED!');
    console.log('   Your dashboard meets production performance standards!');
  } else {
    console.log('   ⚠️  Some tests failed. Review the details above.');
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          INTERACTIVE PERFORMANCE TESTING                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Try these manual tests:');
  console.log('');
  console.log('1. FILTER UPDATE SPEED:');
  console.log('   → Click any region filter');
  console.log('   → Watch console: "[Query] ✓ Completed in Xms"');
  console.log('   → Target: <100ms ⚡');
  console.log('');
  console.log('2. NETWORK ACTIVITY:');
  console.log('   → Open Network tab in DevTools');
  console.log('   → Apply multiple filters');
  console.log('   → Verify: 0 new requests (all cached!)');
  console.log('');
  console.log('3. CHART INTERACTION:');
  console.log('   → Click a bar in the chart');
  console.log('   → Dashboard should filter instantly');
  console.log('   → URL should update with filter params');
  console.log('');
  console.log('4. SHARE URL:');
  console.log('   → Apply filters');
  console.log('   → Copy URL from address bar');
  console.log('   → Open in new tab/incognito');
  console.log('   → Filters should be preserved!');
  console.log('');

  return results;
}

// Auto-run test suite
console.log('Performance test suite loaded!');
console.log('Run: testDashboardPerformance()');
console.log('');

// Export to window for easy access
window.testDashboardPerformance = testDashboardPerformance;
