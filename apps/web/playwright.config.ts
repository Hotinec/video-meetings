import { defineConfig } from '@playwright/test';

// Runs against the already-running dev servers (web :3000, API :3001).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    // Set PW_CHANNEL=chrome to use the system Chrome instead of the downloaded Chromium.
    channel: process.env.PW_CHANNEL || undefined,
  },
});
