#!/usr/bin/env node
/**
 * Live end-to-end verification of the publisher-default Otari path:
 * loads the real artifacts + the real runtime, builds a RouterClient with
 * the publisher key, and runs the site's own first sample errand
 * (Rani → Sari simplifying the sample scholarship letter) against the
 * live Otari router. Prints a routing receipt — never the key.
 *
 * Usage:
 *   node scripts/verify-live.mjs              # local site/ + .otari-key.txt
 *   node scripts/verify-live.mjs --deployed   # artifacts + generated
 *                                             # publisher config fetched
 *                                             # from the live origin
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const deployed = process.argv.includes('--deployed');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://bacajelas-agentic.web.app';

const SAMPLE_LETTER = `Dear Applicant,

We are pleased to inform you that your application for the Kartini Merit Scholarship has been shortlisted. Pursuant to clause 7(b) of the programme regulations, shortlisted candidates are required to submit certified copies of their academic transcripts and one letter of recommendation no later than 17:00 on Friday, 12 December 2026. Failure to comply with the aforementioned submission requirements within the stipulated timeframe will result in the forfeiture of your candidacy without further notice.

Yours faithfully,
The Selection Committee`;
const ASK = 'Please simplify this letter so a 12-year-old can follow it — keep every fact and the deadline.';

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

let manifest, network, runtime, apiKey, keyEvidence;
if (!deployed) {
  const site = join(root, 'site');
  manifest = JSON.parse(readFileSync(join(site, 'agent-manifest.json'), 'utf8'));
  network = JSON.parse(readFileSync(join(site, 'bacajelas.network.json'), 'utf8'));
  runtime = await import(pathToFileURL(join(site, 'runtime', 'runtime.js')).href);
  apiKey = readFileSync(join(root, '.otari-key.txt'), 'utf8').trim();
  keyEvidence = `key source: .otari-key.txt (length ${apiKey.length})`;
} else {
  manifest = JSON.parse(await getText(`${ORIGIN}/agent-manifest.json`));
  network = JSON.parse(await getText(`${ORIGIN}/bacajelas.network.json`));
  const runtimeText = await getText(`${ORIGIN}/runtime/runtime.js`);
  const tmp = mkdtempSync(join(tmpdir(), 'bacajelas-runtime-'));
  const runtimePath = join(tmp, 'runtime.mjs');
  writeFileSync(runtimePath, runtimeText);
  runtime = await import(pathToFileURL(runtimePath).href);
  const configText = await getText(`${ORIGIN}/publisher-config.js`);
  const m = configText.match(/"apiKey":\s*"([^"]+)"/) || configText.match(/apiKey:\s*"([^"]+)"/);
  if (!m) {
    console.log(JSON.stringify({ ok: false, stage: 'deployed-config', error: 'publisher-config.js carries no apiKey — the deployed bundle is the keyless placeholder.' }, null, 1));
    process.exit(1);
  }
  apiKey = m[1];
  keyEvidence = `publisher key present in deployed bundle (length ${apiKey.length}, value never printed)`;
}
network.metadata = { ...(network.metadata ?? {}), front_man: manifest.networks[0].front_man };

const { AgentRuntime, ConsentGate, RouterClient } = runtime;
const model = new RouterClient({
  baseUrl: manifest.llm_router.base_url,
  model: manifest.llm_router.model,
  apiKey,
});

const events = [];
const rt = new AgentRuntime({
  network, model,
  consentGate: new ConsentGate(async () => false),
  onEvent: (e) => events.push(e),
});

const t0 = Date.now();
let answer, failure = null;
try {
  answer = await rt.run(`${ASK}\n\n---\n${SAMPLE_LETTER}`, { slyData: {} });
} catch (err) {
  failure = err.message;
}
const elapsedMs = Date.now() - t0;

const routing = events.filter((e) => e.type === 'routing').map((e) => `${e.from}→${e.to}`);
const receipt = {
  ok: !failure && routing.includes('rani→sari') && !!answer && answer.length > 80 && !answer.startsWith('(demo)'),
  mode: deployed ? 'deployed-origin' : 'local-files',
  origin: deployed ? ORIGIN : 'site/ (local)',
  routerHost: new URL(manifest.llm_router.base_url).host,
  model: manifest.llm_router.model,
  keyEvidence,
  events: events.map((e) => e.type),
  routing,
  invocations: events.filter((e) => e.type === 'agent-thinking').length,
  elapsedMs,
  failure,
  answerPreview: answer ? answer.slice(0, 700) : null,
};
console.log(JSON.stringify(receipt, null, 1));
process.exit(receipt.ok ? 0 : 1);
