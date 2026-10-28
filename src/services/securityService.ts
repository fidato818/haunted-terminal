import { z } from "zod";
import { SecurityCheck } from "../types/index.js";
import logger from "../utils/logger.js";

// Command validation schema
const commandSchema = z
  .string()
  .max(500, "Command too long")
  .refine((cmd) => !cmd.includes("\0"), "Null bytes not allowed")
  .refine((cmd) => !/[\r\n]/.test(cmd), "Newlines not allowed");

// Dangerous commands pattern
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /mkfs\./, // Format commands
  /dd\s+if=/, // Disk dump
  /:\(\)\s*\{.*\}\s*;/, // Fork bomb
  /chmod\s+-R\s+777\s+\//, // Dangerous permissions
  />\s*\/dev\/[sh]d[a-z]/, // Direct disk write
  /\|\s*sh/, // Pipe to shell
  /\|\s*bash/, // Pipe to bash
  /eval\s+\$/, // Eval with variable
  /exec\s+\$/, // Exec with variable
];

// Sensitive file patterns
const SENSITIVE_PATHS = [
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\.ssh\//,
  /\.env/,
  /\.git\/config/,
  /id_rsa/,
  /id_ed25519/,
];

export class SecurityService {
  /**
   * Validate and sanitize command input
   */
  static validateCommand(command: string): SecurityCheck {
    try {
      // Basic validation with Zod
      const validated = commandSchema.parse(command);

      // Check for dangerous patterns
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(validated)) {
          logger.warn(`Dangerous command pattern detected: ${pattern}`);
          return {
            passed: false,
            reason: "Command contains dangerous pattern",
          };
        }
      }

      // Check for sensitive file access
      for (const pattern of SENSITIVE_PATHS) {
        if (pattern.test(validated)) {
          logger.warn(`Sensitive path access attempt: ${pattern}`);
          return {
            passed: false,
            reason: "Command attempts to access sensitive files",
          };
        }
      }

      // Sanitize command (remove potential injection vectors)
      const sanitized = this.sanitizeCommand(validated);

      return {
        passed: true,
        sanitizedCommand: sanitized,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Command validation failed:", error.errors);
        return {
          passed: false,
          reason: error.errors.map((e) => e.message).join(", "),
        };
      }

      logger.error("Unexpected validation error:", error);
      return {
        passed: false,
        reason: "Validation error",
      };
    }
  }

  /**
   * Sanitize command to prevent injection
   */
  private static sanitizeCommand(command: string): string {
    // Remove null bytes
    let sanitized = command.replace(/\0/g, "");

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

    // Escape special characters that could be used for injection
    sanitized = sanitized
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$")
      .replace(/\\/g, "\\\\");

    return sanitized;
  }

  /**
   * Check if command should trigger ghost
   */
  static shouldTriggerGhost(command: string, frequency: number): boolean {
    // Don't trigger on empty commands
    if (!command.trim()) return false;

    // Don't trigger on help/clear commands
    const skipCommands = ["clear", "help", "exit", "quit", "history"];
    if (skipCommands.includes(command.trim().toLowerCase())) {
      return false;
    }

    // Random chance based on frequency
    return Math.random() < frequency;
  }

  /**
   * Sanitize LLM response to prevent terminal injection
   */
  static sanitizeLLMResponse(response: string): string {
    // Remove ANSI escape sequences that could manipulate terminal
    let sanitized = response.replace(/\x1B\[[0-9;]*[JKmsu]/g, "");

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

    // Limit length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + "...";
    }

    return sanitized;
  }

  /**
   * Validate environment variables
   */
  static validateEnvironment(): boolean {
    // Sirf OLLAMA_HOST check karo, baaki ke defaults hain
    const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

    // Validate OLLAMA_HOST is a valid URL
    try {
      new URL(ollamaHost);
    } catch {
      logger.error("OLLAMA_HOST must be a valid URL");
      return false;
    }

    logger.info(`Environment validated. Using Ollama at: ${ollamaHost}`);
    return true;
  }
}
