import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { specs } from "../tools/index.js";

// Resolve SYSTEM.md next to this module, regardless of the cwd the agent runs in.
const here = dirname(fileURLToPath(import.meta.url));
const template = await readFile(join(here, "SYSTEM.md"), "utf8");

/** Render the registered tools as a markdown list (name + description). */
function toolList(): string {
  return specs()
    .map((s) => `- \`${s.name}\` — ${s.description}`)
    .join("\n");
}

/** The system prompt, with the live tool list injected in place of {{TOOLS}}. */
export const SYSTEM_PROMPT = template.replace("{{TOOLS}}", toolList());
