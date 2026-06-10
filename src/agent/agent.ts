import type Anthropic from "@anthropic-ai/sdk";
import { call as defaultCall, toString } from "../model/call.js";
import type { CallParams } from "../model/call.js";
import { get, specs } from "../tools/index.js";
import { createPolicy, denyApprove, type Mode, type Approve } from "../policy/permissions.js";
import { SYSTEM_PROMPT } from "../prompts/index.js";

const MAX_STEPS = 10;

/** The model-call shape, injectable so tests can pass a fake instead of the network. */
export type Model = (params: CallParams) => Promise<Anthropic.Message>;

export interface AgentOptions {
  model?: Model;
  /** System prompt for the session (default: the bundled SYSTEM.md). */
  system?: string;
  /** Permission profile for this session (default: "ask"). */
  mode?: Mode;
  /** Interactive approval callback (default: deny anything that needs asking). */
  approve?: Approve;
}

/**
 * A session: owns its own conversation and runs the ReAct loop per turn.
 * UI-agnostic — no readline, no prompts. The CLI drives it via `send`.
 */
export function createAgent({
  model = defaultCall,
  system = SYSTEM_PROMPT,
  mode = "ask",
  approve = denyApprove,
}: AgentOptions = {}) {
  const policy = createPolicy(mode);

  // Persists across turns — the agent's in-session memory.
  const messages: Anthropic.MessageParam[] = [];

  async function send(userInput: string): Promise<string> {
    messages.push({ role: "user", content: userInput });

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await model({ system, messages, tools: specs() });

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
        if (!tool) {
          output = `Error: unknown tool "${block.name}"`;
        } else {
          const decision = policy.decide({ name: tool.spec.name, kind: tool.kind });
          if (decision === "deny") {
            output = `Denied: "${tool.spec.name}" is not permitted in "${mode}" mode.`;
          } else {
            let allow = true;
            if (decision === "ask") {
              const res = await approve({
                name: tool.spec.name,
                kind: tool.kind,
                input: block.input,
              });
              if (res.allow && res.remember) policy.remember(tool.spec.name);
              allow = res.allow;
            }
            if (!allow) {
              output = "Denied by user.";
            } else {
              try {
                output = await tool.run(block.input);
              } catch (err) {
                output = `Error: ${(err as Error).message}`;
              }
            }
          }
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

  return { send };
}
