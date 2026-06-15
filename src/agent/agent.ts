import type Anthropic from "@anthropic-ai/sdk";
import { call as defaultCall, toString } from "../model/call.js";
import type { LlmCall } from "../model/call.js";
import { get, specs } from "../tools/index.js";
import { denyApprove, type Approve } from "../policy/permissions.js";
import { SYSTEM_PROMPT } from "../prompts/index.js";
import {
  callWithEviction,
  truncateMiddle,
  MAX_TOOL_OUTPUT_CHARS,
} from "../context/index.js";
import type { Session } from "../session/session.js";

export interface AgentParams {
  call?: LlmCall;
  /** System prompt (default: the bundled SYSTEM.md). */
  system?: string;
  /** Interactive approval callback (default: deny anything that needs asking). */
  approve?: Approve;
}

/**
 * The agent: reusable config (model call, system prompt, approval) plus the
 * ReAct loop. One agent can drive many sessions — `send(session, input)` runs a
 * turn against whichever session it is given. UI-agnostic (no readline/prompts).
 */
export function createAgent({
  call = defaultCall,
  system = SYSTEM_PROMPT,
  approve = denyApprove,
}: AgentParams = {}) {
  async function send(session: Session, userInput: string): Promise<string> {
    session.record({ role: "user", content: userInput });

    while (true) {
      // Proactively keep the conversation under budget before sampling.
      await session.manage(call);

      // On a context-overflow rejection, shed the oldest turn and retry.
      const response = await callWithEviction(call, {
        system,
        messages: session.forPrompt(),
        tools: specs(),
      });
      session.lastUsage = response.usage;

      // Record the assistant turn verbatim — keeps tool_use blocks intact.
      session.record({ role: "assistant", content: response.content });

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
          const decision = session.policy.decide({ name: tool.spec.name, kind: tool.kind });
          if (decision === "deny") {
            output = `Denied: "${tool.spec.name}" is not permitted in "${session.mode}" mode.`;
          } else {
            let allow = true;
            if (decision === "ask") {
              const res = await approve({
                name: tool.spec.name,
                kind: tool.kind,
                input: block.input,
              });
              if (res.allow && res.remember) session.policy.remember(tool.spec.name);
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
          // Bound each output at ingestion so one big result can't blow context.
          content: truncateMiddle(output, MAX_TOOL_OUTPUT_CHARS),
        });
      }

      // Feed observations back as one user message, then loop.
      session.record({ role: "user", content: results });
    }
  }

  return { send };
}
