import type Anthropic from "@anthropic-ai/sdk";
import { toString, type LlmCall } from "../../model/call.js";
import { COMPACTION_PROMPT } from "../../prompts/index.js";

// How many recent turns to keep verbatim; everything older is summarized.
const KEEP_RECENT_TURNS = 2;

/**
 * A real user turn (typed text), not a tool_result-carrying user message — the
 * only safe split points (every tool_use between two of them has its result).
 */
function isUserTurn(m: Anthropic.MessageParam): boolean {
  return m.role === "user" && typeof m.content === "string";
}

/** Render a message list as a plain-text transcript for the summarizer. */
function transcribe(messages: Anthropic.MessageParam[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      lines.push(`${m.role}: ${m.content}`);
      continue;
    }
    for (const block of m.content) {
      if (block.type === "text") {
        lines.push(`${m.role}: ${block.text}`);
      } else if (block.type === "tool_use") {
        lines.push(`${m.role}: [calls ${block.name}(${JSON.stringify(block.input)})]`);
      } else if (block.type === "tool_result") {
        const c = block.content;
        lines.push(`tool_result: ${typeof c === "string" ? c : JSON.stringify(c)}`);
      }
      // thinking / images / etc. are skipped — not useful in a text summary.
    }
  }
  return lines.join("\n");
}

/**
 * SOFT-threshold fallback (estimate ≥ budget.soft): summarize the older turns
 * into a single handoff summary (via the COMPACTION prompt) and keep the most
 * recent turns verbatim. Graceful — it preserves the gist of what it drops,
 * unlike trim/evict which discard outright.
 */
export async function compact(
  messages: Anthropic.MessageParam[],
  call: LlmCall,
): Promise<Anthropic.MessageParam[]> {
  const boundaries: number[] = [];
  messages.forEach((m, i) => {
    if (isUserTurn(m)) boundaries.push(i);
  });
  // Nothing to summarize if we'd keep everything anyway.
  if (boundaries.length <= KEEP_RECENT_TURNS) return messages;

  const splitAt = boundaries[boundaries.length - KEEP_RECENT_TURNS]!;
  const older = messages.slice(0, splitAt);
  const recent = messages.slice(splitAt);

  const response = await call({
    system: COMPACTION_PROMPT,
    messages: [{ role: "user", content: transcribe(older) }],
  });

  return [
    { role: "user", content: `[Summary of the conversation so far]\n\n${toString(response)}` },
    ...recent,
  ];
}
