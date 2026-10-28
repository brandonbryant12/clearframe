// What ClearFrame can do, as data an agent framework reads before calling it: the operations,
// where each is called (the `clearframe/harness` API or the CLI), the contract each request and
// result follows (as JSON Schema generated from the same Effect schemas the engine decodes with),
// and the lifecycle semantics a caller relies on. It names no agent SDK, provider or host.
import * as Schema from 'effect/Schema';
import {
  EventOptionsSchema,
  HarnessFailureSchema,
  HarnessHealthSchema,
  JOB_KINDS,
  JOB_STATUSES,
  JobEventSchema,
  JobRequestSchema,
  JobViewSchema,
  StartResultSchema,
  TERMINAL_STATUSES,
} from './harness/contracts.mjs';
import { AssessmentSchema, VerdictOutcomeSchema } from './qa-assessment.mjs';

/** Raised when a contract changes incompatibly; additive fields keep the version. */
export const CONTRACT_VERSION = 1;

export const HarnessRequestErrorSchema = Schema.Struct({
  _tag: Schema.Literal('HarnessRequestError'),
  reason: HarnessFailureSchema,
  message: Schema.String,
  status: Schema.Int,
});

const contractNames = [
  'JobRequest',
  'StartResult',
  'JobView',
  'JobEvent',
  'EventOptions',
  'HarnessHealth',
  'HarnessRequestError',
  'VerdictOutcome',
  'Assessment',
] as const;
export type ContractName = (typeof contractNames)[number];
const ContractNameSchema = Schema.Literals(contractNames);
const CONTRACTS: {
  readonly [K in ContractName]: Parameters<
    typeof Schema.toJsonSchemaDocument
  >[0];
} = {
  JobRequest: JobRequestSchema,
  StartResult: StartResultSchema,
  JobView: JobViewSchema,
  JobEvent: JobEventSchema,
  EventOptions: EventOptionsSchema,
  HarnessHealth: HarnessHealthSchema,
  HarnessRequestError: HarnessRequestErrorSchema,
  VerdictOutcome: VerdictOutcomeSchema,
  Assessment: AssessmentSchema,
};

export const OperationSchema = Schema.Struct({
  name: Schema.String,
  summary: Schema.String,
  /** `harness`: a method of `createJobHarness()`; `cli`: a command of the `clearframe` binary. */
  surface: Schema.Literals(['harness', 'cli']),
  call: Schema.String,
  request: Schema.optionalKey(ContractNameSchema),
  result: Schema.optionalKey(ContractNameSchema),
  /** Contracts a failure follows, with the reasons it can carry. */
  errors: Schema.optionalKey(Schema.Array(Schema.String)),
  /** `read` has no effect on the project; `write` changes project or ledger state. */
  effect: Schema.Literals(['read', 'write']),
});
export type Operation = typeof OperationSchema.Type;

export const CapabilitiesSchema = Schema.Struct({
  name: Schema.Literal('clearframe'),
  contractVersion: Schema.Int,
  operations: Schema.Array(OperationSchema),
  jobs: Schema.Struct({
    kinds: Schema.Array(Schema.String),
    statuses: Schema.Array(Schema.String),
    terminal: Schema.Array(Schema.String),
  }),
  semantics: Schema.Record(Schema.String, Schema.String),
  schemas: Schema.Record(Schema.String, Schema.Unknown),
});
export type Capabilities = typeof CapabilitiesSchema.Type;

