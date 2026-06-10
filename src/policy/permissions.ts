/**
 * Permission policy: decides whether a pending tool call may run, must be asked
 * about, or is denied outright.
 *
 * `decide` consults two tiers, in order:
 *   1. a session "remembered" allowlist (the user's /always answers),
 *   2. the hardcoded mode × kind TABLE below (fixed product behavior).
 * A future user-config tier (per-tool/per-command rules from a settings file)
 * would slot in ahead of these — see the marked spot in `decide`.
 */

/** How risky a tool is. `read` never mutates; `edit` writes files; `exec` runs commands. */
export type Kind = "read" | "edit" | "exec";

/** The permission profile in effect for a session. */
export type Mode = "readonly" | "ask" | "auto" | "yolo";

/** What the policy decides for a given call. */
export type Decision = "allow" | "ask" | "deny";

/** The minimal description of a pending call the approval UI needs to prompt on. */
export interface ToolCall {
  name: string;
  kind: Kind;
  input: unknown;
}

export interface ApproveResult {
  allow: boolean;
  /** "Don't ask again for this tool this session." */
  remember: boolean;
}

/** The interactive approval callback — supplied by the CLI, faked in tests. */
export type Approve = (call: ToolCall) => Promise<ApproveResult>;

// Hardcoded product behavior: which decision each mode gives each tool kind.
const TABLE: Record<Mode, Record<Kind, Decision>> = {
  readonly: { read: "allow", edit: "deny", exec: "deny" },
  ask: { read: "allow", edit: "ask", exec: "ask" },
  auto: { read: "allow", edit: "allow", exec: "ask" },
  yolo: { read: "allow", edit: "allow", exec: "allow" },
};

/** A per-session policy: the mode baseline plus a remembered allowlist. */
export function createPolicy(mode: Mode) {
  const remembered = new Set<string>();

  return {
    decide({ name, kind }: { name: string; kind: Kind }): Decision {
      // (future) user allow/deny rules would be checked here first.
      if (remembered.has(name)) return "allow";
      return TABLE[mode][kind];
    },
    remember(name: string): void {
      remembered.add(name);
    },
  };
}

/** Default approval when no interactive UI is wired: deny anything that asks. */
export const denyApprove: Approve = async () => ({ allow: false, remember: false });
