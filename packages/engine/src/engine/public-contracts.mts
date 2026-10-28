// Framework-neutral contracts for ClearFrame's public operations (`clearframe/contracts`). This
// entry depends only on `effect`: an agent adapter in any framework can decode requests and
// results, or publish the JSON Schema documents, without loading the renderer, the studio or an
// agent runtime. Every type here is inferred from its schema.
export {
  decodeJobRequest,
  EventOptionsSchema,
  HarnessFailureSchema,
  HarnessHealthSchema,
  HarnessRequestError,
  JOB_KINDS,
  JOB_STATUSES,
  JobEventSchema,
  JobKindSchema,
  JobRequestSchema,
  JobResultSchema,
  JobStatusSchema,
  JobViewSchema,
  MediaProbeSchema,
  StartResultSchema,
  TERMINAL_STATUSES,
} from './lib/harness/contracts.mjs';
export type {
  EventOptions,
  HarnessHealth,
  JobEvent,
  JobKind,
  JobRequest,
  JobStatus,
  JobView,
  StartResult,
} from './lib/harness/contracts.mjs';
export {
  AssessmentCheckSchema,
  AssessmentCheckStatusSchema,
  AssessmentSchema,
  EvidenceScopeSchema,
  IdentityCoverageSchema,
  MotionVerdictSchema,
  VerdictOutcomeSchema,
} from './lib/qa-assessment.mjs';
export type {
  Assessment,
  AssessmentCheck,
  AssessmentCheckStatus,
  MotionVerdict,
  VerdictOutcome,
} from './lib/qa-assessment.mjs';
export {
  capabilities,
  CapabilitiesSchema,
  CONTRACT_VERSION,
  HarnessRequestErrorSchema,
  jsonSchema,
  OperationSchema,
} from './lib/capabilities.mjs';
export type {
  Capabilities,
  ContractName,
  Operation,
} from './lib/capabilities.mjs';
