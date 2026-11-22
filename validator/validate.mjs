#!/usr/bin/env node
/**
 * bacajelas-validate — a tiny, dependency-free conformance checker for
 * Open Agentic Web sites (MVP Profile 0.3 observable behaviours).
 *
 * Usage:
 *   node validator/validate.mjs https://your-site.example/      # check a live site
 *   node validator/validate.mjs ./path/to/site-dir              # check local files
 *   node validator/validate.mjs ./agent-manifest.json           # manifest file directly
 *
 * It verifies the things that make an agentic website safe to link to:
 *  - agent-manifest.json is published and names name / front_man / hocon
 *  - the network definition parses and validates (agents named + unique,
 *    every tool reference resolves, no delegation cycles, an explicit
 *    sly_data private-context policy)
 *  - links.json, when present, is well-formed
 *  - for live sites: the artifacts are reachable and CORS-open, so other
 *    sites' browsers can actually fetch them
 *
 * Exit code 0 = conformant, 1 = problems found. Warnings never fail.
 * The validation core is the same one BacaJelas's browser runtime runs
 * before it lets any network — its own or a neighbour's — wake up.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { validateNetwork, resolveReplacements } from '../site/runtime/runtime.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node validator/validate.mjs <site-url | site-dir | manifest.json>');
  process.exit(2);
}

const lines = [];
let failures = 0;
const ok = (m) => lines.push(`  ✔ ${m}`);
const warn = (m) => lines.push(`  ⚠ ${m}`);
const fail = (m) => { failures += 1; lines.push(`  ✘ ${m}`); };

async function loadJson(fromUrl, fromFile) {
  if (fromUrl) {
    const res = await fetch(fromUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${fromUrl}`);
    const cors = res.headers.get('access-control-allow-origin');
    return { data: await res.json(), cors };
  }
  return { data: JSON.parse(await readFile(fromFile, 'utf8')), cors: null };
}

const isUrl = /^https?:\/\//.test(target);
let manifestUrl = null, manifestFile = null, baseUrl = null, baseDir = null;
if (isUrl) {
  baseUrl = target.replace(/\/?$/, '/');
  manifestUrl = new URL('agent-manifest.json', baseUrl).toString();
} else if (target.endsWith('.json')) {
  manifestFile = target;
  baseDir = dirname(target);
} else {
  baseDir = target;
  manifestFile = join(target, 'agent-manifest.json');
}

console.log(`\nChecking ${target}\n`);

let manifest;
try {
  const r = await loadJson(manifestUrl, manifestFile);
  manifest = r.data;
  ok(`agent-manifest.json is published${isUrl ? ` (CORS: ${r.cors === '*' ? 'open' : 'not open'})` : ''}`);
  if (isUrl && r.cors !== '*') fail('agent-manifest.json is not CORS-open — other sites cannot fetch it from a browser.');
} catch (e) {
  fail(`agent-manifest.json could not be loaded: ${e.message}`);
  console.log(lines.join('\n'));
  process.exit(1);
}

const entry = manifest.networks?.[0];
if (!entry?.name || !entry?.front_man || !entry?.hocon) {
  fail('manifest.networks[0] must name "name", "front_man" and "hocon".');
} else {
  ok(`network "${entry.name}" · front agent "${entry.front_man}" · definition "${entry.hocon}"`);
}
if (!manifest.peer_policy?.mode) warn('manifest states no peer_policy.mode — visitors deserve to know when you would contact a third party.');
if (!manifest.llm_router?.base_url) warn('manifest names no llm_router.base_url — callers cannot tell which router the site expects.');

let network;
try {
  const defUrl = isUrl ? new URL(entry.hocon, baseUrl).toString() : null;
  const defFile = isUrl ? null : join(baseDir, entry.hocon.replace(/^\.\//, ''));
  const r = await loadJson(defUrl, defFile);
  network = resolveReplacements(r.data);
  if (isUrl && r.cors !== '*') fail('network definition is not CORS-open — peers cannot load it from a browser.');
} catch (e) {
  fail(`network definition could not be loaded: ${e.message}`);
}

if (network) {
  network.metadata = { ...(network.metadata ?? {}), front_man: entry.front_man };
  const v = validateNetwork(network);
  if (v.ok) ok(`network validates: ${v.agents.length} agents (${v.agents.join(', ')}), references resolve, no cycles, sly_data policy explicit`);
  else v.errors.forEach((e) => fail(`network: ${e}`));
  (v.warnings ?? []).forEach((w) => warn(`network: ${w}`));
  if (Array.isArray(network.sly_data?.allow_to_peer) && network.sly_data.allow_to_peer.length === 0) {
    ok('sly_data.allow_to_peer is empty — private context is deny-by-default across site boundaries');
  }
}

try {
  const r = await loadJson(isUrl ? new URL('links.json', baseUrl).toString() : null, isUrl ? null : join(baseDir, 'links.json'));
  if (r.data && typeof r.data === 'object' && r.data.networks) ok(`links.json is well-formed (${Object.keys(r.data.networks).length} network binding(s))`);
  else warn('links.json exists but has no "networks" object.');
} catch { warn('no links.json found (optional, but it is how neighbours discover your bindings).'); }

console.log(lines.join('\n'));
console.log(failures === 0 ? '\n✔ Conformant — safe to link to.\n' : `\n✘ ${failures} problem(s) to fix before this site is safe to link to.\n`);
process.exit(failures === 0 ? 0 : 1);
