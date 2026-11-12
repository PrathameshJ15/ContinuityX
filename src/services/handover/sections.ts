import { SnapshotClaimItem, SnapshotEvidenceItem } from "./canonical";

export interface HandoverSectionItem {
  id: string;
  title: string;
  description?: string;
  claimId?: string;
  subject: string;
  attribute: string;
  valueRaw: string;
  valueNormalized: string | null;
  evidenceStatus: string;
  reviewState: string;
  reviewerReason?: string | null;
  evidence: Array<{
    documentId: string;
    documentChecksum: string;
    fileName?: string;
    location: string;
    excerpt: string;
  }>;
}

export interface HandoverSection {
  id: string;
  number: number;
  title: string;
  description: string;
  hasContent: boolean;
  emptyNotice?: string;
  items: HandoverSectionItem[];
  metadata?: Record<string, unknown>;
}

export interface HandoverDocumentRef {
  documentId: string;
  fileName: string;
  checksum: string;
  citationCount: number;
  locations: string[];
}

export interface AssembledHandover {
  title: string;
  projectId: string;
  version: number;
  generatedAt: string;
  sections: HandoverSection[];
  totalClaimsCount: number;
  verifiedClaimsCount: number;
  reviewerAcceptedCount: number;
  totalDocumentsCount: number;
}

/**
 * Deterministically constructs the 14 handover sections from approved claims.
 * SPEC.md & TECH_DESIGN.md Rule: A section with no approved information must say so explicitly.
 * Never fills gaps with invented text. No LLM-generated text in this phase.
 */
