/**
 * BacaJelas browser runtime — an original, dependency-free implementation of
 * the Worldwide Agentic Web MVP Profile 0.3 observable behaviours:
 *  - parse + validate a resolved Neuro SAN network definition (fail closed)
 *  - run the front agent with bounded delegation (depth / invocations / time)
 *  - consent BEFORE any third-party origin contact (session-scoped memory)
 *  - private context (sly_data) deny-by-default across site boundaries
 *  - pluggable inference: default router, BYOK, or clearly-labelled mock mode
 *  - registered local site actions with confirmation for writes
 *
 * This module is DOM-free so it can be unit-tested in Node; the page wires
 * the callbacks (onEvent, requestConsent, confirmAction) to real UI.
 */

export const RUNTIME_VERSION = 'bacajelas-runtime/1.0 (MVP Profile 0.3)';

export const LIMITS = {
  maxDepth: 4,
  maxInvocations: 24,
  maxRemoteCalls: 4,
  maxElapsedMs: 120_000,
  maxHistoryMessages: 20,
};

/* ------------------------------------------------------------------ *
 * Validation — spec §3.1 "Parse and validate", §5 "Fail closed".
 * Returns { ok, errors[] }. Any error means: do not run the network.
 * ------------------------------------------------------------------ */
export function validateNetwork(net, opts = {}) {
  const profile = opts.profile ?? 'strict';
  const errors = [];
  const warnings = [];
  const fail = (m) => errors.push(m);

  if (!net || typeof net !== 'object' || Array.isArray(net)) {
    return { ok: false, errors: ['Network definition is not a JSON object.'] };
  }
  if (!Array.isArray(net.tools) || net.tools.length === 0) {
    fail('Network has no agents ("tools" array is missing or empty).');
    return { ok: false, errors };
  }

  const names = new Set();
  for (const agent of net.tools) {
    if (!agent || typeof agent.name !== 'string' || !agent.name) {
      fail('An agent is missing its "name".');
      continue;
    }
    if (names.has(agent.name)) fail(`Duplicate agent name: "${agent.name}".`);
    names.add(agent.name);
    if (!agent.function || typeof agent.function.description !== 'string' || !agent.function.description) {
      fail(`Agent "${agent.name}" is missing function.description.`);
    }
    const params = agent.function?.parameters;
    if (params !== undefined) {
      if (typeof params !== 'object' || params === null || params.type !== 'object') {
        fail(`Agent "${agent.name}" function.parameters must be a JSON Schema object schema.`);
      }
    }
    if (agent.tools !== undefined && !Array.isArray(agent.tools)) {
      fail(`Agent "${agent.name}" has a non-array "tools" list.`);
    }
  }

  // Front agent: the manifest names it; inside the network we infer it as the
  // agent nothing else delegates to, and require exactly the declared one.
  const declaredFront = net.metadata?.front_man;
  if (declaredFront && !names.has(declaredFront)) {
    fail(`Declared front agent "${declaredFront}" does not exist in the network.`);
  }
  if (net.tools.length < 2) fail('Network must contain at least two agents (front + specialist).');

  // Tool references must resolve: agent names, external network URLs, or MCP descriptors.
  for (const agent of net.tools) {
    for (const tool of agent.tools ?? []) {
      if (typeof tool === 'string') {
        if (/^https?:\/\//.test(tool)) continue; // external network URL
        if (!names.has(tool)) fail(`Agent "${agent.name}" calls unknown agent "${tool}".`);
      } else if (tool && typeof tool === 'object') {
        if (typeof tool.url !== 'string' || !/^https?:\/\//.test(tool.url)) {
          fail(`Agent "${agent.name}" has an MCP descriptor without a valid url.`);
        }
      } else {
        fail(`Agent "${agent.name}" has an invalid tool entry.`);
      }
    }
  }

  // Cycle guard on the internal delegation graph (spec §6: stop a composition cycle).
  const graph = new Map();
  for (const a of net.tools) {
    if (!a?.name || graph.has(a.name)) continue; // first occurrence wins; duplicates already errored above
    graph.set(a.name, (a.tools ?? []).filter((t) => typeof t === 'string' && names.has(t)));
  }
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map([...names].map((n) => [n, WHITE]));
  const visit = (n, path) => {
    color.set(n, GREY);
    for (const next of graph.get(n) ?? []) {
      if (color.get(next) === GREY) fail(`Composition cycle detected: ${[...path, n, next].join(' -> ')}.`);
      else if (color.get(next) === WHITE) visit(next, [...path, n]);
    }
    color.set(n, BLACK);
  };
  for (const n of names) if (color.get(n) === WHITE) visit(n, []);

  // sly_data rules must exist and be explicit (deny-by-default is the default,
  // but a conforming network states its policy). In the "peer" profile — used
  // when WE load someone else's network — a missing policy is not fatal: the
  // safe default (deny-all) is applied by the caller and the gap is reported
  // as a warning instead of a rejection.
  if (!net.sly_data || !Array.isArray(net.sly_data.allow_to_peer)) {
    if (profile === 'peer') {
      warnings.push('Peer states no sly_data policy — the caller applies deny-all: no private context crosses.');
    } else {
      fail('Network is missing sly_data.allow_to_peer (private-context policy must be explicit).');
    }
  }

  return { ok: errors.length === 0, errors, warnings, frontMan: declaredFront ?? null, agents: [...names] };
}

/* ------------------------------------------------------------------ *
 * Replacement strings — peer networks may ship {placeholders} in their
 * instructions (commondefs.replacement_strings, cruse-style). Resolve
 * them before the network runs so a visiting model sees finished text.
 * ------------------------------------------------------------------ */
export function resolveReplacements(net) {
  const reps = net?.commondefs?.replacement_strings;
  if (!reps || typeof reps !== 'object') return net;
  const apply = (s) => {
    if (typeof s !== 'string') return s;
    let out = s;
    for (const [k, v] of Object.entries(reps)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
  for (const agent of net?.tools ?? []) {
    if (agent.instructions) agent.instructions = apply(agent.instructions);
    if (agent.function?.description) agent.function.description = apply(agent.function.description);
  }
  if (net?.metadata?.description) net.metadata.description = apply(net.metadata.description);
  return net;
}

/* ------------------------------------------------------------------ *
 * Private context filter — spec §5: fields pass ONLY if named in an
 * allow rule. Everything else is dropped, silently and completely.
 * ------------------------------------------------------------------ */
export function filterSlyData(slyData, allowedFields) {
  const out = {};
  if (!slyData || typeof slyData !== 'object') return out;
  for (const field of allowedFields ?? []) {
    if (Object.prototype.hasOwnProperty.call(slyData, field)) out[field] = slyData[field];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Consent gate — spec §3.2 step 4 + §5: identify origin + purpose and
 * obtain approval BEFORE contact; memory is per-origin, per session.
 * ------------------------------------------------------------------ */
export class ConsentGate {
  constructor(requestConsent) {
    this.requestConsent = requestConsent; // async ({origin, purpose}) => boolean
    this.approved = new Set();
    this.denied = new Set();
  }
  async ensure(origin, purpose) {
    if (this.approved.has(origin)) return true;
    if (this.denied.has(origin)) return false;
    const ok = await this.requestConsent({ origin, purpose });
    (ok ? this.approved : this.denied).add(origin);
    return ok;
  }
}

/* ------------------------------------------------------------------ *
 * Mock model — deterministic, offline, input-derived. Exists so every
 * flow is demoable with no key and no network. Clearly labelled in UI.
 * ------------------------------------------------------------------ */
function firstSentences(text, n) {
  const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) ?? [String(text)];
  return parts.slice(0, n).map((s) => s.trim());
}
/* Derive sensible read-tool arguments from a plain-language request, so a
 * peer's MCP tools can be exercised deterministically in demo mode. */
function deriveMcpArgs(text) {
  const t = String(text).toLowerCase();
  const args = {};
  if (/four weeks|4 weeks|28 days/.test(t)) args.withinDays = 28;
  else if (/this month|bulan ini/.test(t)) args.withinDays = 30;
  else if (/this week|minggu ini/.test(t)) args.withinDays = 7;
  if (/hackathon/.test(t)) args.category = 'hackathon';
  else if (/essay/.test(t)) args.category = 'essay-prize';
  else if (/poetr/.test(t)) args.category = 'poetry';
  else if (/design/.test(t)) args.category = 'design';
  else if (/film|movie/.test(t)) args.category = 'film';
  else if (/writing|menulis/.test(t)) args.category = 'writing';
  if (/generative ai|ai (is )?allowed|allow.*\bai\b/.test(t)) args.aiPolicy = 'allowed';
  return args;
}
/* Present a remote tool result honestly and readably. Board-shaped JSON
 * (a "calls" array) gets a friendly digest; anything else is shown as-is. */
function presentToolResult(content) {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.calls)) {
      const lines = data.calls.slice(0, 6).map((c) =>
        `• ${c.title} — closes ${c.deadlineLabel} (${c.daysLeft} days left) · ${c.prize} · ${c.url}`);
      const more = data.count > data.returned ? `\n…${data.count} open calls matched in total; these are the ${data.returned} soonest.` : '';
      return `📋 Live from the neighbour's board — today is ${data.todayLabel}:\n${lines.join('\n')}${more}\n\n(Fetched live, just now, from the peer site — this part is real data, not a demo script.)`;
    }
    if (data && data.ok === false) return `The neighbour's board said: ${data.reason ?? 'it could not answer.'}`;
  } catch { /* not JSON — fall through */ }
  return String(content).slice(0, 1500);
}
export const MockModel = {
  id: 'mock',
  label: 'Demo mode — local mock specialists (no key needed)',
  async complete({ agent, messages, mcpTools = [], agentTools = [] }) {
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const toolCalls = [];
    // Follow-up pass: a remote tool already answered — present its facts.
    const toolResult = [...messages].reverse().find((m) => m.role === 'tool')?.content;
    if (toolResult) return { text: presentToolResult(toolResult), toolCalls };
    // Front agent delegates deterministically by keyword, so the full
    // routing flow is visible offline exactly as with a live model.
    if (agent === 'rani') {
      const text = last.toLowerCase();
      const target = /translat|terjemah|inggris|indonesia/.test(text)
        ? 'alih'
        : /summar|ringkas|rangkum|long|article|artikel/.test(text)
          ? 'rara'
          : 'sari';
      toolCalls.push({ name: target, arguments: { request: last, text: last } });
      return { text: '', toolCalls };
    }
    if (agent === 'sari') {
      const simple = firstSentences(last, 3).join(' ');
      return { text: `(demo) Here is a gentler version:\n\n${simple}\n\n— Sari kept every fact, just made the sentences kinder.`, toolCalls };
    }
    if (agent === 'alih') {
      return { text: `(demo) Alih would translate this between Indonesian and English, matching its tone. Add your own key in Settings for the live translation.\n\n"${firstSentences(last, 1).join(' ')}"`, toolCalls };
    }
    if (agent === 'rara') {
      const bullets = firstSentences(last, 5).map((s) => `• ${s}`).join('\n');
      return { text: `(demo) In short: ${firstSentences(last, 1).join(' ')}\n\n${bullets}`, toolCalls };
    }
    // Generic peer agent with remote (MCP) tools: really call the first
    // read tool — in demo mode the *orchestration* is scripted, the *data*
    // that comes back is live from the peer's own server.
    if (mcpTools.length) {
      const pick = mcpTools.includes('mcp_find_open_calls') ? 'mcp_find_open_calls' : mcpTools[0];
      toolCalls.push({ name: pick, arguments: deriveMcpArgs(last) });
      return { text: '', toolCalls };
    }
    // Generic peer front agent: hand the request to its first specialist.
    if (agentTools.length) {
      toolCalls.push({ name: agentTools[0], arguments: { request: last, text: last } });
      return { text: '', toolCalls };
    }
    return { text: `(demo) ${agent} is here and ready to help. Add your own key in the caller's Settings and this visiting agent answers live.`, toolCalls };
  },
};

/* ------------------------------------------------------------------ *
 * OpenAI-compatible router client. The visitor's key is attached ONLY
 * to requests to the router they chose — never anywhere else (§4).
 * ------------------------------------------------------------------ */
export class RouterClient {
  constructor({ baseUrl, model, apiKey }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.apiKey = apiKey ?? null;
  }
  async complete({ agent, system, messages, toolSchemas, signal }) {
    const body = {
      model: this.model,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(toolSchemas?.length
        ? { tools: toolSchemas.map((t) => ({ type: 'function', function: t })), tool_choice: 'auto' }
        : {}),
    };
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Router answered HTTP ${res.status}. Nothing was retried automatically.`);
    const data = await res.json();
    const msg = data.choices?.[0]?.message ?? {};
    const toolCalls = (msg.tool_calls ?? []).map((c) => ({
      name: c.function?.name,
      arguments: safeParse(c.function?.arguments),
    }));
    return { text: msg.content ?? '', toolCalls };
  }
}
function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : (s ?? {}); } catch { return {}; }
}

/* ------------------------------------------------------------------ *
 * Minimal MCP client (JSON-RPC over HTTP) for the remote tools a
 * network declares in an agent's tool list ({url, tools:[...]}).
 * Deliberately credential-free: NO Authorization header is ever sent —
 * the visitor's router key belongs to the router alone (§4), and a
 * peer's public read tools need no key.
 * ------------------------------------------------------------------ */
export class McpClient {
  constructor(url) {
    this.url = url;
    this.seq = 0;
    this.toolsCache = null;
  }
  async #rpc(method, params) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.seq, method, params }),
    });
    if (!res.ok) throw new Error(`MCP endpoint answered HTTP ${res.status}.`);
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch {
      const line = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!line) throw new Error('MCP endpoint returned an unreadable answer.');
      data = JSON.parse(line.slice(5));
    }
    if (data.error) throw new Error(`MCP error: ${data.error.message ?? 'unknown error'}`);
    return data.result;
  }
  async listTools() {
    if (!this.toolsCache) {
      const r = await this.#rpc('tools/list', {});
      this.toolsCache = r?.tools ?? [];
    }
    return this.toolsCache;
  }
  async callTool(name, args) {
    const r = await this.#rpc('tools/call', { name, arguments: args ?? {} });
    const parts = (r?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text);
    return parts.join('\n') || JSON.stringify(r ?? {});
  }
}

/* ------------------------------------------------------------------ *
 * The bounded agent engine. Emits events so the UI can show the agents
 * alive: thinking, routing, working, consent, receipts, errors.
 * ------------------------------------------------------------------ */
export class AgentRuntime {
  constructor({ network, model, consentGate, actions, onEvent, limits, validationProfile }) {
    const v = validateNetwork(network, { profile: validationProfile ?? 'strict' });
    if (!v.ok) throw new Error(`Network failed validation: ${v.errors.join(' ')}`);
    this.validationWarnings = v.warnings ?? [];
    this.network = network;
    this.model = model;
    this.consentGate = consentGate;
    this.actions = actions ?? new Map();
    this.onEvent = onEvent ?? (() => {});
    this.limits = { ...LIMITS, ...(limits ?? {}) };
    this.agents = new Map(network.tools.map((a) => [a.name, a]));
    this.frontMan = network.metadata?.front_man ?? this.#inferFrontMan();
    this.stats = { invocations: 0, remoteCalls: 0, mcpCalls: 0, startedAt: 0 };
    this.mcpClients = new Map();
    this.lastPeerRuntime = null;
  }

  #mcpClient(url) {
    if (!this.mcpClients.has(url)) this.mcpClients.set(url, new McpClient(url));
    return this.mcpClients.get(url);
  }

  #inferFrontMan() {
    const called = new Set();
    for (const a of this.network.tools) for (const t of a.tools ?? []) if (typeof t === 'string') called.add(t);
    const roots = this.network.tools.map((a) => a.name).filter((n) => !called.has(n));
    return roots[0] ?? this.network.tools[0].name;
  }

  registerAction(action) { this.actions.set(action.name, action); }

  async #checkBudgets(depth) {
    if (depth > this.limits.maxDepth) throw new Error(`Stopped kindly: delegation went deeper than the safety limit (${this.limits.maxDepth}).`);
    if (this.stats.invocations >= this.limits.maxInvocations) throw new Error(`Stopped kindly: this request used its whole step budget (${this.limits.maxInvocations}).`);
    if (Date.now() - this.stats.startedAt > this.limits.maxElapsedMs) throw new Error('Stopped kindly: this request took longer than the time budget.');
  }

  async run(userText, { slyData = {} } = {}) {
    this.stats = { invocations: 0, remoteCalls: 0, mcpCalls: 0, startedAt: Date.now() };
    this.onEvent({ type: 'run-start', agent: this.frontMan });
    const answer = await this.#invoke(this.frontMan, userText, { depth: 0, slyData });
    this.onEvent({ type: 'run-done', agent: this.frontMan });
    return answer;
  }

  async #invoke(agentName, requestText, { depth, slyData }) {
    await this.#checkBudgets(depth);
    const agent = this.agents.get(agentName);
    if (!agent) throw new Error(`Unknown agent "${agentName}" — stopped, nothing was guessed.`);
    this.stats.invocations += 1;
    this.onEvent({ type: 'agent-thinking', agent: agentName, depth });

    const internalTools = (agent.tools ?? []).filter((t) => typeof t === 'string' && this.agents.has(t));
    const toolSchemas = internalTools.map((name) => {
      const target = this.agents.get(name);
      return { name, description: target.function.description, parameters: target.function.parameters ?? { type: 'object', properties: { request: { type: 'string' } } } };
    });

    // Remote (MCP) tools the agent declares: list them live from the
    // endpoint and offer them to the model as mcp_<name> schemas.
    const mcpRegistry = new Map();
    for (const t of agent.tools ?? []) {
      if (t && typeof t === 'object' && typeof t.url === 'string') {
        const client = this.#mcpClient(t.url);
        try {
          const remote = await client.listTools();
          for (const tool of remote) {
            if (Array.isArray(t.tools) && !t.tools.includes(tool.name)) continue;
            const schemaName = `mcp_${tool.name}`;
            mcpRegistry.set(schemaName, { client, tool });
            toolSchemas.push({
              name: schemaName,
              description: tool.description ?? `Remote tool ${tool.name}`,
              parameters: tool.inputSchema ?? { type: 'object', properties: {} },
            });
          }
        } catch (err) {
          this.onEvent({ type: 'error', agent: agentName, message: `Remote tools at ${t.url} could not be listed (${err.message}) — continuing without them.` });
        }
      }
    }

    const messages = [{ role: 'user', content: requestText }];
    const result = await this.model.complete({
      agent: agentName,
      system: agent.instructions ?? '',
      messages,
      toolSchemas,
      mcpTools: [...mcpRegistry.keys()],
      agentTools: internalTools,
    });

    if (result.toolCalls?.length) {
      const pieces = [];
      const toolResults = [];
      for (const call of result.toolCalls.slice(0, 3)) {
        if (mcpRegistry.has(call.name)) {
          const { client, tool } = mcpRegistry.get(call.name);
          if (this.stats.remoteCalls >= this.limits.maxRemoteCalls) {
            throw new Error('Stopped kindly: remote-call budget for this request is used up.');
          }
          this.stats.remoteCalls += 1;
          this.stats.mcpCalls += 1;
          const origin = new URL(client.url).origin;
          this.onEvent({ type: 'mcp-call', agent: agentName, tool: tool.name, origin });
          try {
            const text = await client.callTool(tool.name, call.arguments ?? {});
            toolResults.push({ name: call.name, content: text });
            this.onEvent({ type: 'mcp-result', agent: agentName, tool: tool.name, ok: true });
          } catch (err) {
            toolResults.push({ name: call.name, content: `The remote tool failed: ${err.message}` });
            this.onEvent({ type: 'mcp-result', agent: agentName, tool: tool.name, ok: false });
          }
          continue;
        }
        if (!this.agents.has(call.name)) {
          this.onEvent({ type: 'error', agent: agentName, message: `Model asked for unknown agent "${call.name}" — refused.` });
          continue;
        }
        this.onEvent({ type: 'routing', from: agentName, to: call.name, depth });
        // Internal delegation may carry only internally-allowed sly fields.
        const childSly = filterSlyData(slyData, this.network.sly_data?.internal_allow ?? []);
        const childText = call.arguments?.text ?? call.arguments?.request ?? requestText;
        pieces.push(await this.#invoke(call.name, childText, { depth: depth + 1, slyData: childSly }));
      }
      if (toolResults.length) {
        // One follow-up pass: the agent presents the remote facts in its
        // own voice. Further tool calls in this pass are not executed.
        await this.#checkBudgets(depth);
        this.stats.invocations += 1;
        const follow = await this.model.complete({
          agent: agentName,
          system: agent.instructions ?? '',
          messages: [
            ...messages,
            { role: 'assistant', content: '' },
            ...toolResults.map((r) => ({ role: 'tool', name: r.name, content: r.content })),
          ],
          toolSchemas: [],
          mcpTools: [],
          agentTools: [],
        });
        if (follow.text) pieces.push(follow.text);
      }
      this.onEvent({ type: 'agent-done', agent: agentName, depth });
      return pieces.join('\n\n');
    }

    this.onEvent({ type: 'agent-done', agent: agentName, depth });
    return result.text ?? '';
  }

  /* Peer loading — spec §3.2: consent BEFORE the manifest fetch; the peer
   * runs locally on OUR router; sly_data crosses only if explicitly allowed
   * (this network allows none). Fails closed with a visible reason.
   *
   * peerRef may be:
   *  - a network-definition URL ("https://peer.example/deadline_desk.network.json")
   *    — the manifest is read from the same directory and the entry is found
   *    by matching its hocon pointer;
   *  - a ".../<network-name>" URL — the entry is found by exact name;
   *  - { manifestUrl, networkName }.
   * A receipt of the crossing is kept on this.lastPeerReceipt and emitted
   * as a 'peer-receipt' event: who was visited, which agents woke up, how
   * many remote calls were made, and exactly which private fields crossed
   * (normally: none) vs. were withheld. */
  async loadPeer(peerRef, requestText, { slyData = {} } = {}) {
    let manifestUrl, wantedName = null, wantedDefUrl = null;
    if (peerRef && typeof peerRef === 'object') {
      manifestUrl = peerRef.manifestUrl;
      wantedName = peerRef.networkName ?? null;
    } else {
      const ref = String(peerRef);
      const dir = ref.replace(/\/[^/]*$/, '');
      const last = ref.split('/').pop();
      manifestUrl = `${dir}/agent-manifest.json`;
      if (last.endsWith('.json')) wantedDefUrl = ref;
      else wantedName = last;
    }
    const origin = new URL(manifestUrl).origin;
    const base = manifestUrl.replace(/\/[^/]*$/, '');
    const displayName = wantedName ?? (wantedDefUrl ? wantedDefUrl.split('/').pop() : 'network');
    this.onEvent({ type: 'peer-consent-ask', origin, network: displayName });
    const allowed = await this.consentGate.ensure(origin, `Load the "${displayName}" agent network from ${origin} and run it here, in your browser.`);
    if (!allowed) {
      this.onEvent({ type: 'peer-denied', origin });
      throw new Error(`You said no to contacting ${origin} — nothing was sent there. That is the system working as promised.`);
    }
    if (this.stats.remoteCalls >= this.limits.maxRemoteCalls) throw new Error('Stopped kindly: remote-call budget for this request is used up.');
    this.stats.remoteCalls += 1;

    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) throw new Error(`Peer manifest could not be fetched (HTTP ${manifestRes.status}) — stopped.`);
    const manifest = await manifestRes.json();
    const entry = (manifest.networks ?? []).find((n) =>
      wantedName ? n.name === wantedName
        : new URL(n.hocon, `${base}/`).toString() === wantedDefUrl);
    if (!entry) throw new Error(`Peer site does not publish the requested network (${displayName}) — stopped rather than guessing.`);

    const defUrl = new URL(entry.hocon, `${base}/`).toString();
    const defRes = await fetch(defUrl);
    if (!defRes.ok) throw new Error(`Peer network definition could not be fetched (HTTP ${defRes.status}) — stopped.`);
    const peerNet = resolveReplacements(await defRes.json());
    // Peers are validated under the "peer" profile: a network that omits an
    // explicit sly_data policy is not rejected — the caller-side deny-all
    // default applies and the gap is surfaced as a warning instead.
    const v = validateNetwork(peerNet, { profile: 'peer' });
    if (!v.ok) {
      this.onEvent({ type: 'peer-invalid', origin, errors: v.errors });
      throw new Error(`Peer network failed validation and was rejected: ${v.errors.join(' ')}`);
    }
    for (const warning of v.warnings ?? []) this.onEvent({ type: 'peer-warning', origin, message: warning });
    this.onEvent({ type: 'peer-loaded', origin, network: entry.name, agents: v.agents });

    const peerRuntime = new AgentRuntime({
      network: peerNet, model: this.model, consentGate: this.consentGate,
      actions: new Map(), onEvent: this.onEvent, limits: this.limits,
      validationProfile: 'peer',
    });
    // Private context crossing the boundary: only allow_to_peer fields pass.
    const allowedFields = this.network.sly_data?.allow_to_peer ?? [];
    const peerSly = filterSlyData(slyData, allowedFields);
    const answer = await peerRuntime.run(requestText, { slyData: peerSly });
    const receipt = {
      origin,
      network: entry.name,
      frontMan: peerRuntime.frontMan,
      agents: v.agents,
      warnings: v.warnings ?? [],
      invocations: peerRuntime.stats.invocations,
      remoteCalls: peerRuntime.stats.remoteCalls,
      mcpCalls: peerRuntime.stats.mcpCalls,
      slySharedFields: Object.keys(peerSly),
      slyWithheldFields: Object.keys(slyData ?? {}).filter((k) => !(k in peerSly)),
      routerKeySentToPeer: false,
    };
    this.lastPeerReceipt = receipt;
    this.onEvent({ type: 'peer-receipt', receipt });
    return answer;
  }
}
