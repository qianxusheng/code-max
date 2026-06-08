import { register } from "./registry.js";
import {
  readFileTool,
  listDirTool,
  grepTool,
  globTool,
  writeFileTool,
  editTool,
  bashTool,
} from "./handlers.js";

// Register every tool the agent can use. Add a line here per new tool.
register(readFileTool);
register(listDirTool);
register(grepTool);
register(globTool);
register(writeFileTool);
register(editTool);
register(bashTool);

export { get, specs } from "./registry.js";
export type { Tool } from "./registry.js";
