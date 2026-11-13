"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { entityNameSchema, entityAliasSchema, createEntitySchema } from "@/services/entities/schema";
import { normalizeEntityKey } from "@/services/entities/resolution";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FilterPills } from "@/components/ui/filter-pills";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  GitMerge,
  Loader2,
  Network,
  Plus,
  ShieldAlert,
  X,
  Search,
  User,
  Cpu,
  Server,
} from "lucide-react";

interface EntityAliasItem {
  id: string;
  alias: string;
  normalizedAlias: string;
}

interface EntityItem {
  id: string;
  canonicalName: string;
  normalizedId: string;
  type: "PERSON" | "COMPONENT" | "SYSTEM";
  createdBy: "MODEL" | "REVIEWER";
  mergedIntoId: string | null;
  needsReview: boolean;
  aliases: EntityAliasItem[];
  claimCount: number;
  mergedCount: number;
}

export default function EntitiesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

  // Edit entity modal
  const [editing, setEditing] = useState<EntityItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"PERSON" | "COMPONENT" | "SYSTEM">("COMPONENT");
  const [editAliasesText, setEditAliasesText] = useState("");
  const [editNeedsReview, setEditNeedsReview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Merge entity modal
  const [mergingSource, setMergingSource] = useState<EntityItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Create manual entity modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"PERSON" | "COMPONENT" | "SYSTEM">("COMPONENT");
  const [newAliasesText, setNewAliasesText] = useState("");

  const loadEntities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/entities`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load entities");
      setEntities(json.data.entities || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load entities");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  function openEdit(entity: EntityItem) {
    setEditing(entity);
    setEditName(entity.canonicalName);
    setEditType(entity.type);
    setEditAliasesText(entity.aliases.map((a) => a.alias).join(", "));
    setEditNeedsReview(entity.needsReview);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    const parsed = entityNameSchema.safeParse(editName);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid entity name");
      return;
    }

    const trimmedEdit = parsed.data;
    const normalizedEdit = normalizeEntityKey(trimmedEdit);

    const collision = entities.find(
      (ent) => ent.normalizedId === normalizedEdit && ent.id !== editing.id
    );
    if (collision) {
      setError(`An entity with normalized name '${normalizedEdit}' already exists in this project ('${collision.canonicalName}').`);
      return;
    }

    const aliases = editAliasesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const a of aliases) {
      const aliasParsed = entityAliasSchema.safeParse(a);
      if (!aliasParsed.success) {
        setError(aliasParsed.error.issues[0]?.message || "Invalid entity alias");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/entities/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: trimmedEdit,
          type: editType,
          aliases,
          needsReview: editNeedsReview,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Update failed");

      setEditing(null);
      setSuccess(`Updated entity '${json.data.entity.canonicalName}'.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadEntities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!mergingSource || !mergeTargetId) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/entities/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEntityId: mergingSource.id,
          targetEntityId: mergeTargetId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Merge failed");

      setMergingSource(null);
      setMergeTargetId("");
      setSuccess("Merged entity and reassigned its claims and aliases cleanly.");
      setTimeout(() => setSuccess(null), 4000);
      await loadEntities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const rawAliases = newAliasesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parseResult = createEntitySchema.safeParse({
      canonicalName: newName,
      type: newType,
      aliases: rawAliases.length > 0 ? rawAliases : undefined,
    });

    if (!parseResult.success) {
      setError(parseResult.error.issues[0]?.message || "Invalid entity input");
      return;
    }

    const trimmedNew = parseResult.data.canonicalName;
    const normalizedNew = normalizeEntityKey(trimmedNew);

    const collision = entities.find((ent) => ent.normalizedId === normalizedNew);
    if (collision) {
      setError(`An entity with normalized name '${normalizedNew}' already exists in this project ('${collision.canonicalName}').`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const aliases = parseResult.data.aliases || [];

      const res = await fetch(`/api/projects/${projectId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: trimmedNew,
          type: newType,
          aliases,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Creation failed");

      setShowCreate(false);
      setNewName("");
      setNewAliasesText("");
      setSuccess(`Added canonical entity '${json.data.entity.canonicalName}'.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadEntities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setSaving(false);
    }
  }

  const flaggedEntities = entities.filter((e) => e.needsReview);
  const componentCount = entities.filter((e) => e.type === "COMPONENT").length;
  const personCount = entities.filter((e) => e.type === "PERSON").length;
  const systemCount = entities.filter((e) => e.type === "SYSTEM").length;

  const filteredEntities = entities.filter((entity) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      entity.canonicalName.toLowerCase().includes(q) ||
      entity.normalizedId.toLowerCase().includes(q) ||
      entity.aliases.some((a) => a.alias.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (typeFilter !== "ALL" && entity.type !== typeFilter) return false;
    if (needsReviewOnly && !entity.needsReview) return false;

    return true;
  });

  if (forbidden) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive">
        <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-80" />
        <h2 className="text-lg font-bold">Reviewer Permission Required</h2>
        <p className="text-sm mt-1">The Entity Registry is restricted to OWNER and REVIEWER roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">Project</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Entity Registry</span>
          </div>
        }
        title="Entity Registry & Resolution"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Network className="h-3.5 w-3.5" />
            Knowledge Graph
          </span>
        }
        description="Canonical people, components, and systems for this project. Merge duplicates and resolve ambiguous mentions before verification."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Entity
          </button>
        }
      />

      {/* Notifications */}
      {success && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-50/50 p-4 text-xs font-medium text-rose-800 dark:bg-rose-950/20 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {flaggedEntities.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-50/60 p-4 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Ambiguous Entities Require Review ({flaggedEntities.length})</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              One or more mentions match multiple candidate entities or share an ambiguous name. Review aliases or merge into a canonical entity.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Entities"
          value={entities.length}
          subtitle="Resolved graph nodes"
          icon={Network}
        />
        <MetricCard
          title="Component Entities"
          value={componentCount}
          subtitle="Modules, APIs & services"
          icon={Cpu}
        />
        <MetricCard
          title="Person Entities"
          value={personCount}
          subtitle="Contributors & owners"
          icon={User}
        />
        <MetricCard
          title="Ambiguous / Needs Review"
          value={flaggedEntities.length}
          subtitle={flaggedEntities.length === 0 ? "All entities confirmed" : "Requires reviewer resolution"}
          variant={flaggedEntities.length > 0 ? "warning" : "default"}
          icon={AlertTriangle}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <FilterPills
            options={[
              { id: "ALL", label: "All Entities", count: entities.length },
              { id: "COMPONENT", label: "Components", count: componentCount },
              { id: "PERSON", label: "Persons", count: personCount },
              { id: "SYSTEM", label: "Systems", count: systemCount },
            ]}
            selectedId={typeFilter}
            onSelect={setTypeFilter}
          />

          <label className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={needsReviewOnly}
              onChange={(e) => setNeedsReviewOnly(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Needs Review ({flaggedEntities.length})</span>
          </label>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search entity name or alias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>
      </div>

      {/* Entities Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredEntities.length === 0 ? (
        <EmptyState
          type="checked-empty"
          title={entities.length === 0 ? "No entities discovered yet" : "No matching entities found"}
          description={
            entities.length === 0
              ? "Run automated AI claim extraction on uploaded documents or add canonical entities manually."
              : "Try adjusting your search query or type filters to view available entities."
          }
          actionLabel={entities.length === 0 ? "Add First Entity" : undefined}
          onAction={entities.length === 0 ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Canonical Entity</th>
                  <th className="py-3 px-3 font-semibold">Type</th>
                  <th className="py-3 px-3 font-semibold">Known Aliases</th>
                  <th className="py-3 px-3 font-semibold text-center">Claims</th>
                  <th className="py-3 px-3 font-semibold">Review State</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEntities.map((entity) => (
                  <tr key={entity.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/25 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-foreground text-xs">{entity.canonicalName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {entity.normalizedId} • {entity.createdBy}
                        </p>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <Badge variant="neutral">
                        {entity.type === "COMPONENT" && <Cpu className="h-3 w-3 mr-1 text-primary" />}
                        {entity.type === "PERSON" && <User className="h-3 w-3 mr-1 text-emerald-600" />}
                        {entity.type === "SYSTEM" && <Server className="h-3 w-3 mr-1 text-amber-600" />}
                        {entity.type}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-3">
                      {entity.aliases.length === 0 ? (
                        <span className="text-muted-foreground text-[11px]">No aliases recorded</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {entity.aliases.map((a) => (
                            <span
                              key={a.id}
                              className="rounded-md border border-border bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 text-[10px] text-foreground font-mono"
                            >
                              {a.alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {entity.claimCount}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      {entity.needsReview ? (
                        <Badge variant="warning">
                          <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" /> Needs Review
                        </Badge>
                      ) : (
                        <Badge variant="verified">Canonical</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(entity)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer shadow-xs"
                          title="Edit entity name, type, and aliases"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        {entities.length > 1 && (
                          <button
                            onClick={() => {
                              setMergingSource(entity);
                              const fallbackTarget = entities.find((t) => t.id !== entity.id);
                              setMergeTargetId(fallbackTarget?.id ?? "");
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer shadow-xs"
                            title="Soft merge this entity into another canonical entity"
                          >
                            <GitMerge className="h-3.5 w-3.5" /> Merge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Entity Modal */}
      {editing && (
        <Modal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          title="Edit Entity & Aliases"
          description="Update canonical name, classification, and known alias synonyms."
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-foreground mb-1">Canonical Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Entity Type</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as "PERSON" | "COMPONENT" | "SYSTEM")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="COMPONENT">COMPONENT</option>
                <option value="PERSON">PERSON</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Aliases (comma-separated)</label>
              <textarea
                rows={2}
                value={editAliasesText}
                onChange={(e) => setEditAliasesText(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-foreground">
              <input
                type="checkbox"
                checked={editNeedsReview}
                onChange={(e) => setEditNeedsReview(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span>Flagged as ambiguous / requires reviewer investigation</span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-3.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Merge Modal */}
      {mergingSource && (
        <Modal
          isOpen={!!mergingSource}
          onClose={() => setMergingSource(null)}
          title="Merge Entity"
          description={`Soft-merge "${mergingSource.canonicalName}" (${mergingSource.claimCount} claims) into a canonical target entity.`}
        >
          <form onSubmit={handleMerge} className="space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              All claims and aliases associated with <strong>{mergingSource.canonicalName}</strong> will transfer atomically to the selected target.
            </p>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Target Canonical Entity</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                {entities
                  .filter((t) => t.id !== mergingSource.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.canonicalName} ({t.type})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setMergingSource(null)}
                className="rounded-lg border border-border px-3.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Soft Merge
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Manual Entity Modal */}
      {showCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add Canonical Entity"
          description="Create a verified project entity with optional recognized alias synonyms."
        >
          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-foreground mb-1">Canonical Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Authentication Module"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "PERSON" | "COMPONENT" | "SYSTEM")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="COMPONENT">COMPONENT</option>
                <option value="PERSON">PERSON</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">Aliases (optional, comma-separated)</label>
              <input
                type="text"
                value={newAliasesText}
                onChange={(e) => setNewAliasesText(e.target.value)}
                placeholder="e.g. Auth module, login service"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Entity
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
