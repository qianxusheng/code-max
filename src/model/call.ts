import type Anthropic from "@anthropic-ai/sdk";
import { client } from "./client.js";

const MODEL = "deepseek-v4-pro";
const MAX_TOKENS = 16000;

/** The inputs a turn needs: the conversation, the system prompt, the tools. */
export interface CallParams {
  messages: Anthropic.MessageParam[];
  system: string;
  tools?: Anthropic.Tool[];
}

/** The model-call shape — injectable so tests/agents can pass a fake. */
export type Model = (params: CallParams) => Promise<Anthropic.Message>;

/** Wraps the singleton client into one Messages API call; returns the full Message. */
export async function call({
  messages,
  system,
  tools,
}: CallParams): Promise<Anthropic.Message> {
  return client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
    ...(tools ? { tools } : {}),
  });
}

/** Concatenate the text blocks out of a response. */
export function toString(message: Anthropic.Message): string {
  // console.log(message);
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
