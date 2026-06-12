/**
 * Per-tool-output cap. A single tool result (a big file read, a noisy `bash`
 * run) shouldn't be allowed to dominate the context window, so each output is
 * bounded as it enters the conversation. ~10k tokens ≈ 40k chars.
 */
export const MAX_TOOL_OUTPUT_CHARS = 40_000;

/**
 * Bound a string to roughly `maxChars`, keeping the head and tail and eliding
 * the middle — where the least-useful bulk of a long output usually sits (the
 * start and end carry the most signal). Returns the original if it already fits.
 */
export function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  const head = text.slice(0, half);
  const tail = text.slice(text.length - half);
  const elided = text.length - head.length - tail.length;
  return `${head}\n\n…[${elided} characters truncated]…\n\n${tail}`;
}
