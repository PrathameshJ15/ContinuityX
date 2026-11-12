import crypto from "crypto";

export interface SnapshotEntityRef {
  entityId: string;
  canonicalName: string;
}

export interface SnapshotEvidenceItem {
  documentId: string;
  documentChecksum: string;
  location: string;
  excerpt: string;
}

export interface SnapshotClaimItem {
  claimId: string;
  claimVersion: number;
  subject: SnapshotEntityRef;
  attributeKey: string;
  valueRaw: string;
  valueNormalized: string | null;
  evidenceStatus: string;
  reviewState: string;
  reviewerReason: string | null;
  evidence: SnapshotEvidenceItem[];
}

export interface SnapshotResolvedConflictItem {
  conflictId: string;
  type: string;
  resolution: string;
  reason: string;
}

export interface HandoverSnapshotPayload {
  schemaVersion: number;
  canonicalisationVersion: number;
  projectId: string;
  handoverVersion: number;
  previousReceiptHash: string | null;
  claims: SnapshotClaimItem[];
  resolvedConflicts: SnapshotResolvedConflictItem[];
}

/**
 * Normalizes Unicode strings to NFC as mandated by SPEC.md
 */
function normalizeString(str: string): string {
  return str.normalize("NFC");
}

/**
 * Canonical JSON Serializer (RFC 8785 compliant equivalent)
 * - Object keys sorted lexicographically
 * - Strings normalized to Unicode NFC
 * - Arrays stably sorted where appropriate
 * - Compact formatting without extra whitespace
 */
export function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(normalizeString(value));
  }

  if (Array.isArray(value)) {
    const serializedElements = value.map((el) => canonicalizeValue(el));
    return `[${serializedElements.join(",")}]`;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const keyValPairs = sortedKeys.map(
      (key) => `${JSON.stringify(normalizeString(key))}:${canonicalizeValue(obj[key])}`
    );
    return `{${keyValPairs.join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Deterministically sorts all snapshot arrays before canonicalization
 */
export function prepareCanonicalSnapshot(payload: HandoverSnapshotPayload): HandoverSnapshotPayload {
  // Sort claims stably by claimId, then claimVersion
  const sortedClaims = [...payload.claims]
    .map((claim) => {
      // Sort evidence stably by documentId, then location
      const sortedEvidence = [...claim.evidence].sort((a, b) => {
        const docCmp = a.documentId.localeCompare(b.documentId);
        if (docCmp !== 0) return docCmp;
        return a.location.localeCompare(b.location);
      });

      return {
        ...claim,
        subject: {
          entityId: claim.subject.entityId,
          canonicalName: normalizeString(claim.subject.canonicalName),
        },
        attributeKey: normalizeString(claim.attributeKey),
        valueRaw: normalizeString(claim.valueRaw),
        valueNormalized: claim.valueNormalized ? normalizeString(claim.valueNormalized) : null,
        evidenceStatus: normalizeString(claim.evidenceStatus),
        reviewState: normalizeString(claim.reviewState),
        reviewerReason: claim.reviewerReason ? normalizeString(claim.reviewerReason) : null,
        evidence: sortedEvidence.map((ev) => ({
          documentId: ev.documentId,
          documentChecksum: ev.documentChecksum,
          location: normalizeString(ev.location),
          excerpt: normalizeString(ev.excerpt),
        })),
      };
    })
    .sort((a, b) => {
      const idCmp = a.claimId.localeCompare(b.claimId);
      if (idCmp !== 0) return idCmp;
      return a.claimVersion - b.claimVersion;
    });

  // Sort resolvedConflicts stably by conflictId
  const sortedConflicts = [...payload.resolvedConflicts]
    .map((conflict) => ({
      conflictId: conflict.conflictId,
      type: normalizeString(conflict.type),
      resolution: normalizeString(conflict.resolution),
      reason: normalizeString(conflict.reason),
    }))
    .sort((a, b) => a.conflictId.localeCompare(b.conflictId));

  return {
    schemaVersion: payload.schemaVersion,
    canonicalisationVersion: payload.canonicalisationVersion,
    projectId: payload.projectId,
    handoverVersion: payload.handoverVersion,
    previousReceiptHash: payload.previousReceiptHash,
    claims: sortedClaims,
    resolvedConflicts: sortedConflicts,
  };
}

/**
 * Computes canonical JSON string for the snapshot
 */
export function canonicalizeSnapshot(payload: HandoverSnapshotPayload): string {
  const prepared = prepareCanonicalSnapshot(payload);
  return canonicalizeValue(prepared);
}

/**
 * Computes SHA-256 hash of canonical snapshot UTF-8 bytes
 * Returns 64-char lowercase hex string
 */
export function computeSnapshotHash(canonicalJson: string): string {
  return crypto.createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Verifies snapshot hash integrity
 */
export function verifySnapshotHash(canonicalJson: string, expectedHash: string): boolean {
  const computed = computeSnapshotHash(canonicalJson);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}
