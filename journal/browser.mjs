// One place to find Chromium: CHROMIUM_PATH, else the sandbox copy, else Playwright's own download
// (CI runs `npx playwright-core install --with-deps chromium`).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync(SANDBOX) ? SANDBOX : undefined) });
