import { formatMoney } from "../forecast/dateUtils";
import type {
  Invoice,
  ProductivityAutomationSummary,
  ProductivityAutomationTask,
  XeroSnapshot
} from "../types/domain";

interface MessyFinanceRecord {
  id: string;
  label: string;
  amount: number;
  vendorOrPayer: string;
  rawText: string;
  recordKind: "receipt" | "bank_transaction" | "supplier_bill" | "contractor_invoice" | "subscription_receipt";
}

const messyFinanceRecords: MessyFinanceRecord[] = [
  {
    id: "receipt-printco-july",
    label: "Scanned receipt - Print Co. Ltd",
    amount: 2100,
    vendorOrPayer: "Print Co. Ltd",
    recordKind: "receipt",
    rawText: "PRINT CO LTD / production collateral / 2,100.00 / ref 188 / due 18-07"
  },
  {
    id: "bank-acme-4012",
    label: "Bank feed transaction - ACME RETAIL GRP",
    amount: 4200,
    vendorOrPayer: "ACME RETAIL GRP",
    recordKind: "bank_transaction",
    rawText: "BACS RECEIPT ACME RETAIL GRP INV4012 THANKS"
  },
  {
    id: "bill-cloud-lane-dup",
    label: "Forwarded supplier bill - Cloud Lane",
    amount: 1800,
    vendorOrPayer: "Cloud Lane",
    recordKind: "supplier_bill",
    rawText: "Cloud Lane Hosting July plan GBP 1,800. Similar supplier name, no Xero bill number in email."
  },
  {
    id: "contractor-payout-july",
    label: "Contractor spreadsheet - July creative team",
    amount: 7600,
    vendorOrPayer: "Freelancer pool",
    recordKind: "contractor_invoice",
    rawText: "July contractors: design support 3,200; copy 2,100; QA 2,300. Pay Friday if cash allows."
  },
  {
    id: "subscription-suite-july",
    label: "Multi-vendor subscription receipt",
    amount: 950,
    vendorOrPayer: "Design SaaS bundle",
    recordKind: "subscription_receipt",
    rawText: "Figma/Notion/Typeform bundle; monthly card charge; previous category mixed across Software and General."
  }
];

export function buildProductivityAutomations(snapshot: XeroSnapshot): ProductivityAutomationTask[] {
  const contacts = new Map(snapshot.contacts.map((contact) => [contact.id, contact]));
  const invoices = new Map(snapshot.invoices.map((invoice) => [invoice.id, invoice]));
  const byNumber = new Map(snapshot.invoices.map((invoice) => [invoice.invoiceNumber, invoice]));

  const printCoBill = invoices.get("bill-printco-188");
  const acmeInvoice = byNumber.get("INV-4012");
  const cloudLaneBill = invoices.get("bill-cloudlane-733");
  const contractorBill = invoices.get("bill-freelancers-077");
  const softwareFlow = snapshot.recurringCashFlows.find((flow) => flow.id === "software");

  return [
    printCoBill
      ? buildReceiptToExpenseTask(snapshot, printCoBill, "receipt-printco-july")
      : null,
    acmeInvoice
      ? buildSmartReconciliationTask(snapshot, acmeInvoice, "bank-acme-4012")
      : null,
    cloudLaneBill
      ? buildDuplicateBillGuardTask(snapshot, cloudLaneBill, "bill-cloud-lane-dup")
      : null,
    contractorBill
      ? buildContractorPaymentTask(snapshot, contractorBill, "contractor-payout-july")
      : null,
    softwareFlow
      ? buildSubscriptionControlTask(snapshot, softwareFlow.amount, "subscription-suite-july")
      : null
  ]
    .filter((task): task is ProductivityAutomationTask => Boolean(task))
    .sort((left, right) => right.timeSavedMinutes - left.timeSavedMinutes);
}

export function summariseProductivityAutomations(
  tasks: ProductivityAutomationTask[]
): ProductivityAutomationSummary {
  return {
    tasksDetected: tasks.length,
    autoResolvableTasks: tasks.filter((task) => task.confidenceScore >= 0.86).length,
    exceptionTasks: tasks.filter((task) => task.confidenceScore < 0.86).length,
    estimatedMinutesSaved: tasks.reduce((sum, task) => sum + task.timeSavedMinutes, 0),
    highestImpactTask: tasks[0]?.title ?? null,
    xeroTouchpoints: [
      "Bank transactions",
      "Payments",
      "Invoices",
      "Bills",
      "Contacts",
      "Accounts",
      "Tracking categories",
      "Attachments"
    ]
  };
}

