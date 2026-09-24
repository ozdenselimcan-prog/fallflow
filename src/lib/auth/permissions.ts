import type { Role } from "@/lib/data/types";

export type Permission =
  | "cases:write"
  | "appointments:write"
  | "assistant:manage"
  | "company:manage"
  | "team:manage"
  | "billing:manage";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["cases:write", "appointments:write", "assistant:manage", "company:manage", "team:manage", "billing:manage"],
  ADMIN: ["cases:write", "appointments:write", "assistant:manage", "company:manage", "team:manage"],
  MEMBER: ["cases:write", "appointments:write"],
};

export const can = (role: Role, permission: Permission) => MATRIX[role].includes(permission);
