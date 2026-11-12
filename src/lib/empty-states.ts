export interface EmptyStateInfo {
  state: "NO_DATA" | "CHECKED_EMPTY" | "POPULATED";
  title: string;
  description: string;
  linkHref?: string;
  linkLabel?: string;
}

export const NO_CLAIMS_TITLE = "No claims yet. Upload documents and run extraction first";

export function getRadarEmptyState(
  totalClaims: number,
  alertCount: number,
  ruleFilter: string = "ALL"
): EmptyStateInfo {
  if (totalClaims === 0) {
    return {
      state: "NO_DATA",
      title: NO_CLAIMS_TITLE,
      description: "Upload source documents and run automated claim extraction to begin scanning for knowledge loss risks.",
      linkHref: "documents",
      linkLabel: "Go to Documents",
    };
  }
  if (alertCount === 0) {
    return {
      state: "CHECKED_EMPTY",
      title: "Zero Active Knowledge Loss Indicators",
      description:
        ruleFilter !== "ALL"
          ? `No alerts detected matching Rule ${ruleFilter}.`
          : "All critical components have verified redundancy, documented rationale, and assigned owners.",
    };
  }
  return { state: "POPULATED", title: "", description: "" };
}

export function getReviewQueueEmptyState(
  totalClaims: number,
  queueLength: number
): EmptyStateInfo {
  if (totalClaims === 0) {
    return {
      state: "NO_DATA",
      title: NO_CLAIMS_TITLE,
      description: "Upload project documentation and run automated claim extraction to populate the evidence review queue.",
      linkHref: "documents",
      linkLabel: "Go to Documents",
    };
  }
  if (queueLength === 0) {
    return {
      state: "CHECKED_EMPTY",
      title: "Review Queue Complete!",
      description: "All extracted candidate claims in this project have been reviewed or resolved. You are ready to inspect conflicts or generate the handover snapshot.",
    };
  }
  return { state: "POPULATED", title: "", description: "" };
}

export function getBusFactorEmptyState(
  totalClaims: number,
  componentCount: number
): EmptyStateInfo {
  if (totalClaims === 0) {
    return {
      state: "NO_DATA",
      title: NO_CLAIMS_TITLE,
      description: "Upload architecture documents to extract COMPONENT entities and owner claims.",
      linkHref: "documents",
      linkLabel: "Go to Documents",
    };
  }
  if (componentCount === 0) {
    return {
      state: "CHECKED_EMPTY",
      title: "No Component Entities Found",
      description: "No entities of type COMPONENT were detected in the extracted claims. Upload architecture documents to extract COMPONENT entities and owner claims.",
      linkHref: "documents",
      linkLabel: "Go to Documents",
    };
  }
  return { state: "POPULATED", title: "", description: "" };
}

export function getConflictsEmptyState(
  totalClaims: number,
  conflictCount: number,
  statusFilter: string = "ALL"
): EmptyStateInfo {
  if (totalClaims === 0) {
    return {
      state: "NO_DATA",
      title: NO_CLAIMS_TITLE,
      description: "Pairwise contradiction and conflict detection requires extracted claims to compare against each other.",
      linkHref: "documents",
      linkLabel: "Go to Documents",
    };
  }
  if (conflictCount === 0) {
    return {
      state: "CHECKED_EMPTY",
      title: "No Conflicts Found",
      description:
        statusFilter === "ALL"
          ? "All candidate claims in this project are mutually consistent."
          : `No conflicts matching filter '${statusFilter}'.`,
    };
  }
  return { state: "POPULATED", title: "", description: "" };
}
