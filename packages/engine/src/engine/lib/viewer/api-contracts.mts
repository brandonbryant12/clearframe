import type { JobHarness } from '../harness/jobs.mjs';
import type { AgentRuntime, agentPaths } from '../agent/runtime.mjs';
import type { createAgent } from '../agent/agent.mjs';
import type { buildViewer } from './build.mjs';
import type { ApiRequestSchema } from './http-contracts.mjs';
export type Reply = (code: number, body: unknown) => void;
export type BuiltViewer = Awaited<ReturnType<typeof buildViewer>>;
export type ApiRequest = typeof ApiRequestSchema.Type;
export interface ViewerApi {
  base: string;
  out: string;
  projectRoot: string;
  paths: ReturnType<typeof agentPaths>;
  jobs: JobHarness;
  agent: ReturnType<typeof createAgent> | null;
  runtime: AgentRuntime | null;
  agentOff: string | null;
  built: () => BuiltViewer;
  rebuild: () => Promise<BuiltViewer>;
  dirOf: (id: unknown) => string | null;
  pauseOf: (dir: string) => { id: string; kind: string; label?: string } | null;
  bridgeAuth: (header: unknown) => boolean;
}
