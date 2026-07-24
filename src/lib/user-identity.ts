export function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeUserName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveUsernameFromIdentifier(identifier: string) {
  const normalized = identifier.trim();

  if (!normalized) {
    return "";
  }

  if (isEmailLike(normalized)) {
    return normalizeUserName(normalized.split("@")[0] ?? "");
  }

  return normalizeUserName(normalized);
}

export function deriveInternalEmailFromUsername(username: string) {
  const normalized = normalizeUserName(username);

  return normalized ? `${normalized}@nexttrading.local` : "";
}
