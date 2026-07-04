import { mockExternalSalesSnapshot } from "../connectors/mockExternalSales";
import type {
  Contact,
  EntityMatch,
  ExternalDeal,
  ExternalOrder,
  ExternalRecordType,
  SmartMappingSummary,
  XeroSnapshot
} from "../types/domain";

const legalSuffixes = new Set(["ltd", "limited", "llc", "inc", "co", "company", "plc"]);

export function normaliseCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !legalSuffixes.has(token))
    .join(" ")
    .trim();
}

export function similarity(left: string, right: string): number {
  const a = normaliseCompanyName(left);
  const b = normaliseCompanyName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const leftTokens = new Set(a.split(" "));
  const rightTokens = new Set(b.split(" "));
  const overlap = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
  const jaccard = overlap / Math.max(1, new Set([...leftTokens, ...rightTokens]).size);
  const edit = levenshteinRatio(a, b);
  return Math.max(jaccard, edit);
}

export function buildEntityMatches(snapshot: XeroSnapshot): EntityMatch[] {
  const dealMatches = mockExternalSalesSnapshot.deals.map((deal) => matchExternalRecord(snapshot.contacts, deal, "DEAL"));
  const orderMatches = mockExternalSalesSnapshot.orders.map((order) => matchExternalRecord(snapshot.contacts, order, "ORDER"));

  return [...dealMatches, ...orderMatches].sort((left, right) => right.confidence - left.confidence);
}

export function summariseEntityMatches(matches: EntityMatch[]): SmartMappingSummary {
  return {
    totalMatches: matches.length,
    highConfidenceMatches: matches.filter((match) => match.confidence >= 0.86).length,
    needsReview: matches.filter((match) => match.matchStatus === "PENDING_REVIEW").length,
    bestMatch: matches[0]
      ? `${matches[0].externalName} -> ${matches[0].xeroContactName ?? "new contact"}`
      : null
  };
}

function matchExternalRecord(
  contacts: Contact[],
  record: ExternalDeal | ExternalOrder,
  externalRecordType: ExternalRecordType
): EntityMatch {
  const isDeal = externalRecordType === "DEAL";
  const externalName = isDeal ? (record as ExternalDeal).companyName : (record as ExternalOrder).customerName;
  const externalEmail = isDeal ? (record as ExternalDeal).contactEmail : (record as ExternalOrder).customerEmail;
  const externalTitle = isDeal ? (record as ExternalDeal).dealName : (record as ExternalOrder).productNames.join(", ");
  const externalAmount = record.amount;
  const externalRecordId = isDeal ? (record as ExternalDeal).externalDealId : (record as ExternalOrder).externalOrderId;

  const scored = contacts
    .filter((contact) => contact.kind !== "supplier")
    .map((contact) => {
      const nameScore = similarity(externalName, contact.name);
      const exactEmail = Boolean(externalEmail) && externalEmail?.toLowerCase() === contact.email.toLowerCase();
      const emailScore = exactEmail
        ? 0.45
        : emailDomain(externalEmail) && emailDomain(contact.email) === emailDomain(externalEmail)
          ? 0.18
          : 0;
      const confidence = Math.min(0.98, nameScore * 0.78 + emailScore + (nameScore > 0.88 ? 0.08 : 0));
      const evidence = buildEvidence(externalName, externalEmail, contact, nameScore, emailScore, exactEmail);
      return { contact, confidence, evidence };
    })
    .sort((left, right) => right.confidence - left.confidence);

  const best = scored[0];
  const matchStatus = !best || best.confidence < 0.58 ? "NEEDS_NEW_CONTACT" : "PENDING_REVIEW";

  return {
    matchId: `match-${externalRecordId.toLowerCase()}`,
    externalRecordId,
    externalRecordType,
    sourceSystem: record.sourceSystem,
    externalName,
    externalTitle,
    externalAmount,
    xeroContactId: best?.contact.id,
    xeroContactName: best?.contact.name,
    confidence: Number((best?.confidence ?? 0).toFixed(2)),
    matchStatus,
    evidence: best?.evidence ?? ["No sufficiently similar Xero contact was found."],
    sourceRecordIds: [externalRecordId, best?.contact.id].filter((value): value is string => Boolean(value))
  };
}

function buildEvidence(
  externalName: string,
  externalEmail: string | undefined,
  contact: Contact,
  nameScore: number,
  emailScore: number,
  exactEmail: boolean
) {
  const evidence: string[] = [];
  if (nameScore >= 0.9) {
    evidence.push("Company names are highly similar after normalisation.");
  } else if (nameScore >= 0.65) {
    evidence.push("Company names partially match after normalisation.");
  }

  if (exactEmail) {
    evidence.push(`Both records use the exact billing email ${externalEmail}.`);
  } else if (emailScore > 0) {
    evidence.push(`Both records share the ${emailDomain(externalEmail)} email domain.`);
  }

  if (contact.notes) {
    evidence.push("Previous Xero relationship context exists for this customer.");
  }

  if (evidence.length === 0) {
    evidence.push(`Weak match: ${externalName} needs manual review against ${contact.name}.`);
  }

  return evidence;
}

function emailDomain(value?: string) {
  return value?.split("@")[1]?.toLowerCase();
}

function levenshteinRatio(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  const distance = matrix[left.length][right.length];
  return 1 - distance / Math.max(left.length, right.length, 1);
}
