import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAgent } from "../agent/agent.js";
import type { Approve, Mode } from "../policy/permissions.js";

/** The REPL: read a line, run the agent, print the reply, repeat. */
async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("⚡ code-max — your coding agent.\n");

  // Trust gate: an untrusted folder runs read-only (no edits, no commands).
  const trust = (await rl.question("Trust the files in this folder? [y/N] "))
    .trim()
    .toLowerCase();
  const mode: Mode = trust === "y" || trust === "yes" ? "ask" : "readonly";
  console.log(
    mode === "readonly"
      ? "Running read-only — file edits and shell commands are disabled.\n"
      : "Mode: ask — I'll confirm before editing files or running commands.\n",
  );

  // Interactive approval for tools the policy flags as "ask".
  const approve: Approve = async ({ name, kind, input }) => {
    const answer = (
      await rl.question(`  ⚠ ${name} (${kind}) ${JSON.stringify(input)} — [1]yes / [2]always / [3]no? `)
    ).trim();
    switch (answer) {
      case "1":
        return { allow: true, remember: false };
      case "2":
        return { allow: true, remember: true };
      case "3":
        return { allow: false, remember: false };
      default:
        // Anything else (typo, non-number, empty) → warn and deny, fail-safe.
        console.log("  ⚠ Invalid choice — please enter 1, 2, or 3. Treating as no.");
        return { allow: false, remember: false };
    }
  };

  const agent = createAgent({ mode, approve });
  console.log("Type a message, or /exit to quit.\n");

  while (true) {
    const line = (await rl.question("> ")).trim();
    if (line === "/exit") break;
    if (!line) continue;

    try {
      console.log("\n" + (await agent.send(line)) + "\n");
    } catch (err) {
      // One bad turn shouldn't kill the session.
      console.error("Error:", (err as Error).message, "\n");
    }
  }

  rl.close();
}

main();
