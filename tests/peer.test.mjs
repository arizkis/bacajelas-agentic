/**
 * Peer-loading tests (§3.2 + §6) — a Deadline-Desk-shaped peer served by a
 * stub fetch: manifest + network (NO sly_data policy, {placeholder}
 * instructions, an MCP descriptor agent), plus a stub JSON-RPC MCP endpoint
 * returning live-shaped board data. Verifies: consent precedes all contact;
 * peer-profile validation warns instead of rejecting on a missing sly_data
 * policy; replacements resolve; the peer's MCP tool is REALLY called (with
 * no Authorization header — the router key never travels); the receipt
 * records that zero private fields crossed; a cyclic peer is rejected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AgentRuntime, ConsentGate, MockModel, resolveReplacements, validateNetwork,
} from '../site/runtime/runtime.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', 'site');
const manifest = JSON.parse(readFileSync(join(site, 'agent-manifest.json'), 'utf8'));
const links = JSON.parse(readFileSync(join(site, 'links.json'), 'utf8'));
const network = JSON.parse(readFileSync(join(site, 'bacajelas.network.json'), 'utf8'));
network.metadata = { ...network.metadata, front_man: manifest.networks[0].front_man };

const PEER_ORIGIN = 'https://deadline-desk-agent.vercel.app';
const peerManifest = {
  brand: 'Deadline Desk Assistant',
  networks: [{
    name: 'deadline_desk', front_man: 'deadline_desk_assistant',
    hocon: './deadline_desk.network.json',
    description: 'Find open prize contests and hackathons you can still enter.',
  }],
};
const peerNetwork = {
  metadata: { description: 'The {site_name} board.' },
  commondefs: { replacement_strings: { site_name: 'Deadline Desk' } },
  // NOTE: no sly_data key at all — exactly like the real peer. Peer profile
  // must warn + apply caller-side deny-all, not reject.
  tools: [
    {
      name: 'deadline_desk_assistant',
      instructions: 'You are the {site_name} assistant. Facts come only from tools.',
      function: { description: 'Front agent of {site_name}.', parameters: { type: 'object', properties: { request: { type: 'string' } } } },
      tools: ['board_lookup'],
    },
    {
      name: 'board_lookup',
      instructions: 'Look up the board.',
      function: { description: 'Board lookup specialist.', parameters: { type: 'object', properties: { request: { type: 'string' } } } },
      tools: [{ url: `${PEER_ORIGIN}/api/mcp`, tools: ['find_open_calls'] }],
    },
  ],
};
const boardJson = JSON.stringify({
  todayLabel: 'Sun 22 Nov 2026', count: 1, returned: 1,
  calls: [{ title: 'Open Agentic Web Challenge', deadlineLabel: 'Mon 11 Jan 2027', daysLeft: 50, prize: '$10,000', url: 'https://cognizant-agenticweb.devpost.com/' }],
});

function makeFetch(calls, { peerNet = peerNetwork } = {}) {
  return async (url, opts = {}) => {
    calls.push({ url: String(url), headers: opts.headers ?? {}, body: opts.body });
    const res = (obj, status = 200) => ({
      ok: status < 300, status,
      json: async () => obj,
      text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)),
    });
    if (String(url) === `${PEER_ORIGIN}/agent-manifest.json`) return res(peerManifest);
    if (String(url) === `${PEER_ORIGIN}/deadline_desk.network.json`) return res(peerNet);
    if (String(url) === `${PEER_ORIGIN}/api/mcp`) {
      const rpc = JSON.parse(opts.body);
      if (rpc.method === 'tools/list') {
        return res({ jsonrpc: '2.0', id: rpc.id, result: { tools: [{ name: 'find_open_calls', description: 'List open calls.', inputSchema: { type: 'object', properties: { withinDays: { type: 'number' }, category: { type: 'string' } } } }] } });
      }
      if (rpc.method === 'tools/call') {
        return res({ jsonrpc: '2.0', id: rpc.id, result: { content: [{ type: 'text', text: boardJson }] } });
      }
      return res({ jsonrpc: '2.0', id: rpc.id, error: { message: 'unknown method' } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

function makeRuntime(events, consentAnswer = true) {
  return new AgentRuntime({
    network, model: MockModel,
    consentGate: new ConsentGate(async () => consentAnswer),
    onEvent: (e) => events.push(e),
  });
}

test('§3.2 wiring: links.json binds Deadline Desk; manifest allows its origin', () => {
  assert.equal(links.networks.deadline_desk.url, `${PEER_ORIGIN}/deadline_desk.network.json`);
  assert.equal(links.networks.deadline_desk.origin, PEER_ORIGIN);
  assert.ok(manifest.allowed_peers.includes(PEER_ORIGIN));
});

test('§3.2 peer profile: a network with no sly_data policy warns, not rejects', () => {
  const strict = validateNetwork(peerNetwork);
  assert.equal(strict.ok, false);
  const peer = validateNetwork(peerNetwork, { profile: 'peer' });
  assert.equal(peer.ok, true, peer.errors.join(' '));
  assert.ok(peer.warnings.some((w) => /sly_data/.test(w)));
});

test('§3.2 replacements: {placeholders} in peer instructions resolve', () => {
  const net = JSON.parse(JSON.stringify(peerNetwork));
  resolveReplacements(net);
  assert.match(net.tools[0].instructions, /Deadline Desk assistant/);
  assert.doesNotMatch(net.tools[0].instructions, /\{site_name\}/);
});

test('§6 composition: consent → load → MCP tool really called → live board answer + receipt', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFetch(calls);
  try {
    const events = [];
    const rt = makeRuntime(events);
    const answer = await rt.loadPeer(
      `${PEER_ORIGIN}/deadline_desk.network.json`,
      'Which hackathons that allow generative AI close in the next four weeks?',
      { slyData: { personal_text: 'my private scholarship letter' } },
    );
    // The answer presents the peer's LIVE board data (via its MCP tool).
    assert.match(answer, /Open Agentic Web Challenge/);
    assert.match(answer, /neighbour's board/);
    // Consent was asked before the first fetch to the peer origin.
    assert.ok(events.some((e) => e.type === 'peer-consent-ask' && e.origin === PEER_ORIGIN));
    assert.ok(events.some((e) => e.type === 'peer-warning' && /sly_data/.test(e.message)));
    assert.ok(events.some((e) => e.type === 'peer-loaded' && e.network === 'deadline_desk'));
    assert.ok(events.some((e) => e.type === 'mcp-call' && e.tool === 'find_open_calls'));
    // The MCP call carried NO Authorization header — the key never travels.
    const mcpCall = calls.find((c) => c.url === `${PEER_ORIGIN}/api/mcp`);
    assert.ok(mcpCall, 'MCP endpoint was contacted');
    assert.equal(mcpCall.headers.Authorization, undefined);
    // Receipt: nothing private crossed; the personal text was withheld.
    const receipt = rt.lastPeerReceipt;
    assert.ok(receipt, 'receipt recorded');
    assert.equal(receipt.network, 'deadline_desk');
    assert.deepEqual(receipt.slySharedFields, []);
    assert.deepEqual(receipt.slyWithheldFields, ['personal_text']);
    assert.equal(receipt.routerKeySentToPeer, false);
    assert.ok(receipt.mcpCalls >= 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('§6 stop: a cyclic peer network is rejected even under the peer profile', async () => {
  const cyclic = JSON.parse(JSON.stringify(peerNetwork));
  cyclic.tools[1].tools = ['deadline_desk_assistant']; // board_lookup -> front: cycle
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFetch(calls, { peerNet: cyclic });
  try {
    const events = [];
    const rt = makeRuntime(events);
    await assert.rejects(
      () => rt.loadPeer(`${PEER_ORIGIN}/deadline_desk.network.json`, 'hello'),
      /failed validation/,
    );
    assert.ok(events.some((e) => e.type === 'peer-invalid'));
    assert.equal(calls.some((c) => String(c.url).endsWith('/api/mcp')), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('§6 consent: denied consent blocks even the manifest fetch (.json form)', async () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not be called'); };
  try {
    const rt = makeRuntime([], false);
    await assert.rejects(
      () => rt.loadPeer(`${PEER_ORIGIN}/deadline_desk.network.json`, 'hello'),
      /said no/,
    );
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
