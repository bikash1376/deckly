/**
 * Copy sanitising lives in @retenit/shared, because the Worker has to apply the
 * same rules before it writes generated content to the database. Re-exported
 * here so app code keeps importing from `@/lib/copy`.
 */
export { cleanCopy, cleanDeep, COPY_RULES_PROMPT, type CleanCopyOptions } from "@retenit/shared";
