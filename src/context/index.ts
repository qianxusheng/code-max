// The single entry point for the context layer — the agent imports only from here.
export { budgetFor, type Budget } from "./budget.js";
export { truncateMiddle, MAX_TOOL_OUTPUT_CHARS } from "./truncate.js";
export { callWithEviction } from "./fallback/evict.js";
export { ContextManager } from "./manager.js";
