"use client";

import React, { createContext, useContext } from "react";

export interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceProjectMember {
  id: string;
  projectId?: string;
  userId: string;
  role: "OWNER" | "REVIEWER" | "VIEWER";
  joinedAt: string;
  user: ProjectMemberUser;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  currentUserRole: "OWNER" | "REVIEWER" | "VIEWER";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  members: WorkspaceProjectMember[];
  createdByUser?: ProjectMemberUser;
}

export interface WorkspaceProjectContextValue {
  project: WorkspaceProject | null;
  setProject: React.Dispatch<React.SetStateAction<WorkspaceProject | null>>;
  refreshProject: () => Promise<void>;
  loading: boolean;
}

const WorkspaceProjectContext = createContext<WorkspaceProjectContextValue | null>(null);

export function WorkspaceProjectProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceProjectContextValue;
}) {
  return (
    <WorkspaceProjectContext.Provider value={value}>
      {children}
    </WorkspaceProjectContext.Provider>
  );
}

export function useWorkspaceProject(): WorkspaceProjectContextValue {
  const context = useContext(WorkspaceProjectContext);
  if (!context) {
    throw new Error("useWorkspaceProject must be used within a WorkspaceProjectProvider");
  }
  return context;
}
