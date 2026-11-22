import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Directory, LeaderLevel, LeaderRole, Me } from "./types";

type AuthState = {
  /** undefined while we are still finding out; null when logged out. */
  me: Me | null | undefined;
  refresh: () => Promise<void>;
  directory: Directory | null;
  directoryError: string | null;
  reloadDirectory: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.getMe());
    } catch {
      setMe(null);
    }
  }, []);

  const reloadDirectory = useCallback(async () => {
    try {
      setDirectory(await api.getDirectory());
      setDirectoryError(null);
    } catch (e) {
      setDirectoryError(e instanceof Error ? e.message : "Could not load the directory.");
    }
  }, []);

  useEffect(() => {
    void reloadDirectory();
    return api.onAuthChange(() => void refresh());
  }, [refresh, reloadDirectory]);

  const value = useMemo(
    () => ({ me, refresh, directory, directoryError, reloadDirectory }),
    [me, refresh, directory, directoryError, reloadDirectory],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The logged-in member (only call inside the portal, where login is required). */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("Not logged in");
  return me;
}

export function approvedRoles(me: Me | null | undefined): LeaderRole[] {
  return me ? me.roles.filter((r) => r.status === "approved") : [];
}

export function roleOf(me: Me | null | undefined, level: LeaderLevel): LeaderRole | undefined {
  return approvedRoles(me).find((r) => r.level === level);
}

/** What the caller may do — mirrors the database rules for showing/hiding buttons. */
export function permissions(me: Me | null | undefined, myAssociationId: number | null) {
  const roles = approvedRoles(me);
  const isAdmin = !!me?.isAdmin;
  const isLeader = roles.length > 0;
  const postAudiences: LeaderLevel[] = isAdmin
    ? ["institutional", "regional", "national"]
    : roles.map((r) => r.level);
  return {
    isAdmin,
    isLeader,
    postAudiences,
    canPost: postAudiences.length > 0,
    canReviewLeaders: isAdmin || !!roleOf(me, "regional"),
    canSeeMembers: isAdmin || isLeader,
    canManageChurchesIn(associationId: number) {
      return (
        isAdmin ||
        roles.some((r) => r.level === "national" || r.association_id === associationId)
      );
    },
    /** Associations where the caller can publish churches directly. */
    churchAssociations(all: number[]): number[] {
      return all.filter((id) => this.canManageChurchesIn(id));
    },
    myAssociationId,
  };
}
