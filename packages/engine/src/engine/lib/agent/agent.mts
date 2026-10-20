// Compose one durable conversation and its validated tool bridge for each film.
import * as Schema from 'effect/Schema';
import { ToolInputSchema, type AgentOptions } from './contracts.mjs';
import { createTools } from './tools.mjs';
import { createSessionStore } from './agent-session.mjs';
import { createConversation } from './agent-conversation.mjs';
import { createControls } from './agent-controls.mjs';
import { fail } from './agent-common.mjs';
export { transcript } from './messages.mjs';
export {
  cleanScope,
  resolveScope,
  MODES,
  modeOf,
  contextBlock,
  touched,
} from './agent-scope.mjs';
export function createAgent(options: AgentOptions) {
  const { base = process.cwd(), jobs, filmOf, pauseOf } = options;
  const sessions = createSessionStore(options);
  const tools = createTools({
    base,
    jobs,
    filmOf,
    pauseOf,
    currentScope: sessions.currentScope,
  });
  return {
    reindex: sessions.reindex,
    session: sessions.session,
    ...createConversation(options, sessions),
    ...createControls(options, sessions),
    /** One ClearFrame tool call from the OpenCode plugin. */
    async bridge(
      body: {
        sessionID?: string;
        tool?: string;
        input?: unknown;
        messageID?: string;
      },
      { wait }: { wait?: () => void } = {},
    ) {
      const sessionID = String(body.sessionID ?? '');
      const dir = sessions.directory(sessionID);
      if (!dir)
        throw fail(
          'This conversation is not linked to a ClearFrame film in this studio.',
          403,
        );
      const input = Schema.decodeUnknownSync(ToolInputSchema)(body.input ?? {});
      const tool = tools[body.tool ?? ''];
      if (!tool) throw fail('Unknown ClearFrame tool.', 404);
      return tool({
        dir,
        input,
        sessionID,
        messageID: typeof body.messageID === 'string' ? body.messageID : null,
        wait,
      });
    },
  };
}
