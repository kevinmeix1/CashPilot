import { generateAgentNarrative } from "../agents/cfoNarrativeAgent";
import { demoSnapshot } from "../data/demoSnapshot";
import {
  buildAdaptiveIntegrationCandidates,
  summariseAdaptiveIntegrations
} from "../integrations/adaptive/adaptiveIntegrationEngine";
import {
  assessDataQuality,
  buildFallbackNarrative,
  buildForecastScenario,
  buildForecastIntelligence,
  recommendCashActions
} from "../forecast/forecastEngine";
import type { DashboardPayload, XeroSnapshot } from "../types/domain";
import { seededXeroProvenance } from "../integrations/xero";
import { inspectXeroMcpBridge } from "../integrations/xeroMcp";
import { buildOwnerPriorities } from "../product/ownerPriorities";
import { buildProductivityAutomations, summariseProductivityAutomations } from "../productivity/automationEngine";
import { buildEntityMatches, summariseEntityMatches } from "../mapping/smartMappingService";
import { buildRevenueOpportunities, summariseRevenueGrowth } from "../revenue/opportunityEngine";
import { getAuditLog, getMappingDecisions } from "../audit/auditService";

export async function buildDashboardPayload(
  snapshot: XeroSnapshot = demoSnapshot,
  options: {
    source?: DashboardPayload["source"];
    xero?: DashboardPayload["xero"];
  } = {}
): Promise<DashboardPayload> {
  const dataQuality = assessDataQuality(snapshot);
  const baseline = buildForecastScenario(snapshot, "Before agent actions");
  const recommendedActions = recommendCashActions(snapshot, baseline);
  const afterActions = buildForecastScenario(snapshot, "After recommended actions", {
    actions: recommendedActions
  });
  const mappingDecisions = getMappingDecisions();
  const entityMatches = buildEntityMatches(snapshot).map((match) => {
    const decision = mappingDecisions[match.matchId];
    return decision ? { ...match, matchStatus: decision } : match;
  });
  const smartMappingSummary = summariseEntityMatches(entityMatches);
  const revenueOpportunities = buildRevenueOpportunities(snapshot, entityMatches);
  const revenueGrowth = summariseRevenueGrowth(revenueOpportunities);
  const productivityTasks = buildProductivityAutomations(snapshot);
  const productivitySummary = summariseProductivityAutomations(productivityTasks);
  const integrationCandidates = buildAdaptiveIntegrationCandidates(snapshot);
  const integrationSummary = summariseAdaptiveIntegrations(integrationCandidates);
  const forecastIntelligence = buildForecastIntelligence(
    snapshot,
    baseline,
    afterActions,
    recommendedActions,
    revenueGrowth,
    revenueOpportunities
  );
  const ownerPriorities = buildOwnerPriorities({
    snapshot,
    baseline,
    afterActions,
    cashActions: recommendedActions,
    revenueGrowth,
    revenueOpportunities
  });
  const mcp = options.xero ? undefined : await inspectXeroMcpBridge();

  const agentNarrative = await generateAgentNarrative({
    snapshot: {
      organisationName: snapshot.organisationName,
      currency: snapshot.currency,
      asOfDate: snapshot.asOfDate,
      safeCashThreshold: snapshot.safeCashThreshold
    },
    dataQuality,
    baseline: baseline.summary,
    afterActions: afterActions.summary,
    revenueGrowth,
    revenueOpportunities: revenueOpportunities.map((opportunity) => ({
      id: opportunity.id,
      type: opportunity.type,
      title: opportunity.title,
      contactName: opportunity.contactName,
      serviceCategory: opportunity.serviceCategory,
      expectedRevenueImpact: opportunity.expectedRevenueImpact,
      expectedCashFlowImpact: opportunity.expectedCashFlowImpact,
      confidence: opportunity.confidence,
      urgency: opportunity.urgency,
      recommendedAction: opportunity.recommendedAction,
      evidence: opportunity.evidence
    })),
    recommendedActions: recommendedActions.map((action) => ({
      id: action.id,
      type: action.type,
      title: action.title,
      contactName: action.contactName,
      invoiceNumber: action.invoiceNumber,
      cashImpactBeforeCrunch: action.cashImpactBeforeCrunch,
      confidence: action.confidence,
      relationshipRisk: action.relationshipRisk,
      rationale: action.rationale,
      messageDraft: action.messageDraft
    }))
  });

  return {
    source: options.source ?? "seeded-demo",
    generatedAt: new Date().toISOString(),
    snapshot: {
      organisationName: snapshot.organisationName,
      currency: snapshot.currency,
      asOfDate: snapshot.asOfDate,
      openingCashBalance: snapshot.openingCashBalance,
      safeCashThreshold: snapshot.safeCashThreshold
    },
    dataQuality,
    baseline,
    afterActions,
    forecastIntelligence,
    recommendedActions,
    revenueGrowth,
    revenueOpportunities,
    smartMappingSummary,
    entityMatches,
    productivitySummary,
    productivityTasks,
    integrationSummary,
    integrationCandidates,
    auditLog: getAuditLog(),
    ownerPriorities,
    narrative:
      agentNarrative ??
      buildFallbackNarrative(snapshot, baseline, afterActions, recommendedActions, revenueGrowth, revenueOpportunities),
    xero: options.xero ?? seededXeroProvenance(mcp),
    agentLayer: {
      mode: agentNarrative ? "openai-agents-sdk" : "deterministic-fallback",
      specialists: [
        {
          name: "Productivity Automation Agent",
          role: "Handles messy receipts, reconciliation, duplicate bills, and contractor payment prep.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Adaptive Integration Agent",
          role: "Maps CRM, e-commerce, payments, SaaS, and spreadsheet data into Xero objects.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Data Quality Agent",
          role: "Checks whether Xero data is complete enough for forecasting.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Forecast Agent",
          role: "Interprets deterministic risk windows and Monte Carlo output.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Cash Action Agent",
          role: "Ranks customer and supplier interventions by forecast impact.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Collections Agent",
          role: "Drafts customer-specific invoice follow-up messages.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Revenue Growth Agent",
          role: "Finds dormant customers, upsells, subscription conversions, and service opportunities.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Outreach Agent",
          role: "Turns revenue opportunities into customer-specific messages.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "Supplier Payment Agent",
          role: "Suggests which bills are safe to delay with human approval.",
          status: agentNarrative ? "ran" : "fallback"
        },
        {
          name: "CFO Narrative Agent",
          role: "Explains the forecast in plain English.",
          status: agentNarrative ? "ran" : "fallback"
        }
      ],
      traceHint: agentNarrative
        ? "OpenAI Agents SDK run completed; inspect traces in the OpenAI dashboard when tracing is enabled."
        : "OPENAI_API_KEY is not set, so deterministic fallback text is active while agent scaffolding remains ready."
    }
  };
}
