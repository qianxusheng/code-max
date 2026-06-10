import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./registry.js";
import { safePath } from "../policy/safe-path.js";

// All tool implementations live here while there are only a few. When this file
// grows further, split by category: fs_handlers.ts (read/write/edit/list/grep/
// glob) and shell_handlers.ts (bash).

const execAsync = promisify(exec);

// Directories we never want to walk into when searching.
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist"]);

/** Recursively yield every file path under `dir`, with "/" separators. */
async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Translate a glob (`**`, `*`, `?`) into an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*"; // ** → any characters, including "/"
        i += 2;
        if (glob[i] === "/") i++; // swallow the slash after **
      } else {
        re += "[^/]*"; // * → any run of non-slash characters
        i++;
      }
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c; // escape regex metacharacters
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp(re + "$");
}

// ---------------------------------------------------------------------------
// Read-only tools
// ---------------------------------------------------------------------------

export const readFileTool: Tool = {
  kind: "read",
  spec: {
    name: "read_file",
    description: "Read a UTF-8 text file from the project and return its contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the project root" },
      },
      required: ["path"],
    },
  },
  async run(input) {
    const path = (input as { path?: unknown }).path;
    if (typeof path !== "string") return 'Error: "path" must be a string.';
    const full = safePath(path);
    if (!full) return `Error: "${path}" is outside the project root.`;
    return await readFile(full, "utf8");
  },
};

export const listDirTool: Tool = {
  kind: "read",
  spec: {
    name: "list_dir",
    description: "List the entries (files and subdirectories) of a directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path relative to the project root" },
      },
      required: ["path"],
    },
  },
  async run(input) {
    const path = (input as { path?: unknown }).path;
    if (typeof path !== "string") return 'Error: "path" must be a string.';
    const full = safePath(path);
    if (!full) return `Error: "${path}" is outside the project root.`;
    const entries = await readdir(full, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
  },
};

export const grepTool: Tool = {
  kind: "read",
  spec: {
    name: "grep",
    description:
      "Search file CONTENTS by regular expression, returning matching lines as 'path:line: text'.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression to search for" },
        path: {
          type: "string",
          description: "Directory to search under (default: project root)",
        },
      },
      required: ["pattern"],
    },
  },
  async run(input) {
    const { pattern, path } = input as { pattern?: unknown; path?: unknown };
    if (typeof pattern !== "string") return 'Error: "pattern" must be a string.';
    const root = typeof path === "string" ? path : ".";
    if (!safePath(root)) return `Error: "${root}" is outside the project root.`;
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e) {
      return `Error: invalid regex: ${(e as Error).message}`;
    }

    const out: string[] = [];
    for await (const file of walk(root)) {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue; // skip unreadable files
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i]!)) out.push(`${file}:${i + 1}: ${lines[i]}`);
        if (out.length >= 200) return out.join("\n") + "\n... (truncated at 200 matches)";
      }
    }
    return out.length ? out.join("\n") : "No matches.";
  },
};

export const globTool: Tool = {
  kind: "read",
  spec: {
    name: "glob",
    description:
      "Find FILES by name pattern (e.g. '**/*.ts'). Returns matching paths.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern, e.g. src/**/*.ts" },
      },
      required: ["pattern"],
    },
  },
  async run(input) {
    const pattern = (input as { pattern?: unknown }).pattern;
    if (typeof pattern !== "string") return 'Error: "pattern" must be a string.';
    const regex = globToRegExp(pattern);
    const matches: string[] = [];
    for await (const file of walk(".")) {
      if (regex.test(file)) matches.push(file);
      if (matches.length >= 200) break;
    }
    return matches.length ? matches.join("\n") : "No files matched.";
  },
};

// ---------------------------------------------------------------------------
// Mutating tools
// ---------------------------------------------------------------------------

export const writeFileTool: Tool = {
  kind: "edit",
  spec: {
    name: "write_file",
    description: "Create or overwrite a file with the given contents.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the project root" },
        content: { type: "string", description: "Full contents to write" },
      },
      required: ["path", "content"],
    },
  },
  async run(input) {
    const { path, content } = input as { path?: unknown; content?: unknown };
    if (typeof path !== "string") return 'Error: "path" must be a string.';
    if (typeof content !== "string") return 'Error: "content" must be a string.';
    const full = safePath(path);
    if (!full) return `Error: "${path}" is outside the project root.`;
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
    return `Wrote ${content.length} bytes to ${path}`;
  },
};

export const editTool: Tool = {
  kind: "edit",
  spec: {
    name: "edit",
    description:
      "Replace an exact substring in a file. old_string must appear exactly once.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to the project root" },
        old_string: { type: "string", description: "Exact text to replace (must be unique)" },
        new_string: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  async run(input) {
    const { path, old_string, new_string } = input as {
      path?: unknown;
      old_string?: unknown;
      new_string?: unknown;
    };
    if (typeof path !== "string") return 'Error: "path" must be a string.';
    if (typeof old_string !== "string" || typeof new_string !== "string") {
      return 'Error: "old_string" and "new_string" must be strings.';
    }
    const full = safePath(path);
    if (!full) return `Error: "${path}" is outside the project root.`;
    let content: string;
    try {
      content = await readFile(full, "utf8");
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
    const occurrences = content.split(old_string).length - 1;
    if (occurrences === 0) return "Error: old_string not found in file.";
    if (occurrences > 1) {
      return `Error: old_string appears ${occurrences} times; add context to make it unique.`;
    }
    await writeFile(full, content.replace(old_string, new_string), "utf8");
    return `Edited ${path}`;
  },
};

export const bashTool: Tool = {
  kind: "exec",
  spec: {
    name: "bash",
    description:
      "Run a shell command and return its combined stdout/stderr. Use for tests, git, builds.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
  async run(input) {
    const command = (input as { command?: unknown }).command;
    if (typeof command !== "string") return 'Error: "command" must be a string.';
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      });
      return (stdout + stderr).trim() || "(no output)";
    } catch (e) {
      const err = e as { message: string; stdout?: string; stderr?: string };
      return `Error: ${err.message}\n${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    }
  },
};
