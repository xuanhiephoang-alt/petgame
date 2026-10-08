/**
 * Graphics quality level. "high" on computers, "medium" on phones and
 * tablets; `?quality=low|medium|high` in the URL overrides it.
 */
export type Quality = "low" | "medium" | "high";

export function pickQuality(isTouch: boolean): Quality {
  const asked = new URLSearchParams(location.search).get("quality");
  if (asked === "low" || asked === "medium" || asked === "high") return asked;
  return isTouch ? "medium" : "high";
}
