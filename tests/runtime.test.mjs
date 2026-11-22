/**
 * §6 interop self-tests (headless subset) — run: node --test tests/
 * Covers: publishable artifacts validate; internal agent call through the
 * mock model; a grounded local site action; consent gate blocks ALL contact
 * when denied (fetch is never called); tampered / cyclic / ghost-front
 * networks rejected; over-budget request stopped; sly_data deny-by-default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AgentRuntime, ConsentGate, MockModel, filterSlyData, validateNetwork,
} from '../site/runtime/runtime.js';
import { createSiteActions } from '../site/site-actions.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', 'site');
const manifest = JSON.parse(readFileSync(join(site, 'agent-manifest.json'), 'utf8'));
const links = JSON.parse(readFileSync(join(site, 'links.json'), 'utf8'));
const network = JSON.parse(readFileSync(join(site, 'bacajelas.network.json'), 'utf8'));
network.metadata = { ...network.metadata, front_man: manifest.networks[0].front_man };

test('§6 publish: manifest names name/front_man/hocon; links.json is well-formed', () => {
  const entry = manifest.networks[0];
  assert.equal(entry.name, 'bacajelas');
  assert.equal(entry.front_man, 'rani');
  assert.match(entry.hocon, /bacajelas\.network\.json$/);
  assert.equal(manifest.llm_router.base_url, 'https://api.otari.ai/api/v1');
  assert.equal(links.version, 1);
  assert.ok('bacajelas' in links.networks);
});

test('§6 publish: the network validates clean (front + 3 specialists)', () => {
  const v = validateNetwork(network);
  assert.equal(v.ok, true, v.errors.join(' '));
  assert.deepEqual(v.agents.sort(), ['alih', 'rani', 'rara', 'sari']);
});

test('§6 run: front agent delegates to an internal specialist (mock model)', async () => {
  const events = [];
  const rt = new AgentRuntime({
    network, model: MockModel,
    consentGate: new ConsentGate(async () => false),
    onEvent: (e) => events.push(e),
  });
  const answer = await rt.run('Please simplify this. The committee hereby promulgates the aforementioned regulations forthwith. Pursuant to section nine, all residents are required to comply.');
  assert.match(answer, /Sari/);
  assert.ok(events.some((e) => e.type === 'routing' && e.from === 'rani' && e.to === 'sari'));
  assert.ok(events.some((e) => e.type === 'run-done'));
});

test('§6 grounded capability: a registered local site action answers', async () => {
  const page = { getEditorText: () => 'yang dan ini adalah teks', applyReadingPreferences: () => {} };
  const actions = createSiteActions(page);
  const detect = actions.find((a) => a.name === 'website_detect_language');
  const r = await detect.handler({ text: page.getEditorText() });
  assert.equal(r.ok, true);
  assert.equal(r.language, 'id');
  const read = actions.find((a) => a.name === 'website_get_editor_text');
  assert.match((await read.handler({})).text, /adalah/);
  assert.ok(actions.every((a) => a.name && a.purpose && a.parameters && a.effect && a.handler));
});

test('§6 stop: tampered network (duplicate agent + cycle) is rejected', () => {
  const bad = JSON.parse(JSON.stringify(network));
  bad.tools.push({ name: 'sari', function: { description: 'duplicate' } });
  bad.tools.find((a) => a.name === 'sari').tools = ['rani'];
  const v = validateNetwork(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /Duplicate/.test(e)));
  assert.ok(v.errors.some((e) => /cycle/i.test(e)));
});

test('§6 stop: ghost front agent and dangling reference are rejected', () => {
  const bad = JSON.parse(JSON.stringify(network));
  bad.metadata.front_man = 'ghost';
  bad.tools[0].tools = ['rani', 'nobody'];
  const v = validateNetwork(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /front agent "ghost"/.test(e)));
  assert.ok(v.errors.some((e) => /unknown agent "nobody"/.test(e)));
});

test('§6 stop: over-budget request is halted with an error', async () => {
  const rt = new AgentRuntime({
    network, model: MockModel,
    consentGate: new ConsentGate(async () => false),
    limits: { maxInvocations: 1 },
  });
  await assert.rejects(() => rt.run('Please simplify this text.'), /budget/);
});

test('§6 consent: a denied origin is never contacted (fetch not called)', async () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not be called'); };
  try {
    const rt = new AgentRuntime({
      network, model: MockModel,
      consentGate: new ConsentGate(async () => false),
    });
    await assert.rejects(() => rt.loadPeer('https://peer.example/agents/transit', 'hello'), /said no/);
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('§6 privacy: sly_data is deny-by-default across the boundary', () => {
  const secret = { personal_text: 'my private letter', reading_level: 'plain', ui_language: 'id' };
  assert.deepEqual(filterSlyData(secret, network.sly_data.allow_to_peer), {});
  assert.deepEqual(filterSlyData(secret, network.sly_data.internal_allow), { reading_level: 'plain', ui_language: 'id' });
});
