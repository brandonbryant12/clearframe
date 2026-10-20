import type { Conversation, OutboxEntry } from './00-boundary-agent.js';

import type { FilmSession } from './30-film.js';

// The agent: this film's one OpenCode conversation. You talk; the agent edits the film through the
// studio's validated, undoable commands and renders cuts you watch. Every send has a durable id kept
// in an outbox until the server confirms it, so a retry, a refresh or a lost reply never duplicates
// a message. Messages carry what they are about (the whole film, or a note) and the playhead.

/** The conversation as this page holds it. `sending` is this page's own state and is never stored. */
export interface AgentState {
  conv: Conversation | null;
  draft: string;
  outbox: OutboxEntry[];
  sending: Set<string>;
  lastPoll: number;
  polling: boolean;
  error: string | null;
  scrolledUp: boolean;
  unseen: boolean;
}

export interface AgentSession extends FilmSession {
  agent: AgentState;
}

export function hasAgent(session: FilmSession): session is AgentSession {
  return session.agent !== undefined;
}
