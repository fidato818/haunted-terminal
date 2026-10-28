#!/usr/bin/env node
// src/daemon.ts - BILKUL TOP PAR YE LINE ADD KARO
import "dotenv/config";
import React from "react";
import { render } from "ink";
import { Terminal } from "./components/Terminal.js";
import { StatusBar } from "./components/StatusBar.js";
import { loadConfig } from "./utils/validators.js";
import { SecurityService } from "./services/securityService.js";
import logger from "./utils/logger.js";

const App: React.FC = () => {
  const config = loadConfig();
  // ✅ Debug: Shell detection check
  console.log(`[debug] Platform: ${process.platform}`);
  console.log(`[debug] SHELL env: ${process.env.SHELL}`);
  console.log(`[debug] ComSpec: ${process.env.ComSpec}`);
  console.log(`[debug] HOME: ${process.env.HOME || process.env.USERPROFILE}`);
  return (
    <>
      <Terminal config={config} />
      <StatusBar commandCount={0} ghostCount={0} isOnline={true} />
    </>
  );
};

// Validate environment before starting
if (!SecurityService.validateEnvironment()) {
  logger.error("Environment validation failed. Please check your .env file.");
  process.exit(1);
}

render(<App />, {
  exitOnCtrlC: true,
});

logger.info("Haunted Terminal started successfully");
