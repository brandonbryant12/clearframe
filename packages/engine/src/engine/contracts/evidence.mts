export interface PreparedManifest {
  version: number;
  inputId: string;
  hashes: Record<string, string>;
  inputs?: Record<string, string>;
  prepared?: Record<string, string>;
  sceneHash?: string;
  jobHash?: string;
  sounds?: Record<string, string>;
}

export interface RenderReceipt {
  version?: number;
  inputId?: string;
  outputSha256?: string;
  hashes?: Record<string, string>;
  width?: number;
  height?: number;
  fps?: number;
  frames?: number;
  duration?: number;
  draft?: boolean;
  rough?: boolean;
  scale?: number;
  authoredWidth?: number;
  authoredHeight?: number;
  revision?: string;
  output?: string;
  createdAt?: string;
}

export interface Finding {
  level: 'error' | 'warn' | 'info';
  message: string;
  where?: string;
  kind?: string;
}
