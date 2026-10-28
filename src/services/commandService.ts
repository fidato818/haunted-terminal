import * as pty from 'node-pty';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { CommandResult } from '../types/index.js';
import logger from '../utils/logger.js';
import { SecurityService } from './securityService.js';

const execAsync = promisify(exec);

export class CommandService {
  private history: CommandResult[] = [];
  private maxHistorySize: number;
  private shell: string;
  private isWindows: boolean;

  constructor(maxHistorySize: number) {
    this.maxHistorySize = maxHistorySize;
    this.isWindows = os.platform() === 'win32';
    
    // ✅ Cross-platform shell detection
    this.shell = this.detectShell();
    logger.info(`Using shell: ${this.shell}`);
  }

  /**
   * Detect available shell based on OS
   */
  private detectShell(): string {
    if (this.isWindows) {
      // Windows: PowerShell > cmd > bash (Git Bash)
      if (process.env.PSModulePath) {
        return 'powershell.exe';
      }
      if (process.env.ComSpec) {
        return process.env.ComSpec; // cmd.exe
      }
      // Fallback to bash if Git Bash is installed
      return 'bash';
    } else {
      // macOS/Linux: Use SHELL env or fallback to bash
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Execute command safely
   */
  async executeCommand(command: string): Promise<CommandResult> {
    // Validate command first
    const securityCheck = SecurityService.validateCommand(command);
    
    if (!securityCheck.passed) {
      logger.warn(`Command rejected: ${command} - ${securityCheck.reason}`);
      return {
        command,
        timestamp: new Date(),
        exitCode: 1,
        output: `Command rejected: ${securityCheck.reason}`,
      };
    }

    const safeCommand = securityCheck.sanitizedCommand!;

    // ✅ Use child_process for better compatibility
    return this.executeWithChildProcess(safeCommand);
  }

  /**
   * Execute command using child_process (more reliable than node-pty)
   */
  private async executeWithChildProcess(command: string): Promise<CommandResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      exec(command, {
        shell: this.shell,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
        env: process.env,
      }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;
        
        let output = stdout || '';
        if (stderr) {
          output += stderr;
        }

        const exitCode = error ? (error as any).code || 1 : 0;

        const result: CommandResult = {
          command,
          timestamp: new Date(),
          exitCode,
          output: output.trim(),
        };

        this.addToHistory(result);
        
        logger.debug(`Command executed in ${duration}ms: ${command}`);
        resolve(result);
      });
    });
  }

  /**
   * Alternative: Execute with node-pty (for interactive commands)
   */
  private async executeWithPty(command: string): Promise<CommandResult> {
    return new Promise((resolve) => {
      try {
        const ptyProcess = pty.spawn(this.shell, ['-c', command], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME || process.env.USERPROFILE,
          env: process.env,
        });

        let output = '';

        ptyProcess.onData((data) => {
          output += data;
        });

        ptyProcess.onExit(({ exitCode }) => {
          const result: CommandResult = {
            command,
            timestamp: new Date(),
            exitCode,
            output: output.trim(),
          };

          this.addToHistory(result);
          resolve(result);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          ptyProcess.kill();
          resolve({
            command,
            timestamp: new Date(),
            exitCode: 124,
            output: 'Command timed out',
          });
        }, 30000);
      } catch (error) {
        logger.error('PTY execution failed:', error);
        resolve({
          command,
          timestamp: new Date(),
          exitCode: 1,
          output: `PTY error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    });
  }

  /**
   * Add command to history
   */
  private addToHistory(result: CommandResult): void {
    this.history.push(result);
    
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get command history
   */
  getHistory(): CommandResult[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    logger.info('Command history cleared');
  }

  /**
   * Get recent commands
   */
  getRecentCommands(count: number = 5): CommandResult[] {
    return this.history.slice(-count);
  }
}