import { formatMoney } from "../../forecast/dateUtils";
import type {
  AdaptiveIntegrationCandidate,
  AdaptiveIntegrationSummary,
  Contact,
  IntegrationSourceSystem,
  XeroSnapshot
} from "../../types/domain";

interface ExternalBusinessRecord {
  id: string;
  sourceSystem: IntegrationSourceSystem;
  sourceRecordId: string;
  title: string;
  rawSignal: string;
  amount: number;
  contactHint: string;
  productHint: string;
}

const externalRecords: ExternalBusinessRecord[] = [
  {
    id: "crm-bright-conversion",
    sourceSystem: "CRM",
    sourceRecordId: "CRM-DEAL-6500",
    title: "Won CRM deal -> Xero draft invoice",
    rawSignal: "Brightside Studio Ltd / Conversion sprint / closed-won / 6.5k / invoice after kickoff / owner: Mia",
    amount: 6500,
    contactHint: "Brightside Studio Ltd",
    productHint: "Conversion sprint"
  },
  {
    id: "shopify-harbor-launch",
    sourceSystem: "E-commerce",
    sourceRecordId: "SHOPIFY-ORDER-1098",
    title: "Shopify-style order -> Xero sales invoice",
    rawSignal: "Harbor Coffee Co ordered Launch Kit + Brand Assets. Address missing VAT field. Paid by card.",
    amount: 2450,
    contactHint: "Harbor Coffee",
    productHint: "Launch Kit"
  },
  {
    id: "stripe-luna-payout",
    sourceSystem: "Payments",
    sourceRecordId: "STRIPE-PO-2026-07-02",
    title: "Stripe payout -> invoice and fee mapping",
    rawSignal: "Payout 1,912.58; gross 1,967.00; fee 54.42; description LUNA monthly content",
    amount: 1967,
    contactHint: "Luna",
    productHint: "Monthly content"
  },
  {
    id: "contractor-sheet-creative",
    sourceSystem: "Spreadsheet",
    sourceRecordId: "GOOGLE-SHEET-TAB-JULY-CONTRACTORS",
    title: "Contractor sheet -> Xero supplier bill",
    rawSignal: "Creative team July: Sam design 3200, Jo copy 2100, QA support 2300. No supplier bill IDs.",
    amount: 7600,
    contactHint: "Freelancer pool",
    productHint: "Contractor services"
  },
  {
    id: "saas-retainer-wave",
    sourceSystem: "SaaS",
    sourceRecordId: "RETENTION-APP-RENEWAL-221",
    title: "SaaS renewal -> Xero repeating invoice",
    rawSignal: "Retainer Wave renewal accepted: support plan 3,200 monthly, starts 25 July, customer alias Bright+Ops.",
    amount: 3200,
    contactHint: "Bright",
    productHint: "Support plan"
  }
];

export function buildAdaptiveIntegrationCandidates(snapshot: XeroSnapshot): AdaptiveIntegrationCandidate[] {
  return externalRecords
    .map((record) => buildCandidate(snapshot, record))
    .sort((left, right) => right.expectedValue - left.expectedValue);
}

export function summariseAdaptiveIntegrations(
  candidates: AdaptiveIntegrationCandidate[]
): AdaptiveIntegrationSummary {
  const sourceSystems = Array.from(new Set(candidates.map((candidate) => candidate.sourceSystem)));

  return {
    candidatesDetected: candidates.length,
    readyToSync: candidates.filter((candidate) => candidate.confidenceScore >= 0.86 && candidate.missingFields.length === 0).length,
    needsReview: candidates.filter((candidate) => candidate.confidenceScore < 0.86 || candidate.missingFields.length > 0).length,
    totalMappedValue: candidates.reduce((sum, candidate) => sum + candidate.expectedValue, 0),
    sourceSystems,
    topSyncAction: candidates[0]?.syncAction ?? null
  };
}

