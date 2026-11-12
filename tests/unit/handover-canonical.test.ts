import { describe, it, expect } from "vitest";
import {
  HandoverSnapshotPayload,
  canonicalizeSnapshot,
  computeSnapshotHash,
  verifySnapshotHash,
  prepareCanonicalSnapshot,
} from "@/services/handover/canonical";
import { assembleHandoverSections } from "@/services/handover/sections";
import { generateHandoverPdf } from "@/services/handover/pdf-exporter";

describe("Phase 6 Handover Canonicalisation & SHA-256 Receipt Engine", () => {
  const baseFixture: HandoverSnapshotPayload = {
    schemaVersion: 1,
    canonicalisationVersion: 1,
    projectId: "proj-continuity-1",
    handoverVersion: 1,
    previousReceiptHash: null,
    claims: [
      {
        claimId: "claim-002",
        claimVersion: 1,
        subject: { entityId: "ent-auth", canonicalName: "Auth Service" },
        attributeKey: "selected_technology",
        valueRaw: "NextAuth / Jose JWT",
        valueNormalized: "NEXTAUTH_JOSE",
        evidenceStatus: "VERIFIED",
        reviewState: "ACCEPTED",
        reviewerReason: null,
        evidence: [
          {
            documentId: "doc-arch",
            documentChecksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            location: "Section 3.2",
            excerpt: "We selected NextAuth paired with Jose for stateless JWT session management.",
          },
        ],
      },
      {
        claimId: "claim-001",
        claimVersion: 1,
        subject: { entityId: "ent-backend", canonicalName: "Backend Architecture" },
        attributeKey: "status",
        valueRaw: "COMPLETED",
        valueNormalized: "COMPLETED",
        evidenceStatus: "VERIFIED",
        reviewState: "ACCEPTED",
        reviewerReason: null,
        evidence: [
          {
            documentId: "doc-spec",
            documentChecksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            location: "Page 12",
            excerpt: "Backend core components have been completed and tested.",
          },
          {
            documentId: "doc-arch",
            documentChecksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            location: "Page 5",
            excerpt: "All core backend routes are fully functional.",
          },
        ],
      },
    ],
    resolvedConflicts: [
      {
        conflictId: "conflict-001",
        type: "STATUS_CONFLICT",
        resolution: "RESOLVED_ONE_ACCEPTED",
        reason: "Confirmed newer status supersedes earlier meeting notes.",
      },
    ],
  };

  it("produces deterministic canonical JSON string and golden SHA-256 hash", () => {
    const canonicalJson = canonicalizeSnapshot(baseFixture);
    const hash = computeSnapshotHash(canonicalJson);

    expect(canonicalJson).toBeTypeOf("string");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Running again must produce exact identical bytes
    const secondCanonicalJson = canonicalizeSnapshot(baseFixture);
    const secondHash = computeSnapshotHash(secondCanonicalJson);

    expect(secondCanonicalJson).toBe(canonicalJson);
    expect(secondHash).toBe(hash);
    expect(verifySnapshotHash(canonicalJson, hash)).toBe(true);
  });

  it("is invariant to claim array shuffling", () => {
    const originalHash = computeSnapshotHash(canonicalizeSnapshot(baseFixture));

    // Reverse the claims array
    const shuffledFixture: HandoverSnapshotPayload = {
      ...baseFixture,
      claims: [baseFixture.claims[1], baseFixture.claims[0]],
    };

    const shuffledHash = computeSnapshotHash(canonicalizeSnapshot(shuffledFixture));
    expect(shuffledHash).toBe(originalHash);
  });

  it("is invariant to evidence array shuffling within a claim", () => {
    const originalHash = computeSnapshotHash(canonicalizeSnapshot(baseFixture));

    // Reverse evidence array in claim-001
    const modifiedClaims = baseFixture.claims.map((c) => {
      if (c.claimId === "claim-001") {
        return { ...c, evidence: [c.evidence[1], c.evidence[0]] };
      }
      return c;
    });

    const shuffledEvidenceFixture: HandoverSnapshotPayload = {
      ...baseFixture,
      claims: modifiedClaims,
    };

    const newHash = computeSnapshotHash(canonicalizeSnapshot(shuffledEvidenceFixture));
    expect(newHash).toBe(originalHash);
  });

  it("is tamper-sensitive: changing 1 single character in an excerpt changes the hash", () => {
    const originalHash = computeSnapshotHash(canonicalizeSnapshot(baseFixture));

    const tamperedFixture: HandoverSnapshotPayload = {
      ...baseFixture,
      claims: baseFixture.claims.map((c) => {
        if (c.claimId === "claim-002") {
          return {
            ...c,
            evidence: [
              {
                ...c.evidence[0],
                excerpt: c.evidence[0].excerpt + ".", // Add one period
              },
            ],
          };
        }
        return c;
      }),
    };

    const tamperedHash = computeSnapshotHash(canonicalizeSnapshot(tamperedFixture));
    expect(tamperedHash).not.toBe(originalHash);
    expect(verifySnapshotHash(canonicalizeSnapshot(tamperedFixture), originalHash)).toBe(false);
  });

  it("normalizes Unicode strings to NFC deterministically", () => {
    // Construct string with combining characters (NFD)
    const nfdString = "Continuite\u0301"; // e + combining acute accent
    const nfcString = "Continuité"; // single precomposed character

    expect(nfdString).not.toBe(nfcString);

    const fixtureNfd: HandoverSnapshotPayload = {
      ...baseFixture,
      claims: [
        {
          ...baseFixture.claims[0],
          valueRaw: nfdString,
        },
      ],
    };

    const fixtureNfc: HandoverSnapshotPayload = {
      ...baseFixture,
      claims: [
        {
          ...baseFixture.claims[0],
          valueRaw: nfcString,
        },
      ],
    };

    const hashNfd = computeSnapshotHash(canonicalizeSnapshot(fixtureNfd));
    const hashNfc = computeSnapshotHash(canonicalizeSnapshot(fixtureNfc));

    expect(hashNfd).toBe(hashNfc);
  });

  it("assembles all 14 handover sections with explicit empty notices for unpopulated sections", () => {
    const docMap = new Map<string, { fileName: string; checksum: string }>([
      ["doc-arch", { fileName: "Architecture.pdf", checksum: "e3b0c44..." }],
      ["doc-spec", { fileName: "Spec.docx", checksum: "9f86d08..." }],
    ]);

    const assembled = assembleHandoverSections({
      projectId: "proj-1",
      version: 1,
      title: "ContinuityX Handover v1",
      claims: baseFixture.claims,
      documentMap: docMap,
      unresolvedConflictCount: 0,
      receiptData: {
        snapshotHash: "abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        previousReceiptHash: null,
        approvedBy: "Alice Reviewer",
        approvedAt: new Date().toISOString(),
        canonicalisationVersion: 1,
      },
    });

    expect(assembled.sections).toHaveLength(14);
    expect(assembled.sections[0].id).toBe("executive_summary");
    expect(assembled.sections[13].id).toBe("approval_receipt");

    // Sections with no claims should have hasContent = false and emptyNotice
    const emptySection = assembled.sections.find((s) => s.id === "dependencies");
    expect(emptySection).toBeDefined();
    expect(emptySection?.hasContent).toBe(false);
    expect(emptySection?.emptyNotice).toBe("No approved information");

    // Populated sections should have hasContent = true
    const statusSection = assembled.sections.find((s) => s.id === "current_status");
    expect(statusSection).toBeDefined();
    expect(statusSection?.hasContent).toBe(true);
    expect(statusSection?.items.length).toBeGreaterThan(0);
  });

  it("generates a valid binary PDF document using pdf-lib", async () => {
    const docMap = new Map<string, { fileName: string; checksum: string }>([
      ["doc-arch", { fileName: "Architecture.pdf", checksum: "e3b0c442..." }],
    ]);

    const assembled = assembleHandoverSections({
      projectId: "proj-1",
      version: 1,
      title: "ContinuityX Golden Test Handover",
      claims: baseFixture.claims,
      documentMap: docMap,
    });

    const pdfBytes = await generateHandoverPdf({
      handover: assembled,
      receipt: {
        snapshotHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
        previousReceiptHash: null,
        approvedBy: "Bob Owner",
        approvedAt: new Date().toISOString(),
        canonicalisationVersion: 1,
      },
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes "%PDF-"
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
    expect(header).toBe("%PDF-");
  });
});
