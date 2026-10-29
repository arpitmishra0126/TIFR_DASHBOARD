/** English display labels + colors for the Dietary Intake instrument's
 * 8-point consumption-frequency scale, keyed by the field's own stored
 * REDCap choice CODE (confirmed live for every die_*_freq field, including
 * die_other_freq - same 1-8 convention; see CLAUDE.md's dietary-intake
 * history, which separately confirms code "8" = "Rarely/Never" via
 * `_DIETARY_RARELY_NEVER_CODE`). Mapping by code - not by matching the
 * REDCap-resolved label text, which is Hindi-only for this instrument - is
 * the reliable source of truth: the backend never reassigns, reorders, or
 * invents a code, and this file only supplies a display translation for an
 * already-confirmed code, exactly mirroring the original study's response
 * order. If a segment's code is ever missing from this map (it should
 * never be, for a live die_*_freq/die_other_freq field), the UI falls back
 * to the backend's own resolved (Hindi) label rather than guessing one. */

export interface FrequencyCategoryMeta {
  code: string;
  label: string;
  color: string;
}

export const FREQUENCY_CATEGORIES: FrequencyCategoryMeta[] = [
  { code: "1", label: "Daily", color: "var(--series-1)" },
  { code: "2", label: "3–6 times per week", color: "var(--series-2)" },
  { code: "3", label: "1–2 times per week", color: "var(--series-3)" },
  { code: "4", label: "Once every 15 days", color: "var(--series-4)" },
  { code: "5", label: "Monthly", color: "var(--series-5)" },
  { code: "6", label: "Once every 6 months", color: "var(--series-violet)" },
  { code: "7", label: "Annually", color: "var(--series-cyan)" },
  { code: "8", label: "Rarely/Never", color: "var(--series-6)" },
];

const BY_CODE = new Map(FREQUENCY_CATEGORIES.map((c) => [c.code, c]));

export function frequencyCategoryByCode(code: string): FrequencyCategoryMeta | undefined {
  return BY_CODE.get(code);
}
