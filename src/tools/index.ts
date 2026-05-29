/** Public surface of the tool system. */

// Contracts
export type {
  JSONSchema,
  ToolSpec,
  ToolPayload,
  ToolCall,
  ToolOutput,
  ToolContext,
} from "./types.js";
export type { Tool } from "./tool.js";

// Errors (the two-way channel)
export { RespondToModel, FatalToolError } from "./errors.js";

// Machinery
export { ToolRegistry } from "./registry.js";
export {
  buildToolCall,
  route,
  parseArguments,
  type RawFunctionCall,
} from "./router.js";

// tools
export { echoTool } from "./handlers/echo.js";
