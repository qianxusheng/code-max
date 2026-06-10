import { resolve, relative, isAbsolute } from "node:path";

// Confine file tools to the directory the agent was launched in.
const ROOT = process.cwd();

/**
 * Resolve `p` against the project root. Returns the absolute path if it stays
 * inside the root, or null if it escapes (via `..` or an absolute path
 * elsewhere) — callers turn null into a recoverable error.
 */
export function safePath(p: string): string | null {
  const full = resolve(ROOT, p);
  const rel = relative(ROOT, full);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  return full;
}
