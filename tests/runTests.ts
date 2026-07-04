import assert from "node:assert/strict";
import { recordApprovalAudit, recordMappingReview } from "../src/audit/auditService";
import { demoSnapshot } from "../src/data/demoSnapshot";
import { buildForecastScenario, recommendCashActions } from "../src/forecast/forecastEngine";
import {
  buildEntityMatches,
  normaliseCompanyName,
  similarity
} from "../src/mapping/smartMappingService";
import { buildRevenueOpportunities } from "../src/revenue/opportunityEngine";

function testSmartMapping() {
  assert.equal(normaliseCompanyName("Brightside Studio Ltd"), "brightside studio");
  assert.ok(similarity("Brightside Studio Ltd", "Brightside Studios") >= 0.86);

  const matches = buildEntityMatches(demoSnapshot);
  const brightsideMatch = matches.find((match) => match.externalRecordId === "CRM-DEAL-6500");

  assert.ok(brightsideMatch, "Brightside CRM deal should produce a smart mapping candidate");
  assert.equal(brightsideMatch.xeroContactId, "contact-bright");
  assert.ok(brightsideMatch.confidence >= 0.86);
  assert.deepEqual(brightsideMatch.sourceRecordIds, ["CRM-DEAL-6500", "contact-bright"]);
}

function testRevenueLeakDetection() {
  const matches = buildEntityMatches(demoSnapshot);
  const opportunities = buildRevenueOpportunities(demoSnapshot, matches);
  const closedWonLeak = opportunities.find((opportunity) => opportunity.type === "closed_won_not_invoiced");

  assert.ok(closedWonLeak, "Closed-won CRM deal without a matching Xero invoice should become a recommendation");
  assert.equal(closedWonLeak.contactId, "contact-bright");
  assert.equal(closedWonLeak.expectedRevenueImpact, 6500);
  assert.ok(closedWonLeak.evidence.some((item) => item.includes("CRM-DEAL-6500")));
}

function testForecastAndActions() {
  const baseline = buildForecastScenario(demoSnapshot, "Test baseline", {
    horizonDays: 30,
    monteCarloRuns: 40
  });
  const actions = recommendCashActions(demoSnapshot, baseline);
  const afterActions = buildForecastScenario(demoSnapshot, "Test after actions", {
    actions,
    horizonDays: 30,
    monteCarloRuns: 40
  });

  assert.equal(baseline.points.length, 30);
  assert.ok(baseline.summary.crunchProbability >= 0);
  assert.ok(baseline.summary.crunchProbability <= 100);
  assert.ok(actions.length >= 3);
  assert.ok(afterActions.summary.minimumCashBalance >= baseline.summary.minimumCashBalance);
}

function testApprovalAudit() {
  const entries = recordApprovalAudit({
    source: "demo",
    cashActionIds: [],
    revenueOpportunityIds: ["closed-won-CRM-DEAL-6500"],
    productivityTaskIds: [],
    integrationCandidateIds: []
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, "REVENUE_RECOMMENDATION_APPROVED");
  assert.deepEqual(entries[0].sourceRecordIds, ["CRM-DEAL-6500", "contact-bright"]);
  assert.equal(entries[0].payload.previousStatus, "PENDING");
  assert.equal(entries[0].payload.newStatus, "APPROVED");
}

function testMappingReviewAudit() {
  const entry = recordMappingReview({
    matchId: "match-crm-deal-6500",
    decision: "APPROVED",
    sourceRecordIds: ["CRM-DEAL-6500", "contact-bright"],
    externalName: "Brightside Studio Ltd",
    xeroContactName: "Brightside Studios"
  });

  assert.equal(entry.eventType, "SMART_MAPPING_REVIEWED");
  assert.equal(entry.payload.newStatus, "APPROVED");
  assert.equal(entry.payload.previousStatus, "PENDING_REVIEW");
}

testSmartMapping();
testRevenueLeakDetection();
testForecastAndActions();
testApprovalAudit();
testMappingReviewAudit();

console.log("CashPilot core tests passed.");
