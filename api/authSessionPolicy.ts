export function sessionVersionOf(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function authSessionMatches(tokenVersion: unknown, profileVersion: unknown): boolean {
  const parsedTokenVersion = Number(tokenVersion);
  return Number.isSafeInteger(parsedTokenVersion)
    && parsedTokenVersion > 0
    && parsedTokenVersion === sessionVersionOf(profileVersion);
}

export function nextSessionVersion(profileVersion: unknown): number {
  return sessionVersionOf(profileVersion) + 1;
}