function buildReceiptToExpenseTask(
  snapshot: XeroSnapshot,
  bill: Invoice,
  recordId: string
): ProductivityAutomationTask {
  const record = getRecord(recordId);

  return {
    id: "productivity-receipt-printco",
    type: "receipt_to_expense",
    title: "Receipt to expense and bill match",
    sourceRecord: record.label,
    workflow: "Receipt -> supplier bill -> expense account -> attachment -> approval",
    xeroTarget: `Bill ${bill.invoiceNumber}`,
    confidenceScore: 0.92,
    confidence: "high",
    timeSavedMinutes: 32,
    businessImpact: `Avoids manual entry and attaches evidence to a ${formatMoney(bill.amountDue, snapshot.currency)} supplier bill.`,
    messySignals: [
      "Supplier name appears as Print Co. Ltd while Xero contact is PrintCo Supplies.",
      "Receipt has reference 188 but no exact Xero bill URL."
    ],
    automationSteps: [
      "Extract vendor, amount, due date, and reference from receipt text.",
      "Fuzzy-match vendor and amount to authorised Xero bill.",
      "Suggest Printing & production account code and attach receipt to the bill.",
      "Queue reviewed bill-coding update for human approval."
    ],
    recommendedAction: "Approve the suggested bill attachment and expense coding.",
    approvalPlan: {
      xeroRecords: [
        `Bill ${bill.invoiceNumber}`,
        `${formatMoney(bill.amountDue, snapshot.currency)} supplier bill`,
        "Contact PrintCo Supplies",
        "Account: Printing & production"
      ],
      approvedExecution:
        "Attach the receipt, set the suggested expense account, and add a reviewed coding note to the Xero bill.",
      humanControl:
        "Owner or bookkeeper confirms the supplier match before the app updates the bill coding."
    }
  };
}

function buildSmartReconciliationTask(
  snapshot: XeroSnapshot,
  invoice: Invoice,
  recordId: string
): ProductivityAutomationTask {
  const record = getRecord(recordId);

  return {
    id: "productivity-reconcile-acme",
    type: "smart_reconciliation",
    title: "Smart payment reconciliation",
    sourceRecord: record.label,
    workflow: "Bank feed -> payment match -> invoice close -> cash forecast refresh",
    xeroTarget: `Invoice ${invoice.invoiceNumber}`,
    confidenceScore: 0.96,
    confidence: "high",
    timeSavedMinutes: 26,
    businessImpact: `${formatMoney(invoice.amountDue, snapshot.currency)} can be matched to the open invoice without manual search.`,
    messySignals: [
      "Bank memo uses ACME RETAIL GRP while Xero contact is Acme Retail Group.",
      "Invoice reference is typed as INV4012 without the hyphen."
    ],
    automationSteps: [
      "Normalise bank-feed memo text and invoice references.",
      "Match payer, amount, and invoice number to authorised receivable.",
      "Queue reconciliation and payment allocation against the Xero invoice.",
      "Refresh the cash forecast after owner approval."
    ],
    recommendedAction: "Approve the payment-to-invoice match and close the receivable.",
    approvalPlan: {
      xeroRecords: [
        `Invoice ${invoice.invoiceNumber}`,
        "Contact Acme Retail Group",
        `Bank transaction candidate ${formatMoney(record.amount, snapshot.currency)}`
      ],
      approvedExecution:
        "Create a reviewed reconciliation task that allocates the bank receipt to the Xero invoice payment record.",
      humanControl:
        "Owner confirms the bank transaction is not a duplicate before marking the invoice paid."
    }
  };
}

