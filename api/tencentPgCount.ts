export function resolveExactSelectCount(requested: boolean, databaseCount: unknown) {
  if (!requested) return null;
  const count = Number(databaseCount);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}
