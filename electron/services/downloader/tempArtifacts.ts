/**
 * Regexes that match every temporary artifact a multipart download may leave
 * next to its final file:
 *
 *   <final>.<partN>    — chunk temp files (e.g. video.mp4.part0 … part4)
 *   <final>.partinfo   — resume/merge metadata (the download's resume state)
 *   <final>.resume     — any separate resume-state file (currently unused by
 *                        the engine, but cleaned defensively)
 *
 * Used by HttpEngine.removeTempArtifacts() so cleanup is robust against
 * orphaned files that are no longer tracked in memory (e.g. leftovers from a
 * previous interrupted run).
 */
export function getTempArtifactRegexes(base: string): RegExp[] {
  // Escape regex metacharacters — file names may contain '.', '[', '(', etc.
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    new RegExp(`^${esc}\\.part\\d+$`),
    new RegExp(`^${esc}\\.partinfo$`),
    new RegExp(`^${esc}\\.resume$`)
  ]
}
