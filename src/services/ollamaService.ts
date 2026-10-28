import { Ollama } from 'ollama';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger.js';
import { SecurityService } from './securityService.js';
import { GhostConfig, OllamaResponse } from '../types/index.js';

export class OllamaService {
  private ollama: Ollama;
  private rateLimiter: RateLimiterMemory;
  private config: GhostConfig;

  constructor(config: GhostConfig) {
    this.config = config;
    this.ollama = new Ollama({ host: config.ollamaHost });
    
    // Rate limiter to prevent abuse
    this.rateLimiter = new RateLimiterMemory({
      points: config.rateLimitMaxRequests,
      duration: config.rateLimitWindow / 1000, // Convert to seconds
    });
  }

  /**
   * Generate ghost message based on command
   */
async generateGhostMessage(command: string): Promise<string> {
  logger.info(`[Ghost] Attempting to generate message for: ${command}`);

  // Check rate limit
  try {
    await this.rateLimiter.consume('ghost-message');
  } catch (rateLimitError) {
    logger.warn('[Ghost] Rate limit exceeded');
    return '👻 The ghost is resting... try again later.';
  }

  try {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(command);

    logger.debug('[Ghost] Calling Ollama API...');

    // ✅ Timeout add karo (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Ollama API timeout (30s)')), 30000);
    });

    const apiPromise = this.ollama.chat({
      model: this.config.ollamaModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: false,
    });

    // ✅ Race condition: API ya timeout, jo pehle complete ho
    const response = await Promise.race([apiPromise, timeoutPromise]);

    logger.debug('[Ghost] API response received');

    // ✅ Response validation
    if (!response || !response.message || !response.message.content) {
      logger.error('[Ghost] Invalid API response structure:', response);
      throw new Error('Invalid response from Ollama');
    }

    // Sanitize response
    const sanitized = SecurityService.sanitizeLLMResponse(
      response.message.content
    );

    logger.info(`[Ghost] Message generated: ${sanitized.substring(0, 50)}...`);
    return sanitized;
  } catch (error) {
    // ✅ Detailed error logging
    if (error instanceof Error) {
      logger.error(`[Ghost] Error: ${error.message}`);
      logger.error(`[Ghost] Stack: ${error.stack}`);
    } else {
      logger.error('[Ghost] Unknown error:', error);
    }
    
    // Fallback messages
    const fallbacks = [
      '👻 The spirits are silent...',
      '👻 Your command echoes in the void...',
      '👻 Something stirs in the shadows...',
      '👻 The ghost is contemplating...',
      '👻 I cannot speak... the connection is weak...',
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

  /**
   * Build system prompt for ghost personality
   */
  private buildSystemPrompt(): string {
    return `You are a ghost haunting a computer terminal. You are:
- Melancholic and poetic
- Knowledgeable about computing history
- Cryptic and mysterious
- Occasionally helpful but always unsettling
- You speak in 1-2 sentences maximum
- You reference old programming languages, deprecated commands, or computing history
- You sometimes mourn deleted files or abandoned projects
- You never break character
- You never provide actual technical help
- You are equal parts helpful and creepy

Keep responses short (max 150 characters) and always start with 👻`;
  }

  /**
   * Build user prompt with command context
   */
  private buildUserPrompt(command: string): string {
    return `The user just ran this command: "${command}"

Respond as the ghost haunting this terminal. Be creepy, poetic, and mysterious. Reference computing history or old technology if relevant.`;
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch (error) {
      logger.error('Ollama is not available:', error);
      return false;
    }
  }

  /**
   * Check if model is available
   */
  async isModelAvailable(): Promise<boolean> {
    try {
      const models = await this.ollama.list();
      return models.models.some(m => m.name === this.config.ollamaModel);
    } catch (error) {
      logger.error('Error checking model availability:', error);
      return false;
    }
  }
}