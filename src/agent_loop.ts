import type Anthropic from "@anthropic-ai/sdk";
import { call, toString } from "./api_calling.js";
import { get, specs } from "./tools/index.js";

const SYSTEM =
  "You are a coding agent. Help the user with software engineering tasks. " +
  "Use the read_file tool to inspect files before answering questions about them.";

const MAX_STEPS = 10;

async function run(userInput: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userInput },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await call({ system: SYSTEM, messages, tools: specs() });

    // Record the assistant turn verbatim — keeps tool_use blocks intact.
    messages.push({ role: "assistant", content: response.content });

    // No tool calls → the model is done.
    if (response.stop_reason !== "tool_use") {
      return toString(response);
    }

    // Run every tool_use block; collect the observations.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      console.log(`  [tool] ${block.name}(${JSON.stringify(block.input)})`);
      const tool = get(block.name);
      let output: string;
      try {
        output = tool
          ? await tool.run(block.input)
          : `Error: unknown tool "${block.name}"`;
      } catch (err) {
        output = `Error: ${(err as Error).message}`;
      }

      results.push({
        type: "tool_result",
        tool_use_id: block.id, // pair the result to the exact call
        content: output,
      });
    }

    // Feed observations back as one user message, then loop.
    messages.push({ role: "user", content: results });
  }

  throw new Error(`Gave up after ${MAX_STEPS} steps`);
}

async function main() {
  const answer = await run("What npm scripts are defined in package.json?");
  console.log("\n" + answer);
}

main();
