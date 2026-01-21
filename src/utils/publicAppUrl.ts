export function getPublicAppUrl(): string {
  const raw = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
  const fallback =
    typeof window !== "undefined" && (import.meta as any)?.env?.DEV
      ? window.location.origin
      : "https://onlyplaygolf.com";
  const value = (raw ?? fallback ?? "https://onlyplaygolf.com").trim();
  return value.replace(/\/+$/, "");
}

