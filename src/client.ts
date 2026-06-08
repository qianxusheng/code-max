import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const baseURL = process.env.ANTHROPIC_BASE_URL;
if (!apiKey) {
  throw new Error("API_KEY is not set — add it to .env");
}
if (!baseURL) {
  throw new Error("BASE_URL is not set — add it to .env");
}

/** Shared singleton Anthropic SDK client, pointed at the configured base URL. */
export const client = new Anthropic({
  baseURL,
  apiKey,
});
