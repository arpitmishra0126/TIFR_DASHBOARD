/** Original-cohort enrollment figure (2026-09-17, senior-confirmed) -
 * deliberately NOT derived from REDCap: a full field/instrument audit
 * found no REDCap field, form, or record anywhere that encodes the
 * original 222-child enrollment or a migrated/deceased status (the only
 * status-like field, `baby_status`, is Live/Dead only and already governs
 * the separate Excel/CSV export's "Active Case" definition - unrelated to
 * this figure). Documented static exception to "never hardcode participant
 * counts" - update by hand if the senior-confirmed figure ever changes.
 * Every other count in the app still reads `overview.total_registered`,
 * the live REDCap-computed count (212 at time of writing).
 *
 * Extracted into its own module (2026-09-26) so Overview's Snapshot strip
 * and the Data Quality page's cohort-reconciliation check read the exact
 * same three numbers and can never drift apart. */
export const STUDY_ORIGINAL_ENROLLMENT = 222;
export const STUDY_MIGRATED_COUNT = 5;
export const STUDY_DECEASED_COUNT = 5;
