import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readFileTool,
  listDirTool,
  grepTool,
  globTool,
  writeFileTool,
  editTool,
  bashTool,
} from "./handlers.js";

// A throwaway directory for the mutating tools, so tests never touch the repo.
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "codemax-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("read_file", () => {
  it("reads a file's contents", async () => {
    const out = await readFileTool.run({ path: "package.json" });
    expect(out).toContain("code-max");
  });

  it("rejects a non-string path", async () => {
    const out = await readFileTool.run({ path: 123 });
    expect(out).toMatch(/must be a string/);
  });
});

describe("list_dir", () => {
  it("lists entries, marking directories with a trailing slash", async () => {
    const out = await listDirTool.run({ path: "src" });
    expect(out).toContain("tools/");
    expect(out).toContain("client.ts");
  });
});

describe("grep", () => {
  it("finds matching lines as path:line: text", async () => {
    const out = await grepTool.run({ pattern: "readFileTool", path: "src" });
    expect(out).toContain("handlers.ts");
    expect(out).toMatch(/handlers\.ts:\d+:/);
  });

  it("reports an invalid regex instead of throwing", async () => {
    const out = await grepTool.run({ pattern: "[", path: "src" });
    expect(out).toMatch(/invalid regex/);
  });
});

describe("glob", () => {
  it("finds files by name pattern", async () => {
    const out = await globTool.run({ pattern: "src/**/*.ts" });
    expect(out).toContain("src/tools/handlers.ts");
  });

  it("returns a message when nothing matches", async () => {
    const out = await globTool.run({ pattern: "**/*.nonexistent" });
    expect(out).toBe("No files matched.");
  });
});

describe("write_file", () => {
  it("creates a file with the given contents", async () => {
    const path = join(dir, "hello.txt");
    const res = await writeFileTool.run({ path, content: "hi there" });
    expect(res).toContain("Wrote");
    expect(await readFile(path, "utf8")).toBe("hi there");
  });

  it("rejects non-string content", async () => {
    const out = await writeFileTool.run({ path: join(dir, "x.txt"), content: 5 });
    expect(out).toMatch(/must be a string/);
  });
});

describe("edit", () => {
  it("replaces a unique substring", async () => {
    const path = join(dir, "edit.txt");
    await writeFile(path, "alpha beta gamma", "utf8");
    const res = await editTool.run({
      path,
      old_string: "beta",
      new_string: "BETA",
    });
    expect(res).toContain("Edited");
    expect(await readFile(path, "utf8")).toBe("alpha BETA gamma");
  });

  it("errors when old_string is not found", async () => {
    const path = join(dir, "edit2.txt");
    await writeFile(path, "no match here", "utf8");
    const res = await editTool.run({
      path,
      old_string: "zzz",
      new_string: "x",
    });
    expect(res).toMatch(/not found/);
  });

  it("errors when old_string is not unique", async () => {
    const path = join(dir, "edit3.txt");
    await writeFile(path, "dup and dup", "utf8");
    const res = await editTool.run({
      path,
      old_string: "dup",
      new_string: "x",
    });
    expect(res).toMatch(/appears 2 times/);
  });
});

describe("bash", () => {
  it("runs a command and returns its output", async () => {
    const out = await bashTool.run({ command: "echo hello" });
    expect(out).toContain("hello");
  });

  it("rejects a non-string command", async () => {
    const out = await bashTool.run({ command: 42 });
    expect(out).toMatch(/must be a string/);
  });
});
