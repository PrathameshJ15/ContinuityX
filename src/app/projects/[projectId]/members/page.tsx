"use client";

import { useEffect, useState, use, useCallback } from "react";
import {
  UserPlus,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

interface MemberItem {
  id: string;
  userId: string;
  role: "OWNER" | "REVIEWER" | "VIEWER";
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ProjectData {
  id: string;
  name: string;
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
  members: MemberItem[];
}

export default function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Member form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "REVIEWER" | "VIEWER">("VIEWER");
  const [submitting, setSubmitting] = useState(false);

  // Row update action state
  const [actionId, setActionId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to load project members");
      }
      setProject(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading members");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add member");
      }

      setEmail("");
      setRole("VIEWER");
      setSuccess("Member added successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: "OWNER" | "REVIEWER" | "VIEWER") {
    setActionId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to change member role");
      }

      setSuccess("Member role updated.");
      setTimeout(() => setSuccess(null), 3000);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setActionId(null);
    }
  }

  async function handleRemoveMember(userId: string, memberName: string) {
    if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;

    setActionId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to remove member");
      }

      setSuccess("Member removed.");
      setTimeout(() => setSuccess(null), 3000);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium">Loading project members...</p>
      </div>
    );
  }

  if (!project) return null;

  const isOwner = project.currentUserRole === "OWNER";
  const ownerCount = project.members.filter((m) => m.role === "OWNER").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team Members & Access Control</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage project membership, roles, and review authorizations.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>You have {project.currentUserRole} access. Only project Owners can invite new members or change team roles.</span>
        </div>
      )}

      {/* Add Member Form (OWNER only) */}
      {isOwner && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-1">Invite Team Member</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Add an existing registered user to this project workspace.
          </p>

          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="memberEmail" className="sr-only">
                User Email
              </label>
              <input
                id="memberEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="w-full sm:w-40">
              <label htmlFor="memberRole" className="sr-only">
                Project Role
              </label>
              <select
                id="memberRole"
                value={role}
                onChange={(e) => setRole(e.target.value as "OWNER" | "REVIEWER" | "VIEWER")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="VIEWER">VIEWER</option>
                <option value="REVIEWER">REVIEWER</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Add Member
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-base">Project Roster ({project.members.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Joined Date</th>
                {isOwner && <th className="px-6 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {project.members.map((member) => {
                const isMemberLastOwner = member.role === "OWNER" && ownerCount <= 1;
                const isWorking = actionId === member.user.id;

                return (
                  <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{member.user.name}</div>
                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      {isOwner ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            disabled={isWorking || (member.role === "OWNER" && isMemberLastOwner)}
                            onChange={(e) =>
                              handleRoleChange(member.user.id, e.target.value as "OWNER" | "REVIEWER" | "VIEWER")
                            }
                            title={
                              isMemberLastOwner
                                ? "Cannot demote the last remaining owner of the project."
                                : "Change member role"
                            }
                            className="rounded border border-input bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          >
                            <option value="OWNER">OWNER</option>
                            <option value="REVIEWER">REVIEWER</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                          {isMemberLastOwner && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              (Sole Owner)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            member.role === "OWNER"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300"
                              : member.role === "REVIEWER"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                          }`}
                        >
                          {member.role}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>

                    {isOwner && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemoveMember(member.user.id, member.user.name)}
                          disabled={isWorking || isMemberLastOwner}
                          title={
                            isMemberLastOwner
                              ? "Cannot remove the last owner of the project."
                              : "Remove member from project"
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isWorking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Remove</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Guide Info Box */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs space-y-2">
        <div className="font-semibold flex items-center gap-1.5 text-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" /> Role Permissions Guide
        </div>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>OWNER:</strong> Full access to manage project settings, team members, documents, verifications, and approvals.</li>
          <li><strong>REVIEWER:</strong> Can upload documents, run extraction/verification, review claims, and approve handovers.</li>
          <li><strong>VIEWER:</strong> Read-only access to approved handovers, cryptographic receipts, and grounded Q&amp;A.</li>
        </ul>
      </div>
    </div>
  );
}
