import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Resolve SYSTEM.md next to this module, regardless of the cwd the agent runs in.
const here = dirname(fileURLToPath(import.meta.url));

/** The coding-agent system prompt, loaded from SYSTEM.md at startup. */
export const SYSTEM_PROMPT = await readFile(join(here, "SYSTEM.md"), "utf8");
