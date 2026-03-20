export function getDefaultAppPath(role?: string | null): string {
  return role?.toUpperCase() === "ADMIN" ? "/admin" : "/home";
}