const OPERATIONS: readonly Operation[] = [
  {
    name: 'start',
    summary:
      'Submit a production job (still, section, check, draft, final, captions, revise, reject); voice and music need a sound grant.',
    surface: 'harness',
    call: 'harness.start(dir, request)',
    request: 'JobRequest',
    result: 'StartResult',
    errors: [
      'HarnessRequestError: invalid-request, approval-required, request-key-conflict, unavailable',
    ],
    effect: 'write',
  },
  {
    name: 'get',
    summary:
      'Read one job, including history outside the recent view; null when unknown.',
    surface: 'harness',
    call: 'harness.get(id)',
    result: 'JobView',
    effect: 'read',
  },
  {
    name: 'list',
    summary:
      'Read the recent jobs (an array of JobView), optionally for one film.',
    surface: 'harness',
    call: 'harness.list(film?)',
    result: 'JobView',
    effect: 'read',
  },
  {
    name: 'events',
    summary:
      'Read lifecycle events (an array of JobEvent) after a cursor, optionally for one job.',
    surface: 'harness',
    call: 'harness.events(options)',
    request: 'EventOptions',
    result: 'JobEvent',
    effect: 'read',
  },
  {
    name: 'cancel',
    summary: 'Record cancellation intent and stop a queued or running job.',
    surface: 'harness',
    call: 'harness.cancel(id)',
    result: 'JobView',
    errors: ['HarnessRequestError: unknown-job, not-running, unavailable'],
    effect: 'write',
  },
  {
    name: 'health',
    summary: 'Whether the harness can admit work, including a ledger failure.',
    surface: 'harness',
    call: 'harness.health()',
    result: 'HarnessHealth',
    effect: 'read',
  },
  {
    name: 'stop',
    summary:
      'Stop children and close the ledger; await it before releasing the caller.',
    surface: 'harness',
    call: 'await harness.stopAll()',
    effect: 'write',
  },
  {
    name: 'qa',
    summary:
      'Decode a rendered film, bind it to its receipt and measure it; `motion` is the readiness verdict with what it assessed, or why it could not be measured.',
    surface: 'cli',
    call: 'clearframe qa DIR --json',
    result: 'VerdictOutcome',
    effect: 'read',
  },
  {
    name: 'capabilities',
    summary: 'This document.',
    surface: 'cli',
    call: 'clearframe capabilities --json',
    effect: 'read',
  },
];

const SEMANTICS = {
  admission:
    'start decodes the request, pins its inputs when it begins to run and persists the job before any work starts; a ledger that cannot be written refuses work.',
  idempotency:
    'A repeated requestKey with the same request returns the existing job (duplicate: true); the same key with a different request is refused (request-key-conflict). Keys are local admission identity, not a provider exactly-once guarantee.',
  progress:
    'Poll get(id) for status and progress, or read events after the last seen seq; resume from that cursor after a restart.',
  cancellation:
    'cancel records intent, then stops the job’s process group (renderer and encoder included); the final status follows the observed exit. Cancelled and interrupted are different outcomes.',
  recovery:
    'Jobs unfinished when their owner stopped become interrupted and are never re-run automatically; a paid job’s outcome is recorded as unknown, and no new spending authority is granted.',
  evidence:
    'A video is evidence about the film only when bound to its render receipt (evidence.scope). evidence.coverage names which identity checks ran, not picture, sound or meaning. The motion verdict’s assessment lists each check (passed, findings, skipped, unavailable) and the claims no check answers.',
  acceptance:
    'A completed job, a READY verdict or an agent decision is not acceptance. Only `accept` records it, with the person and their words.',
  determinism:
    'Frames depend only on the frame number and prepared inputs; the same prepared job renders the same picture.',
} satisfies Record<string, string>;

/** A self-contained JSON Schema (draft 2020-12) for one contract. */
export function jsonSchema(name: ContractName) {
  const document = Schema.toJsonSchemaDocument(CONTRACTS[name]);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: name,
    ...document.schema,
    ...(Object.keys(document.definitions).length
      ? { $defs: document.definitions }
      : {}),
  };
}

export function capabilities(): Capabilities {
  return {
    name: 'clearframe',
    contractVersion: CONTRACT_VERSION,
    operations: OPERATIONS,
    jobs: {
      kinds: [...JOB_KINDS],
      statuses: [...JOB_STATUSES],
      terminal: [...TERMINAL_STATUSES],
    },
    semantics: SEMANTICS,
    schemas: Object.fromEntries(
      contractNames.map((name) => [name, jsonSchema(name)]),
    ),
  };
}
