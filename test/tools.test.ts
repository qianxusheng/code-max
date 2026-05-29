import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  route,
  echoTool,
  RespondToModel,
  FatalToolError,
  type Tool,
  type RawFunctionCall,
  type ToolContext,
} from "../src/tools/index.js";

const ctx: ToolContext = {};

function rawCall(name: string, args: unknown): RawFunctionCall {
  return { id: "call_1", name, arguments: JSON.stringify(args) };
}

describe("tool system", () => {
  it("routes a valid call to the tool and returns its output", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const out = await route(registry, rawCall("echo", { message: "hi" }), ctx);
    expect(out.content).toBe("hi");
  });

  it("exposes registered specs to the model", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const specs = registry.buildSpecs();
    expect(specs.map((s) => s.name)).toEqual(["echo"]);
    expect(specs[0]?.parameters).toMatchObject({ type: "object" });
  });

  it("refuses to register two tools with the same name", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);
    expect(() => registry.register(echoTool)).toThrow(/already registered/);
  });

  it("turns an unknown tool into a result the model can read", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const out = await route(registry, rawCall("nope", {}), ctx);
    expect(out.content).toContain('unknown tool "nope"');
    expect(out.content).toContain("echo");
  });

  it("converts RespondToModel into a tool result (recoverable)", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    // Missing required "message" → tool throws RespondToModel → becomes output.
    const out = await route(registry, rawCall("echo", {}), ctx);
    expect(out.content).toMatch(/Error:.*message/);
  });

  it("reports invalid JSON arguments back to the model", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const out = await route(
      registry,
      { id: "c", name: "echo", arguments: "{not json" },
      ctx,
    );
    expect(out.content).toMatch(/not valid JSON/);
  });

  it("lets FatalToolError propagate to abort the turn", async () => {
    const boom: Tool = {
      spec: { name: "boom", description: "always fatal", parameters: { type: "object" } },
      async handle() {
        throw new FatalToolError("unrecoverable");
      },
    };
    const registry = new ToolRegistry();
    registry.register(boom);

    await expect(
      route(registry, rawCall("boom", {}), ctx),
    ).rejects.toBeInstanceOf(FatalToolError);
  });

  it("does not leak RespondToModel as a thrown error", async () => {
    // Sanity: RespondToModel never escapes dispatch.
    const registry = new ToolRegistry();
    registry.register(echoTool);
    const out = await route(registry, rawCall("echo", { message: 123 }), ctx);
    expect(out.content).toMatch(/Error:/);
    expect(RespondToModel).toBeDefined();
  });
});
