import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { workspaceStorage } from "../utils/workspaceStorage";
import { submissionStorage } from "../utils/storage";
import { draftStorage } from "../utils/practice";
import { notebookStorage } from "../utils/mistakesStorage";
import { notebookLifecycle } from "../utils/mistakeLifecycle";
import { backupStorage } from "../utils/backup";

function createWorkspace(owner: string | null) {
  const store = workspaceStorage(owner);
  return { store, ...submissionStorage(store), ...draftStorage(store), ...notebookLifecycle(store),
    ...notebookStorage(store), ...backupStorage(store) };
}

const Context = createContext<ReturnType<typeof createWorkspace> | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  const workspace = useMemo(() => createWorkspace(owner), [owner]);
  if (loading) return null;
  return <Context.Provider key={owner ?? "guest"} value={workspace}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(Context);
  if (!workspace) throw new Error("Workspace provider is required.");
  return workspace;
}
