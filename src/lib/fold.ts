/** Accent-insensitive lowercase for instant search and bible refs. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function nid(): string {
  return crypto.randomUUID();
}
