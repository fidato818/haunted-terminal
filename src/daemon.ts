#!/usr/bin/env node
// src/daemon.ts - BILKUL TOP PAR YE LINE ADD KARO
import 'dotenv/config';
import { loadConfig } from './utils/validators.js';
import { OllamaService } from './services/ollamaService.js';
import { CommandService } from './services/commandService.js';
import { SecurityService } from './services/securityService.js';
import logger from './utils/logger.js';

class HauntedDaemon {
  private config = loadConfig();
  private ollamaService = new OllamaService(this.config);
  private commandService = new CommandService(this.config.maxHistorySize);

  async start() {
    logger.info('Starting Haunted Terminal Daemon...');

    // Validate environment
    if (!SecurityService.validateEnvironment()) {
      logger.error('Environment validation failed');
      process.exit(1);
    }

    // Check Ollama availability
    const available = await this.ollamaService.isAvailable();
    if (!available) {
      logger.error('Ollama is not available');
      process.exit(1);
    }

    logger.info('Daemon started successfully');
    logger.info(`Model: ${this.config.ollamaModel}`);
    logger.info(`Ghost frequency: ${this.config.ghostFrequency}`);
  }
}

const daemon = new HauntedDaemon();
daemon.start().catch(error => {
  logger.error('Daemon failed to start:', error);
  process.exit(1);
});