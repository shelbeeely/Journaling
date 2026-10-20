// One place to find Chromium: CHROMIUM_PATH, else the sandbox copy, else Playwright's own download
// (CI runs `npx playwright-core install --with-deps chromium`).
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const SANDBOX = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync(SANDBOX) ? SANDBOX : undefined) });

// A brand-new editor opens on the guided start (BUILD-PLAN section 26, DF2). The tests that drive the editor directly open it as a person who already
// skipped that (the one flag the editor keeps, kw-guided-skip), so every page and context they open is seeded with it. launchEditor({ firstRun: true })
// is the browser that is not: the first-run tests in editor/test-guided.mjs use it to see the real first run.
const SKIP = () => { try { localStorage.setItem('kw-guided-skip', '1'); } catch { /* storage blocked: nothing to seed */ } };
export async function launchEditor({ firstRun = false } = {}) {
  const b = await launch();
  if (firstRun) return b;
  const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
  b.newContext = async (o) => { const c = await newContext(o); await c.addInitScript(SKIP); return c; };
  b.newPage = async (o) => { const p = await newPage(o); await p.context().addInitScript(SKIP); return p; };
  return b;
}
