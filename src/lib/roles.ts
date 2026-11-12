export type ProjectRoleType = "OWNER" | "REVIEWER" | "VIEWER";

/**
 * Returns a human-readable display label for a ProjectMember role.
 * Standardizes role labeling across the login page, dashboard, project layout, and members list.
 */
export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return "Viewer";
  const normalized = role.trim().toUpperCase();
  switch (normalized) {
    case "OWNER":
      return "Owner";
    case "REVIEWER":
      return "Reviewer";
    case "VIEWER":
      return "Viewer";
    default:
      return role;
  }
}

/**
 * Returns Tailwind badge classes corresponding to a role.
 */
export function getRoleBadgeClass(role: string | null | undefined): string {
  const normalized = role?.trim().toUpperCase();
  switch (normalized) {
    case "OWNER":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300";
    case "REVIEWER":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300";
    case "VIEWER":
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
  }
}
