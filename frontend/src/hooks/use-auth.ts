import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { Role } from "@/lib/api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api.me(), staleTime: Infinity });
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

/**
 * Client-side route guard: waits for hydration-safe `me()`, then redirects
 * to /auth when the user is missing or lacks one of `roles`.
 */
export function useRequireRole(roles: Role[]) {
  const router = useRouter();
  const { data: user, isLoading } = useMe();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (!isLoading && !allowed) router.navigate({ to: "/auth" });
  }, [isLoading, allowed, router]);

  return { user: allowed ? user! : null, ready: !isLoading && allowed };
}

export function useIsStaff() {
  const { data: user } = useMe();
  return user?.role === "admin" || user?.role === "employee";
}
