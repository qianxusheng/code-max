/**
 * Tool execution has a two-way error channel — the single most important idea
 * in the system.
 *
 * A tool can fail in two fundamentally different ways:
 *
 *  - {@link RespondToModel}: a *recoverable* failure. Bad arguments, a file not
 *    found, a command that exited non-zero. We do NOT crash the turn; instead
 *    the registry catches this and turns the message into a tool result, so the
 *    model sees what went wrong and can try again. This is why agents recover
 *    gracefully from their own mistakes.
 *
 *  - {@link FatalToolError}: an *unrecoverable* failure that should abort the
 *    turn (and bubble up to the caller). The model can't fix this by retrying.
 */

/**
 * Recoverable failure: the message is sent back to the model as the tool's
 * result so it can correct course and retry.
 */
export class RespondToModel extends Error {
  override readonly name = "RespondToModel";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Unrecoverable failure: abort the turn. Bubbles past the registry to the
 * caller of the run loop.
 */
export class FatalToolError extends Error {
  override readonly name = "FatalToolError";
  constructor(message: string) {
    super(message);
  }
}
