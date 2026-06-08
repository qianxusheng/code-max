import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAgent } from "../agent/agent.js";

/** The REPL: read a line, run the agent, print the reply, repeat. */
async function main() {
  const agent = createAgent();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("⚡ code-max — your coding agent. Type a message, or /exit to quit.\n");

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