export function assembleHandoverSections(params: {
  projectId: string;
  version: number;
  title: string;
  claims: SnapshotClaimItem[];
  documentMap: Map<string, { fileName: string; checksum: string }>;
  unresolvedConflictCount?: number;
  receiptData?: {
    snapshotHash: string;
    previousReceiptHash: string | null;
    approvedBy: string;
    approvedAt: string;
    canonicalisationVersion: number;
  };
}): AssembledHandover {
  const { projectId, version, title, claims, documentMap, unresolvedConflictCount = 0, receiptData } = params;

  // Enhance evidence items with document file names
  const enhanceEvidence = (evList: SnapshotEvidenceItem[]) =>
    evList.map((ev) => ({
      documentId: ev.documentId,
      documentChecksum: ev.documentChecksum,
      fileName: documentMap.get(ev.documentId)?.fileName || "Document",
      location: ev.location,
      excerpt: ev.excerpt,
    }));

  const mapClaimToItem = (claim: SnapshotClaimItem): HandoverSectionItem => ({
    id: claim.claimId,
    claimId: claim.claimId,
    title: `${claim.subject.canonicalName}: ${claim.attributeKey}`,
    subject: claim.subject.canonicalName,
    attribute: claim.attributeKey,
    valueRaw: claim.valueRaw,
    valueNormalized: claim.valueNormalized,
    evidenceStatus: claim.evidenceStatus,
    reviewState: claim.reviewState,
    reviewerReason: claim.reviewerReason,
    evidence: enhanceEvidence(claim.evidence),
  });

  // Calculate statistics
  const totalClaimsCount = claims.length;
  const verifiedClaimsCount = claims.filter((c) => c.evidenceStatus === "VERIFIED").length;
  const reviewerAcceptedCount = claims.filter(
    (c) => c.reviewState === "ACCEPTED" && c.evidenceStatus !== "VERIFIED"
  ).length;

  // 1. Executive Summary
  const executiveItems: HandoverSectionItem[] = [
    {
      id: "summary-metrics",
      title: "Project Handover Knowledge Metrics",
      subject: "Summary",
      attribute: "knowledge_statistics",
      valueRaw: `${totalClaimsCount} accepted claims (${verifiedClaimsCount} VERIFIED, ${reviewerAcceptedCount} reviewer-accepted with explicit reason)`,
      valueNormalized: null,
      evidenceStatus: "VERIFIED",
      reviewState: "ACCEPTED",
      evidence: [],
    },
  ];

  // 2. Objectives
  const objectiveClaims = claims.filter(
    (c) =>
      c.attributeKey === "objective" ||
      c.attributeKey === "goal" ||
      c.subject.canonicalName.toLowerCase().includes("objective") ||
      c.subject.canonicalName.toLowerCase().includes("goal")
  );

  // 3. Current Status
  const statusClaims = claims.filter((c) => c.attributeKey === "status");

  // 4. Technical Architecture
  const architectureClaims = claims.filter(
    (c) =>
      c.attributeKey === "selected_technology" ||
      c.attributeKey === "architecture" ||
      c.attributeKey === "database" ||
      c.attributeKey === "framework"
  );

  // 5. Decisions with Rationale
  const decisionClaims = claims.filter(
    (c) => c.attributeKey === "selected_technology" || c.attributeKey === "rationale" || c.attributeKey === "decision"
  );

  // 6. Completed Tasks
  const completedTaskClaims = claims.filter(
    (c) => c.attributeKey === "status" && c.valueNormalized === "COMPLETED"
  );

  // 7. Pending Tasks
  const pendingTaskClaims = claims.filter(
    (c) =>
      c.attributeKey === "status" &&
      (c.valueNormalized === "NOT_STARTED" ||
        c.valueNormalized === "IN_PROGRESS" ||
        c.valueNormalized === "BLOCKED")
  );

  // 8. Ownership
  const ownershipClaims = claims.filter((c) => c.attributeKey === "owner");

  // 9. Dependencies
  const dependencyClaims = claims.filter((c) => c.attributeKey === "depends_on");

  // 10. Risks and Blockers
  const riskClaims = claims.filter(
    (c) => c.attributeKey === "risk" || (c.attributeKey === "status" && c.valueNormalized === "BLOCKED")
  );

  // 11. Unresolved Questions
  const questionClaims = claims.filter((c) => c.attributeKey === "open_question");

  // 12. Recommended Next Actions (Rule-derived: pending tasks without owner, open questions, unresolved conflicts)
  const ownerSubjects = new Set(ownershipClaims.map((c) => c.subject.canonicalName.toLowerCase()));
  const unassignedTasks = pendingTaskClaims.filter(
    (c) => !ownerSubjects.has(c.subject.canonicalName.toLowerCase())
  );

  const nextActionItems: HandoverSectionItem[] = [];

  for (const task of unassignedTasks) {
    nextActionItems.push({
      id: `action-unassigned-${task.claimId}`,
      title: `Assign Owner to Pending Task: ${task.subject.canonicalName}`,
      subject: task.subject.canonicalName,
      attribute: "recommended_action",
      valueRaw: `Pending task currently has status '${task.valueRaw}' but no confirmed owner claim.`,
      valueNormalized: "ASSIGN_OWNER",
      evidenceStatus: task.evidenceStatus,
      reviewState: task.reviewState,
      evidence: enhanceEvidence(task.evidence),
    });
  }

  for (const q of questionClaims) {
    nextActionItems.push({
      id: `action-question-${q.claimId}`,
      title: `Clarify Open Question: ${q.subject.canonicalName}`,
      subject: q.subject.canonicalName,
      attribute: "recommended_action",
      valueRaw: `Address open question: ${q.valueRaw}`,
      valueNormalized: "RESOLVE_QUESTION",
      evidenceStatus: q.evidenceStatus,
      reviewState: q.reviewState,
      evidence: enhanceEvidence(q.evidence),
    });
  }

  if (unresolvedConflictCount > 0) {
    nextActionItems.push({
      id: "action-unresolved-conflicts",
      title: "Resolve Outstanding Project Conflicts",
      subject: "Workspace",
      attribute: "recommended_action",
      valueRaw: `There are ${unresolvedConflictCount} unresolved conflicts remaining in project candidate claims.`,
      valueNormalized: "RESOLVE_CONFLICTS",
      evidenceStatus: "CONFLICTING",
      reviewState: "PENDING",
      evidence: [],
    });
  }

  // 13. Evidence References
  const docRefMap = new Map<string, HandoverDocumentRef>();
  for (const claim of claims) {
    for (const ev of claim.evidence) {
      const doc = documentMap.get(ev.documentId);
      const existing = docRefMap.get(ev.documentId) || {
        documentId: ev.documentId,
        fileName: doc?.fileName || `Document ${ev.documentId.slice(0, 8)}`,
        checksum: ev.documentChecksum,
        citationCount: 0,
        locations: [],
      };
      existing.citationCount += 1;
      if (!existing.locations.includes(ev.location)) {
        existing.locations.push(ev.location);
      }
      docRefMap.set(ev.documentId, existing);
    }
  }

  const evidenceRefItems: HandoverSectionItem[] = Array.from(docRefMap.values()).map((doc) => ({
    id: `doc-${doc.documentId}`,
    title: doc.fileName,
    subject: doc.fileName,
    attribute: "document_reference",
    valueRaw: `SHA-256: ${doc.checksum} | Cited ${doc.citationCount} times at: ${doc.locations.slice(0, 5).join(", ")}${doc.locations.length > 5 ? "..." : ""}`,
    valueNormalized: doc.checksum,
    evidenceStatus: "VERIFIED",
    reviewState: "ACCEPTED",
    evidence: [],
  }));

  // 14. Approval Receipt
  const receiptItems: HandoverSectionItem[] = receiptData
    ? [
        {
          id: "approval-receipt-item",
          title: "Cryptographic Handover Receipt",
          subject: "Receipt",
          attribute: "sha256_snapshot_hash",
          valueRaw: receiptData.snapshotHash,
          valueNormalized: receiptData.snapshotHash,
          evidenceStatus: "VERIFIED",
          reviewState: "ACCEPTED",
          reviewerReason: `Approved by ${receiptData.approvedBy} on ${new Date(receiptData.approvedAt).toUTCString()}`,
          evidence: [],
        },
      ]
    : [];

  const createSection = (
    number: number,
    id: string,
    sectionTitle: string,
    description: string,
    items: HandoverSectionItem[]
  ): HandoverSection => ({
    id,
    number,
    title: sectionTitle,
    description,
    hasContent: items.length > 0,
    emptyNotice: items.length === 0 ? "No approved information" : undefined,
    items,
  });

  const sections: HandoverSection[] = [
    createSection(1, "executive_summary", "1. Executive Summary", "High-level metrics and knowledge statistics derived from accepted project claims.", executiveItems),
    createSection(2, "objectives", "2. Objectives & Goals", "Core project mission, targets, and expected outcomes.", objectiveClaims.map(mapClaimToItem)),
    createSection(3, "current_status", "3. Current Status", "Current execution state, milestones, and high-level health.", statusClaims.map(mapClaimToItem)),
    createSection(4, "technical_architecture", "4. Technical Architecture", "Systems, components, design choices, and structural topology.", architectureClaims.map(mapClaimToItem)),
    createSection(5, "decisions_rationale", "5. Decisions with Rationale", "Archived decisions, technology selections, and documented justification.", decisionClaims.map(mapClaimToItem)),
    createSection(6, "completed_tasks", "6. Completed Tasks", "Deliverables and work items successfully finalized and verified.", completedTaskClaims.map(mapClaimToItem)),
    createSection(7, "pending_tasks", "7. Pending Tasks", "In-progress, not started, or blocked tasks awaiting execution.", pendingTaskClaims.map(mapClaimToItem)),
    createSection(8, "ownership", "8. Ownership & Responsibilities", "Assigned team members, module owners, and verified co-owners.", ownershipClaims.map(mapClaimToItem)),
    createSection(9, "dependencies", "9. Dependencies", "Prerequisite packages, external services, and inter-component dependencies.", dependencyClaims.map(mapClaimToItem)),
    createSection(10, "risks_blockers", "10. Risks & Blockers", "Identified risks, active impediments, and architectural hazards.", riskClaims.map(mapClaimToItem)),
    createSection(11, "unresolved_questions", "11. Unresolved Questions", "Ambiguities, open questions, and decisions requiring stakeholder feedback.", questionClaims.map(mapClaimToItem)),
    createSection(12, "recommended_next_actions", "12. Recommended Next Actions", "Rule-derived next steps (unassigned tasks, open questions, unresolved conflicts).", nextActionItems),
    createSection(13, "evidence_references", "13. Evidence References", "Source documents, file checksums, and citation points across all verified claims.", evidenceRefItems),
    createSection(14, "approval_receipt", "14. Approval Receipt", "Integrity fingerprint, approval timestamp, reviewer identity, and version chain.", receiptItems),
  ];

  return {
    title,
    projectId,
    version,
    generatedAt: new Date().toISOString(),
    sections,
    totalClaimsCount,
    verifiedClaimsCount,
    reviewerAcceptedCount,
    totalDocumentsCount: docRefMap.size,
  };
}
