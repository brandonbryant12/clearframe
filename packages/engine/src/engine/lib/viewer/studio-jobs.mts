// The studio uses the same execution harness available to other local adapters.
export {
  createJobHarness as createStudioJobs,
  inputPrint,
  probeMedia,
  SOUND_GRANT,
} from '../harness/jobs.mjs';
