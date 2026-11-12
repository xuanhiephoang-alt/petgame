/**
 * The index.json of an asset folder, or undefined when it is missing, unreadable or not a plain object:
 * the art is then drawn from code. Never throws.
 */
export async function fetchIndex(url: string): Promise<Record<string, any> | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const json: unknown = await res.json();
    return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, any>) : undefined;
  } catch {
    return undefined;
  }
}
