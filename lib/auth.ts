const STORAGE_KEY = "fichaje_access_key";

export function getAccessKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setAccessKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearAccessKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}
