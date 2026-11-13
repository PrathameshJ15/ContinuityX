"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { formatRoleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Users,
  ShieldCheck,
  UserCheck,
  Eye,
  X,
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

  if (loading && !project) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
              <span>/</span>
              <span>Team & Access</span>
            </div>
          }
          title="Team Members & Access Control"
          description="Loading project roster..."
        />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (!project) return null;

  const isOwner = project.currentUserRole === "OWNER";
  const ownerCount = project.members.filter((m) => m.role === "OWNER").length;
  const reviewerCount = project.members.filter((m) => m.role === "REVIEWER").length;
  const viewerCount = project.members.filter((m) => m.role === "VIEWER").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project.name}</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Team & Access</span>
          </div>
        }
        title="Team Members & Access Control"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            12-Permission RBAC
          </span>
        }
        description="Manage project membership, assigned roles, and review authorizations across the workspace."
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

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-50/50 p-3.5 text-xs text-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>You currently hold <strong>{formatRoleLabel(project.currentUserRole)}</strong> access. Only project Owners can invite new members or change team roles.</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Members"
          value={project.members.length}
          subtitle="Authorized users"
          icon={Users}
        />
        <MetricCard
          title="Project Owners"
          value={ownerCount}
          subtitle="Full administrative control"
          icon={Shield}
        />
        <MetricCard
          title="Reviewers"
          value={reviewerCount}
          subtitle="Evidence review & handover approval"
          icon={UserCheck}
        />
        <MetricCard
          title="Viewers"
          value={viewerCount}
          subtitle="Read-only & Q&A access"
          icon={Eye}
        />
      </div>

      {/* Invite Member Card (OWNER only) */}
      {isOwner && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Invite Team Member</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add a registered colleague to this project workspace with designated role permissions.
            </p>
          </div>

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
                className="w-full rounded-lg border border-border bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            <div className="w-full sm:w-44">
              <label htmlFor="memberRole" className="sr-only">
                Project Role
              </label>
              <select
                id="memberRole"
                value={role}
                onChange={(e) => setRole(e.target.value as "OWNER" | "REVIEWER" | "VIEWER")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              >
                <option value="VIEWER">{formatRoleLabel("VIEWER")}</option>
                <option value="REVIEWER">{formatRoleLabel("REVIEWER")}</option>
                <option value="OWNER">{formatRoleLabel("OWNER")}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-all disabled:opacity-40 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="px-5 py-3.5 border-b border-border bg-slate-50/75 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 className="font-semibold text-xs text-foreground">Project Roster ({project.members.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                <th className="py-3 px-5 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Project Role</th>
                <th className="py-3 px-4 font-semibold">Joined Date</th>
                {isOwner && <th className="py-3 px-5 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {project.members.map((member) => {
                const isMemberLastOwner = member.role === "OWNER" && ownerCount <= 1;
                const isWorking = actionId === member.user.id;

                return (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/25 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground flex items-center justify-center shrink-0 font-semibold text-xs">
                          {member.user.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">{member.user.name}</p>
                          <p className="text-[11px] text-muted-foreground">{member.user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
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
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 shadow-xs cursor-pointer"
                          >
                            <option value="VIEWER">{formatRoleLabel("VIEWER")}</option>
                            <option value="REVIEWER">{formatRoleLabel("REVIEWER")}</option>
                            <option value="OWNER">{formatRoleLabel("OWNER")}</option>
                          </select>
                        </div>
                      ) : (
                        <Badge variant="neutral">
                          {formatRoleLabel(member.role)}
                        </Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-muted-foreground font-medium text-xs">
                      {formatDate(member.joinedAt)}
                    </td>

                    {isOwner && (
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleRemoveMember(member.user.id, member.user.name)}
                          disabled={isWorking || isMemberLastOwner}
                          title={
                            isMemberLastOwner
                              ? "Cannot remove the last remaining owner."
                              : "Remove member from project"
                          }
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
}
