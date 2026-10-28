import { z } from 'zod';
import { GhostConfig } from '../types/index.js';

const configSchema = z.object({
  ollamaHost: z.string().url(),
  ollamaModel: z.string().min(1),
  ghostFrequency: z.number().min(0).max(1),
  maxCommandLength: z.number().positive(),
  maxHistorySize: z.number().positive(),
  rateLimitWindow: z.number().positive(),
  rateLimitMaxRequests: z.number().positive(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  logFile: z.string(),
});

export function validateConfig(config: unknown): GhostConfig {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function loadConfig(): GhostConfig {
  const config = {
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1',
    ghostFrequency: parseFloat(process.env.GHOST_FREQUENCY || '0.3'),
    maxCommandLength: parseInt(process.env.MAX_COMMAND_LENGTH || '500'),
    maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '100'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    logLevel: (process.env.LOG_LEVEL || 'info') as GhostConfig['logLevel'],
    logFile: process.env.LOG_FILE || './logs/ghost.log',
  };

  return validateConfig(config);
}