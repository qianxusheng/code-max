import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { CallParams } from "../model/call.js";
import { createAgent, type Model } from "../agent/agent.js";

// Fake Message builders — cast past the full SDK shape; the loop only reads
// `content` and `stop_reason`.
function textReply(text: string): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    content: [{ type: "text", text }], stop_reason: "end_turn",
    stop_sequence: null, usage: {},
  } as unknown as Anthropic.Message;
}
function toolReply(id: string, name: string, input: unknown): Anthropic.Message {
  return {
    id: "m", type: "message", role: "assistant", model: "fake",
    content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use",
    stop_sequence: null, usage: {},
  } as unknown as Anthropic.Message;
}

/** A scripted model that snapshots the params it was called with each turn. */
function scripted(responses: Anthropic.Message[]) {
  const calls: CallParams[] = [];
  let i = 0;
  const model: Model = async (params) => {
    // Clone messages — the agent reuses the same array by reference, so a live
    // ref would show the final state, not the state at this call.
    calls.push({ ...params, messages: [...params.messages] });
    return responses[i++]!;
  };
  return { model, calls };
}

describe("agent loop", () => {
  it("returns the text when the model makes no tool calls", async () => {
    const { model } = scripted([textReply("hello there")]);
    expect(await createAgent({ model }).send("hi")).toBe("hello there");
  });

  it("runs a tool, feeds the result back, then finishes", async () => {
    const { model, calls } = scripted([
      toolReply("tu_1", "nope", { x: 1 }), // unknown tool → recoverable error result
      textReply("done"),
    ]);

    expect(await createAgent({ model }).send("go")).toBe("done");
    expect(calls.length).toBe(2); // looped once more after the tool result

    // the 2nd request must carry a tool_result paired to tu_1
    const last = calls[1]!.messages.at(-1)!;
    expect(last.role).toBe("user");
    const block = (last.content as Anthropic.ToolResultBlockParam[])[0]!;
    expect(block.type).toBe("tool_result");
    expect(block.tool_use_id).toBe("tu_1");
    expect(String(block.content)).toMatch(/unknown tool/);
  });

  it("remembers the conversation across turns", async () => {
    const { model, calls } = scripted([textReply("first"), textReply("second")]);
    const agent = createAgent({ model });

    await agent.send("alpha");
    await agent.send("beta");

    // the 2nd turn's request still contains the 1st turn.
    expect(calls[1]!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(calls[1]!.messages[0]!.content).toBe("alpha");
  });

  it("gives up after MAX_STEPS if the model never stops", async () => {
    const always: Model = async () => toolReply("t", "nope", {});
    await expect(createAgent({ model: always }).send("loop")).rejects.toThrow(/Gave up/);
  });
});
