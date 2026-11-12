"use client";

import { useEffect, useState, use, useCallback } from "react";
import { z } from "zod";
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

    const entityNameSchema = z
      .string()
      .trim()
      .min(2, "Entity name must be at least 2 characters.")
      .regex(/[a-zA-Z]/, "Entity name must contain at least one letter.");

    const parsed = entityNameSchema.safeParse(editName);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid entity name");
      return;
    }

    const trimmedEdit = parsed.data;
    const normalizedEdit = trimmedEdit
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const collision = entities.find(
      (ent) => ent.normalizedId === normalizedEdit && ent.id !== editing.id
    );
    if (collision) {
      setError(`An entity with normalized name '${normalizedEdit}' already exists in this project ('${collision.canonicalName}').`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const aliases = editAliasesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

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

    const entityNameSchema = z
      .string()
      .trim()
      .min(2, "Entity name must be at least 2 characters.")
      .regex(/[a-zA-Z]/, "Entity name must contain at least one letter.");

    const parsed = entityNameSchema.safeParse(newName);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid entity name");
      return;
    }

    const trimmedNew = parsed.data;
    const normalizedNew = trimmedNew
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const collision = entities.find((ent) => ent.normalizedId === normalizedNew);
    if (collision) {
      setError(`An entity with normalized name '${normalizedNew}' already exists in this project ('${collision.canonicalName}').`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const aliases = newAliasesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

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

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading project entity registry...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center max-w-lg mx-auto my-8 space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold">Reviewer Permission Required</h3>
        <p className="text-sm text-muted-foreground">
          The Entity Registry is restricted to OWNER and REVIEWER roles.
        </p>
      </div>
    );
  }

  const flaggedEntities = entities.filter((e) => e.needsReview);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entity Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Canonical people, components, and systems for this project. Merge duplicates or resolve ambiguous mentions before verification.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Entity
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {flaggedEntities.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ambiguous Entities Require Review ({flaggedEntities.length})</p>
            <p className="text-xs mt-0.5">
              One or more mentions could match multiple entities or share a first name. Review, add aliases, or merge into the right canonical entity.
            </p>
          </div>
        </div>
      )}

      {entities.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center text-muted-foreground space-y-2">
          <Network className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm font-medium text-foreground">No entities discovered yet</p>
          <p className="text-xs">
            Run AI extraction on processed documents or add canonical entities manually.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Canonical Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Aliases</th>
                <th className="px-5 py-3">Claims</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entities.map((entity) => (
                <tr key={entity.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold">{entity.canonicalName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {entity.normalizedId} · {entity.createdBy}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5 font-medium">{entity.type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {entity.aliases.map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full border bg-background px-2 py-0.5 text-[11px]"
                        >
                          {a.alias}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-medium">{entity.claimCount}</td>
                  <td className="px-5 py-3.5 text-xs">
                    {entity.needsReview ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 font-semibold">
                        <AlertTriangle className="h-3 w-3" /> Needs Review
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Canonical
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(entity)}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit / Aliases
                      </button>
                      {entities.length > 1 && (
                        <button
                          onClick={() => {
                            setMergingSource(entity);
                            const fallbackTarget = entities.find((t) => t.id !== entity.id);
                            setMergeTargetId(fallbackTarget?.id ?? "");
                          }}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
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
      )}

      {/* Edit Entity Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Entity &amp; Aliases</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Canonical Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Entity Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as "PERSON" | "COMPONENT" | "SYSTEM")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="COMPONENT">COMPONENT</option>
                  <option value="PERSON">PERSON</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Aliases (comma-separated)</label>
                <textarea
                  rows={2}
                  value={editAliasesText}
                  onChange={(e) => setEditAliasesText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editNeedsReview}
                  onChange={(e) => setEditNeedsReview(e.target.checked)}
                />
                Flagged as ambiguous / needs review
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Merge Modal */}
      {mergingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleMerge}
            className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Merge Entity</h3>
              <button
                type="button"
                onClick={() => setMergingSource(null)}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Soft-merge <strong>{mergingSource.canonicalName}</strong> ({mergingSource.claimCount} claims) into a canonical target entity. Its aliases and claims will transfer atomically.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1">Target Canonical Entity</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMergingSource(null)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Soft Merge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Manual Entity Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-xl border bg-card shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Add Canonical Entity</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Canonical Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Authentication Module"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "PERSON" | "COMPONENT" | "SYSTEM")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="COMPONENT">COMPONENT</option>
                  <option value="PERSON">PERSON</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Aliases (optional, comma-separated)</label>
                <input
                  type="text"
                  value={newAliasesText}
                  onChange={(e) => setNewAliasesText(e.target.value)}
                  placeholder="e.g. Auth module, login service"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Entity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
