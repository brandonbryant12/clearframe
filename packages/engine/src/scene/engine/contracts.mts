export interface BuildOptions {
  force?: boolean;
}

/** A prepared project: the directory holding job.json and plan.json. */
export interface EngineContext {
  dir: string;
}
