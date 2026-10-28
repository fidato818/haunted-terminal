import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import { GhostMessage as GhostMessageComponent } from './GhostMessage.js';
import { OllamaService } from '../services/ollamaService.js';
import { CommandService } from '../services/commandService.js';
import { SecurityService } from '../services/securityService.js';
import { GhostConfig, GhostMessage as GhostMessageType } from '../types/index.js';
import logger from '../utils/logger.js';

interface TerminalProps {
  config: GhostConfig;
}

export const Terminal: React.FC<TerminalProps> = ({ config }) => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [ghostMessages, setGhostMessages] = useState<GhostMessageType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const ollamaServiceRef = useRef<OllamaService | null>(null);
  const commandServiceRef = useRef<CommandService | null>(null);

  // ✅ Initialize services once
  useEffect(() => {
    ollamaServiceRef.current = new OllamaService(config);
    commandServiceRef.current = new CommandService(config.maxHistorySize);
    checkOllama();
  }, [config]);

  // Handle keyboard input
  useInput((input, key) => {
    if (!isReady) return;

    if (key.return) {
      handleCommand();
    } else if (key.backspace || key.delete) {
      setCommand(prev => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setCommand(prev => prev + input);
    }
  });

  const checkOllama = async () => {
    if (!ollamaServiceRef.current) return;

    const available = await ollamaServiceRef.current.isAvailable();
    if (!available) {
      setOutput(prev => [...prev, '❌ Error: Ollama is not running. Please start Ollama first.']);
      return;
    }

    const modelAvailable = await ollamaServiceRef.current.isModelAvailable();
    if (!modelAvailable) {
      setOutput(prev => [
        ...prev,
        `❌ Error: Model ${config.ollamaModel} is not available.`,
        `   Run: ollama pull ${config.ollamaModel}`,
      ]);
      return;
    }

    setOutput([
      '👻 Welcome to the Haunted Terminal...',
      '👻 The ghost is watching your every command...',
      '👻 Type commands and see what awakens...',
      '',
    ]);
    setIsReady(true);
  };

  const handleCommand = async () => {
    if (!command.trim()) return;
    if (isProcessing || !commandServiceRef.current || !ollamaServiceRef.current) return;

    setIsProcessing(true);
    const currentCommand = command;
    setCommand('');
    setOutput(prev => [...prev, `$ ${currentCommand}`]);

    try {
      // Execute command
      const result = await commandServiceRef.current.executeCommand(currentCommand);
      
      if (result.output) {
        setOutput(prev => [...prev, result.output]);
      } else if (result.exitCode !== 0) {
        setOutput(prev => [...prev, `Command failed with exit code ${result.exitCode}`]);
      }

      // Check if ghost should appear
      if (SecurityService.shouldTriggerGhost(currentCommand, config.ghostFrequency)) {
        await summonGhost(currentCommand);
      }
    } catch (error) {
      logger.error('Error executing command:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setOutput(prev => [
        ...prev,
        `❌ Error: ${errorMsg}`,
      ]);
    } finally {
      setIsProcessing(false);
      setOutput(prev => [...prev, '']);
    }
  };

  const summonGhost = async (command: string) => {
    if (!ollamaServiceRef.current) return;

    logger.info(`[Terminal] Summoning ghost for: ${command}`);
    
    try {
      const message = await ollamaServiceRef.current.generateGhostMessage(command);
      
      logger.info(`[Terminal] Ghost message: ${message}`);

      const ghostMessage: GhostMessageType = {
        id: `${Date.now()}-${Math.random()}`,
        content: message,
        timestamp: new Date(),
        command,
      };

      // ✅ Direct state update
      setGhostMessages(prev => {
        const updated = [...prev, ghostMessage];
        logger.info(`[Terminal] Ghost messages count: ${updated.length}`);
        return updated;
      });
    } catch (error) {
      logger.error('[Terminal] Error summoning ghost:', error);
      setOutput(prev => [
        ...prev,
        `👻 The ghost failed to respond.`,
      ]);
    }
  };

  const removeGhostMessage = useCallback((id: string) => {
    setGhostMessages(prev => {
      const filtered = prev.filter(msg => msg.id !== id);
      logger.info(`[Terminal] Removed ghost message. Remaining: ${filtered.length}`);
      return filtered;
    });
  }, []);

  if (!isReady) {
    return (
      <Box padding={1}>
        <Text color="yellow">Initializing haunted terminal...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* ✅ Ghost Messages - Top */}
      {ghostMessages.map(msg => (
        <GhostMessageComponent
          key={msg.id}
          message={msg}
          onFadeOut={removeGhostMessage}
        />
      ))}

      {/* Terminal Output */}
      {output.map((line, index) => (
        <Text key={index} color={line.startsWith('$') ? 'green' : 'white'}>
          {line}
        </Text>
      ))}

      {/* Command Input */}
      <Box>
        <Text color="green" bold>$ </Text>
        <Text>{command}</Text>
        {isProcessing && <Text color="yellow"> (processing...)</Text>}
      </Box>
    </Box>
  );
};