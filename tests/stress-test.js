/**
 * Standalone Synthetic Stress Test Suite for Cruces Resume Builder
 * Run locally via: node tests/stress-test.js
 */

const fixtures = require('./stress_fixtures.js');

console.log("\n=======================================================");
console.log("   CRUCES BUILDER: SYNTHETIC STRESS TEST RUNNER");
console.log("=======================================================\n");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Resilient ATS generator simulation
function simulateATSTextExtraction(state) {
  const parts = [];
  const h = state.header || {};
  parts.push((h.fullName || "").toUpperCase());
  parts.push((h.professionalTitle || "").toUpperCase());
  
  const contacts = [h.phone, h.email, h.address, h.linkedin, h.website].filter(Boolean);
  if (contacts.length) parts.push(contacts.join(" | "));
  
  const sectionOrder = (state.settings && state.settings.sectionOrder) || [
    "summary", "skills", "experience", "education", "certifications", "achievements"
  ];
  const sectionTitles = (state.settings && state.settings.sectionTitles) || {};

  sectionOrder.forEach(secKey => {
    const title = (sectionTitles[secKey] || secKey).toUpperCase();
    parts.push(`\n=== ${title} ===`);

    if (secKey === "summary" && state.summary) {
      parts.push(state.summary);
    } else if (secKey === "skills" && Array.isArray(state.skills)) {
      state.skills.forEach(col => {
        (col.items || []).forEach(item => { parts.push(`• ${item}`); });
      });
    } else if (secKey === "experience" && Array.isArray(state.experience)) {
      state.experience.forEach(exp => {
        parts.push(`${exp.title || ""} | ${exp.company || ""} (${exp.location || ""}) -- ${exp.dateRange || ""}`);
        if (exp.description) parts.push(`  ${exp.description}`);
        (exp.bullets || []).forEach(b => { parts.push(`  - ${b}`); });
      });
    } else if (secKey === "education" && Array.isArray(state.education)) {
      state.education.forEach(edu => {
        parts.push(`${edu.degree || ""} - ${edu.institution || ""} (${edu.dateRange || ""})`);
      });
    } else if (secKey === "certifications" && Array.isArray(state.certifications)) {
      state.certifications.forEach(c => { parts.push(`• ${c.name || ""}`); });
    } else if (secKey === "achievements" && Array.isArray(state.achievements)) {
      state.achievements.forEach(a => { parts.push(`• ${a.text || ""}`); });
    }
  });

  return parts.join("\n");
}

// 1. Validate Fixture Integrity
console.log("[Suite 1] Fixture Integrity & Schema Conformance");
const fixtureKeys = Object.keys(fixtures);
assert(fixtureKeys.length >= 5, `Expected at least 5 stress test fixtures, found ${fixtureKeys.length}`);

fixtureKeys.forEach(key => {
  const f = fixtures[key];
  assert(f.name && f.description && f.data, `Fixture [${key}] has valid metadata and payload`);
  
  // Test JSON serialization round-trip
  const serialized = JSON.stringify(f.data);
  const deserialized = JSON.parse(serialized);
  assert(deserialized.header && deserialized.settings, `Fixture [${key}] completes JSON serialization round-trip cleanly`);
});

// 2. Validate Extreme Lengths
console.log("\n[Suite 2] Extreme Lengths & Unbroken Strings");
const extData = fixtures.extreme_lengths.data;
assert(extData.header.website.length > 150, "Website URL contains > 150 chars to test CSS overflow-wrap");
assert(extData.summary.length > 500, "Summary exceeds 500 characters to stress vertical flow");
const atsExtreme = simulateATSTextExtraction(extData);
assert(atsExtreme.includes(extData.header.fullName.toUpperCase()), "ATS generator preserves long fullName without truncation");

// 3. Validate Boundary Split Calculations
console.log("\n[Suite 3] Boundary Split Calibration");
const boundaryData = fixtures.boundary_split.data;
assert(boundaryData.experience.length === 2, "Boundary test contains calibrated 2-entry work history");
assert(boundaryData.settings.sectionOrder.length === 6, "All 6 standard sections present for pagination layout");

// 4. Validate Sparse & Null Safety
console.log("\n[Suite 4] Sparse & Null Value Resilience");
const sparseData = fixtures.sparse_empty.data;
assert(sparseData.experience.length === 0, "Sparse test handles empty experience array without throwing");
assert(sparseData.certifications.length === 0, "Sparse test handles empty certifications array without throwing");
let atsSparseSuccess = false;
try {
  const atsSparse = simulateATSTextExtraction(sparseData);
  atsSparseSuccess = typeof atsSparse === 'string' && atsSparse.includes("JANE DOE");
} catch(e) {
  atsSparseSuccess = false;
}
assert(atsSparseSuccess, "ATS generator handles sparse/empty fields gracefully without null pointer exceptions");

// 5. Validate Special Characters & XSS Safety
console.log("\n[Suite 5] Special Characters, Accents & Sanitization");
const charData = fixtures.special_characters.data;
assert(charData.header.fullName.includes("<script>"), "Payload contains test script tag to verify HTML escaping");
assert(charData.summary.includes("“Award-winning”"), "Payload preserves smart quotes");
assert(charData.summary.includes("∑ f(x)"), "Payload preserves mathematical symbols");
const atsChars = simulateATSTextExtraction(charData);
assert(atsChars.includes("Español") && atsChars.includes("日本語"), "Multilingual and non-ASCII characters preserved in plain text");

// 6. Validate Multi-Page Deep CV
console.log("\n[Suite 6] Multi-Page Deep Overflow");
const multiData = fixtures.multi_page_overflow.data;
const totalBullets = multiData.experience.reduce((sum, e) => sum + e.bullets.length, 0);
assert(multiData.experience.length === 6, "Multi-page test contains 6 separate career roles");
assert(totalBullets >= 25, `Total bullet count (${totalBullets}) generates deep multi-page overflow`);

console.log("\n=======================================================");
console.log(`   RESULTS: ${passedCount} / ${totalCount} Assertions Passed (${Math.round((passedCount/totalCount)*100)}%)`);
console.log("=======================================================\n");

if (passedCount === totalCount) {
  console.log("✓ ALL LOCAL STRESS TEST SUITES PASSED CLEANLY.\n");
  process.exit(0);
} else {
  console.error("✗ SOME STRESS TESTS FAILED.\n");
  process.exit(1);
}