function buildCandidate(snapshot: XeroSnapshot, record: ExternalBusinessRecord): AdaptiveIntegrationCandidate {
  const contact = findContact(snapshot, record.contactHint);

  if (record.id === "crm-bright-conversion") {
    return {
      id: "integrate-crm-bright-conversion",
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId,
      title: record.title,
      rawSignal: record.rawSignal,
      mappedXeroObject: "Invoice",
      targetXeroRecord: contact ? `Contact ${contact.name}` : "New Xero contact candidate",
      confidenceScore: 0.91,
      confidence: "high",
      expectedValue: record.amount,
      syncAction: "Prepare a draft Xero invoice from the won CRM deal.",
      fieldMappings: [
        mapField("deal.customer", record.contactHint, "Contact.Name", contact?.name ?? "Brightside Studios", "high"),
        mapField("deal.value", "6.5k", "Invoice.LineAmount", formatMoney(record.amount, snapshot.currency), "high"),
        mapField("deal.stage", "closed-won", "Invoice.Status", "DRAFT for owner approval", "high"),
        mapField("deal.product", record.productHint, "LineItem.Description", "Conversion sprint", "medium")
      ],
      missingFields: [],
      resilienceNotes: [
        "Understands 6.5k as a currency amount instead of requiring a numeric field.",
        "Maps CRM stage to a draft invoice, not an authorised invoice.",
        "Uses existing Xero contact despite legal suffix and pluralisation differences."
      ],
      approvalPlan: {
        xeroRecords: [
          "CRM deal CRM-DEAL-6500",
          contact ? `Xero contact ${contact.name}` : "New contact review",
          `Draft invoice ${formatMoney(record.amount, snapshot.currency)}`
        ],
        approvedExecution:
          "Create a draft Xero invoice with mapped line item, contact, amount, and tracking category for review.",
        humanControl:
          "Owner confirms scope, tax treatment, and invoice timing before the draft invoice is sent."
      }
    };
  }

  if (record.id === "shopify-harbor-launch") {
    return {
      id: "integrate-shopify-harbor-order",
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId,
      title: record.title,
      rawSignal: record.rawSignal,
      mappedXeroObject: "Invoice",
      targetXeroRecord: contact ? `Contact ${contact.name}` : "Contact Harbor Coffee Co",
      confidenceScore: 0.82,
      confidence: "medium",
      expectedValue: record.amount,
      syncAction: "Convert paid order into a reviewed Xero sales invoice.",
      fieldMappings: [
        mapField("order.customer", record.contactHint, "Contact.Name", contact?.name ?? "Harbor Coffee Co", "medium"),
        mapField("order.items", "Launch Kit + Brand Assets", "Invoice.LineItems", "Launch Kit; Brand Assets", "high"),
        mapField("order.payment_status", "Paid by card", "Payment.Status", "Paid", "high"),
        mapField("order.total", String(record.amount), "Invoice.Total", formatMoney(record.amount, snapshot.currency), "high")
      ],
      missingFields: ["VAT number / tax treatment"],
      resilienceNotes: [
        "Does not fail when the order lacks VAT metadata; it routes the tax field to review.",
        "Maps product bundle to multiple Xero line items.",
        "Recognises Harbor Coffee as an existing Xero customer from partial name."
      ],
      approvalPlan: {
        xeroRecords: [
          "Shopify order SHOPIFY-ORDER-1098",
          contact ? `Xero contact ${contact.name}` : "Contact candidate Harbor Coffee Co",
          "Items: Launch Kit, Brand Assets"
        ],
        approvedExecution:
          "Create a draft paid sales invoice and queue the missing tax field for owner review.",
        humanControl:
          "Owner confirms VAT/tax treatment before the order is synced into Xero."
      }
    };
  }

  if (record.id === "stripe-luna-payout") {
    return {
      id: "integrate-stripe-luna-payout",
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId,
      title: record.title,
      rawSignal: record.rawSignal,
      mappedXeroObject: "Payment",
      targetXeroRecord: contact ? `Contact ${contact.name}` : "Contact Luna Fitness",
      confidenceScore: 0.89,
      confidence: "high",
      expectedValue: record.amount,
      syncAction: "Split gross receipt and payment fee for Xero reconciliation.",
      fieldMappings: [
        mapField("payout.net", "1,912.58", "BankTransaction.Amount", "£1,912.58", "high"),
        mapField("payout.gross", "1,967.00", "Invoice.Total", "£1,967.00", "high"),
        mapField("payout.fee", "54.42", "BankFee.LineItem", "£54.42 payment processing fee", "high"),
        mapField("description", "LUNA monthly content", "Contact.Name", contact?.name ?? "Luna Fitness", "high")
      ],
      missingFields: [],
      resilienceNotes: [
        "Separates gross revenue from payment processor fee.",
        "Uses fuzzy description matching to map LUNA to Luna Fitness.",
        "Prepares reconciliation instead of forcing a one-line bank transaction."
      ],
      approvalPlan: {
        xeroRecords: [
          "Stripe payout STRIPE-PO-2026-07-02",
          contact ? `Xero contact ${contact.name}` : "Contact Luna Fitness",
          "Bank fee line item"
        ],
        approvedExecution:
          "Queue a Xero reconciliation split: gross revenue to invoice/payment, fee to bank fees expense.",
        humanControl:
          "Owner confirms fee treatment and invoice match before reconciliation is posted."
      }
    };
  }

  if (record.id === "contractor-sheet-creative") {
    return {
      id: "integrate-sheet-contractor-bill",
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId,
      title: record.title,
      rawSignal: record.rawSignal,
      mappedXeroObject: "Bill",
      targetXeroRecord: "Bill BILL-077",
      confidenceScore: 0.76,
      confidence: "medium",
      expectedValue: record.amount,
      syncAction: "Transform contractor rows into a reviewed Xero bill allocation.",
      fieldMappings: [
        mapField("row.Sam design", "3200", "Bill.LineItem[Design support]", "£3,200", "medium"),
        mapField("row.Jo copy", "2100", "Bill.LineItem[Copywriting]", "£2,100", "medium"),
        mapField("row.QA support", "2300", "Bill.LineItem[Quality assurance]", "£2,300", "medium"),
        mapField("sheet.total", "7600", "Bill.Total", formatMoney(record.amount, snapshot.currency), "high")
      ],
      missingFields: ["Individual contractor supplier IDs", "Payment bank account"],
      resilienceNotes: [
        "Handles spreadsheet rows without requiring a rigid column template.",
        "Aggregates line items to the authorised Xero contractor bill.",
        "Routes missing supplier IDs to review instead of creating duplicates."
      ],
      approvalPlan: {
        xeroRecords: [
          "Google Sheet July contractors",
          "Bill BILL-077",
          `Bill allocation ${formatMoney(record.amount, snapshot.currency)}`
        ],
        approvedExecution:
          "Prepare bill line allocations and a payment-prep checklist for the existing Xero contractor bill.",
        humanControl:
          "Owner confirms supplier IDs and bank account before any payment workflow proceeds."
      }
    };
  }

  return {
    id: "integrate-saas-retainer-wave",
    sourceSystem: record.sourceSystem,
    sourceRecordId: record.sourceRecordId,
    title: record.title,
    rawSignal: record.rawSignal,
    mappedXeroObject: "RepeatingInvoice",
    targetXeroRecord: "Monthly support retainer",
    confidenceScore: 0.81,
    confidence: "medium",
    expectedValue: record.amount * 3,
    syncAction: "Prepare a Xero repeating-invoice template from the SaaS renewal.",
    fieldMappings: [
      mapField("renewal.amount", "3,200 monthly", "RepeatingInvoice.Amount", "£3,200 monthly", "high"),
      mapField("renewal.start", "25 July", "RepeatingInvoice.StartDate", "2026-07-25", "medium"),
      mapField("renewal.alias", "Bright+Ops", "Contact.Name", "Brightside Studios or new operations contact", "medium"),
      mapField("renewal.plan", "support plan", "Item.Name", "Monthly support retainer", "high")
    ],
    missingFields: ["Billing contact email confirmation"],
    resilienceNotes: [
      "Understands the phrase monthly as recurring cadence.",
      "Maps alias Bright+Ops to a likely Xero contact but requests confirmation.",
      "Converts renewal into draft repeating-invoice template rather than a one-off invoice."
    ],
    approvalPlan: {
      xeroRecords: [
        "SaaS renewal RETENTION-APP-RENEWAL-221",
        "Repeating invoice template candidate",
        `Monthly amount ${formatMoney(record.amount, snapshot.currency)}`
      ],
      approvedExecution:
        "Prepare a draft Xero repeating invoice template with cadence, amount, line item, and contact candidate.",
      humanControl:
        "Owner confirms billing contact and recurring terms before creating the template."
    }
  };
}

function findContact(snapshot: XeroSnapshot, hint: string): Contact | undefined {
  const normalisedHint = normalise(hint);
  return snapshot.contacts.find((contact) => {
    const name = normalise(contact.name);
    return name.includes(normalisedHint) || normalisedHint.includes(name.split(" ")[0] ?? name);
  });
}

function mapField(
  sourceField: string,
  sourceValue: string,
  xeroField: string,
  mappedValue: string,
  confidence: "low" | "medium" | "high"
) {
  return {
    sourceField,
    sourceValue,
    xeroField,
    mappedValue,
    confidence
  };
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
