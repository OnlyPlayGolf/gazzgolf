export function getPublicAppUrl(): string {
  const raw = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL as string | undefined;
  const fallback = "https://onlyplaygolf.com";
  const value = (raw ?? fallback).trim();
  return value.replace(/\/+$/, "");
}

