export interface GhostConfig {
  ollamaHost: string;
  ollamaModel: string;
  ghostFrequency: number;
  maxCommandLength: number;
  maxHistorySize: number;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  logLevel: string;
  logFile: string;
}

export interface CommandResult {
  command: string;
  timestamp: Date;
  exitCode: number;
  output: string;
}

export interface GhostMessage {
  id: string;
  content: string;
  timestamp: Date;
  command: string;
}

export interface SecurityCheck {
  passed: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export interface OllamaResponse {
  message: {
    content: string;
  };
}