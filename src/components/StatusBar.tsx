import React from 'react';
import { Text, Box } from 'ink';

interface StatusBarProps {
  commandCount: number;
  ghostCount: number;
  isOnline: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  commandCount, 
  ghostCount, 
  isOnline 
}) => {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color="cyan">
          Commands: {commandCount} | Ghosts: {ghostCount}
        </Text>
      </Box>
      <Box>
        <Text color={isOnline ? 'green' : 'red'}>
          {isOnline ? '● Connected' : '● Disconnected'}
        </Text>
      </Box>
    </Box>
  );
};