import type { AuditLogEntry } from "../types/domain";

interface ApprovalAuditInput {
  source: "demo" | "xero";
  cashActionIds: string[];
  revenueOpportunityIds: string[];
  productivityTaskIds: string[];
  integrationCandidateIds: string[];
}

const auditLog: AuditLogEntry[] = [
  {
    auditId: "audit-seed-mapping-brightside",
    eventType: "SMART_MAPPING_REVIEWED",
    sourceRecordIds: ["CRM-DEAL-6500", "contact-bright"],
    payload: {
      matchId: "match-crm-deal-6500",
      previousStatus: "NEW",
      newStatus: "PENDING_REVIEW",
      confidence: 0.92,
      explanation: "Brightside Studio Ltd matched to Brightside Studios using normalised name and email domain."
    },
    createdAt: "2026-07-04T09:05:00.000Z"
  },
  {
    auditId: "audit-seed-risk-run",
    eventType: "FORECAST_RUN_CREATED",
    sourceRecordIds: ["forecast-run-demo-30d", "BILL-077", "INV-4018"],
    payload: {
      previousStatus: "NOT_STARTED",
      newStatus: "COMPLETED",
      note: "30-day crunch probability calculated from deterministic cash-flow simulation."
    },
    createdAt: "2026-07-04T09:07:00.000Z"
  }
];

export function getAuditLog(): AuditLogEntry[] {
  return [...auditLog].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12);
}

export function recordApprovalAudit(input: ApprovalAuditInput): AuditLogEntry[] {
  const createdAt = new Date().toISOString();
  const groups = [
    ["CASH_ACTION_APPROVED", input.cashActionIds],
    ["REVENUE_RECOMMENDATION_APPROVED", input.revenueOpportunityIds],
    ["PRODUCTIVITY_AUTOMATION_APPROVED", input.productivityTaskIds],
    ["ADAPTIVE_INTEGRATION_APPROVED", input.integrationCandidateIds]
  ] as const;

  const entries = groups.flatMap(([eventType, ids]) =>
    ids.map((id) => ({
      auditId: `audit-${eventType.toLowerCase()}-${id}-${Date.now()}`,
      eventType,
      sourceRecordIds: inferSourceRecordIds(id),
      payload: {
        recommendationId: id,
        source: input.source,
        decision: "APPROVED",
        previousStatus: "PENDING",
        newStatus: "APPROVED",
        reviewedExecution: true
      },
      createdAt
    }))
  );

  auditLog.unshift(...entries);
  return entries;
}

function inferSourceRecordIds(id: string): string[] {
  if (id.includes("CRM-DEAL-6500") || id.includes("crm-bright") || id.includes("closed-won")) {
    return ["CRM-DEAL-6500", "contact-bright"];
  }
  if (id.includes("acme") || id.includes("4012")) return ["INV-4012", "contact-acme"];
  if (id.includes("bright") || id.includes("4018")) return ["INV-4018", "contact-bright"];
  if (id.includes("printco") || id.includes("188")) return ["BILL-188", "contact-printco"];
  if (id.includes("cloudlane") || id.includes("733")) return ["BILL-733", "contact-cloudlane"];
  if (id.includes("contractor") || id.includes("077")) return ["BILL-077", "GOOGLE-SHEET-TAB-JULY-CONTRACTORS"];
  if (id.includes("stripe") || id.includes("luna")) return ["STRIPE-PO-2026-07-02", "contact-luna"];
  if (id.includes("shopify") || id.includes("harbor")) return ["SHOPIFY-ORDER-1098", "contact-harbor"];
  if (id.includes("saas") || id.includes("retainer")) return ["RETENTION-APP-RENEWAL-221", "contact-bright"];
  return [id];
}