function buildDuplicateBillGuardTask(
  snapshot: XeroSnapshot,
  bill: Invoice,
  recordId: string
): ProductivityAutomationTask {
  const record = getRecord(recordId);

  return {
    id: "productivity-duplicate-cloudlane",
    type: "duplicate_bill_guard",
    title: "Duplicate supplier bill guard",
    sourceRecord: record.label,
    workflow: "Supplier inbox -> duplicate check -> payment hold -> Xero bill note",
    xeroTarget: `Bill ${bill.invoiceNumber}`,
    confidenceScore: 0.84,
    confidence: "medium",
    timeSavedMinutes: 22,
    businessImpact: `Prevents a possible duplicate ${formatMoney(bill.amountDue, snapshot.currency)} payment to a critical supplier.`,
    messySignals: [
      "Supplier is written as Cloud Lane in email but CloudLane Hosting in Xero.",
      "Email has no bill number, only amount and month.",
      "Supplier is marked high sensitivity, so auto-delay is unsafe."
    ],
    automationSteps: [
      "Compare vendor alias, amount, period, and due date against open Xero bills.",
      "Flag likely duplicate instead of creating a second bill.",
      "Suggest a payment hold note on the existing bill.",
      "Escalate to human review because supplier continuity risk is high."
    ],
    recommendedAction: "Review the duplicate warning before paying or importing the forwarded bill.",
    approvalPlan: {
      xeroRecords: [
        `Existing bill ${bill.invoiceNumber}`,
        "Contact CloudLane Hosting",
        `Potential duplicate ${formatMoney(record.amount, snapshot.currency)}`
      ],
      approvedExecution:
        "Add a duplicate-risk note to the existing Xero bill and prevent a second import unless approved.",
      humanControl:
        "Owner decides whether the forwarded bill is a duplicate, revised bill, or missing attachment."
    }
  };
}

function buildContractorPaymentTask(
  snapshot: XeroSnapshot,
  bill: Invoice,
  recordId: string
): ProductivityAutomationTask {
  const record = getRecord(recordId);

  return {
    id: "productivity-contractor-payout",
    type: "contractor_payment_prep",
    title: "Contractor payment prep with cash-risk check",
    sourceRecord: record.label,
    workflow: "Contractor spreadsheet -> bill allocation -> payroll sensitivity check -> approval batch",
    xeroTarget: `Bill ${bill.invoiceNumber}`,
    confidenceScore: 0.79,
    confidence: "medium",
    timeSavedMinutes: 38,
    businessImpact: `Turns a messy contractor spreadsheet into a reviewed ${formatMoney(bill.amountDue, snapshot.currency)} payment batch.`,
    messySignals: [
      "Spreadsheet has line-level contractor amounts but no Xero contact IDs.",
      "Payment falls inside the cash risk window.",
      "Payroll and contractor trust risk is high, so automation must not delay it silently."
    ],
    automationSteps: [
      "Extract contractor categories and total from spreadsheet text.",
      "Match total to the authorised Xero contractor bill.",
      "Flag cash-flow risk before payment date.",
      "Prepare an approval checklist rather than auto-paying."
    ],
    recommendedAction: "Approve the payment batch only after reviewing cash impact and contractor priority.",
    approvalPlan: {
      xeroRecords: [
        `Bill ${bill.invoiceNumber}`,
        `Payment batch ${formatMoney(bill.amountDue, snapshot.currency)}`,
        "Supplier group Payroll"
      ],
      approvedExecution:
        "Queue a reviewed payment-prep task with bill allocation, contractor notes, and cash-risk warning.",
      humanControl:
        "Owner confirms payment timing; the app does not execute payroll or contractor payments automatically."
    }
  };
}

function buildSubscriptionControlTask(
  snapshot: XeroSnapshot,
  amount: number,
  recordId: string
): ProductivityAutomationTask {
  const record = getRecord(recordId);

  return {
    id: "productivity-subscription-control",
    type: "subscription_expense_control",
    title: "Subscription expense categorisation",
    sourceRecord: record.label,
    workflow: "Card receipt -> supplier bundle split -> account code -> recurring spend report",
    xeroTarget: "Recurring Software subscriptions",
    confidenceScore: 0.88,
    confidence: "high",
    timeSavedMinutes: 18,
    businessImpact: `Keeps ${formatMoney(amount, snapshot.currency)} of monthly software spend consistently coded and reportable.`,
    messySignals: [
      "Receipt bundles multiple SaaS vendors into one card charge.",
      "Previous coding alternated between Software and General."
    ],
    automationSteps: [
      "Classify vendor bundle as operating software.",
      "Map to the existing recurring cash-flow category.",
      "Suggest account coding and tracking category.",
      "Queue a monthly control check for unusual increases."
    ],
    recommendedAction: "Approve consistent software coding and recurring spend monitoring.",
    approvalPlan: {
      xeroRecords: [
        "Account: Software subscriptions",
        `Recurring outflow ${formatMoney(amount, snapshot.currency)}`,
        "Tracking: Operations"
      ],
      approvedExecution:
        "Apply the reviewed account-code suggestion and add this vendor bundle to recurring spend monitoring.",
      humanControl:
        "Owner confirms the bundle is a business expense and not a personal card charge."
    }
  };
}

function getRecord(id: string) {
  const record = messyFinanceRecords.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing productivity demo record: ${id}`);
  return record;
}
