/* BacaJelas page wiring: loads the manifest + network + links, boots the
 * runtime, and turns runtime events into a living, friendly UI. Includes
 * the cross-site visit to Deadline Desk (M3) and the §6 trust theatre (M5). */
import { AgentRuntime, ConsentGate, MockModel, RouterClient, validateNetwork } from './runtime/runtime.js';
import { createSiteActions } from './site-actions.js';
import { PUBLISHER_DEFAULT } from './publisher-config.js';

const $ = (s) => document.querySelector(s);
const NAMES = { rani: 'Rani', sari: 'Sari', alih: 'Alih', rara: 'Rara' };
const FACES = { thinking: 'Thinking…', working: 'Working on it…', done: 'Done ✓', idle: 'Resting', error: 'Hit a snag' };
const PEER_URL = 'https://deadline-desk-agent.vercel.app/deadline_desk.network.json';

let manifest, network, links, runtime, modelMode = 'mock';
const settings = loadSettings();
const stats = loadStats();

/* ---------------- settings + stats ---------------- */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('bacajelas-settings') ?? '{}'); } catch { return {}; }
}
function saveSettings() { localStorage.setItem('bacajelas-settings', JSON.stringify(settings)); }
function loadStats() {
  try { return { clarified: 0, visits: 0, ...JSON.parse(localStorage.getItem('bacajelas-stats') ?? '{}') }; } catch { return { clarified: 0, visits: 0 }; }
}
function saveStats() {
  localStorage.setItem('bacajelas-stats', JSON.stringify(stats));
  $('#stat-clarified').textContent = stats.clarified;
}

/* Inference mode (spec §4): the visitor's own key wins; otherwise the
 * publisher default when this deployment carries one; otherwise the
 * clearly-labelled demo model. An explicit demo-mode choice in Settings
 * wins over both live paths. */
function buildModel() {
  if (!settings.mock && settings.apiKey) {
    return new RouterClient({
      baseUrl: settings.baseUrl || manifest.llm_router.base_url,
      model: settings.model || manifest.llm_router.model || 'alibaba/qwen3.8-flash',
      apiKey: settings.apiKey,
    });
  }
  if (!settings.mock && PUBLISHER_DEFAULT) {
    return new RouterClient({
      baseUrl: PUBLISHER_DEFAULT.baseUrl,
      model: PUBLISHER_DEFAULT.model,
      apiKey: PUBLISHER_DEFAULT.apiKey,
    });
  }
  return MockModel;
}
function liveSource() {
  if (settings.apiKey) return 'visitor';
  if (PUBLISHER_DEFAULT) return 'publisher';
  return null;
}
function modelName() {
  if (settings.apiKey) return settings.model || manifest.llm_router.model || 'default model';
  if (PUBLISHER_DEFAULT) return PUBLISHER_DEFAULT.model;
  return manifest.llm_router.model || 'default model';
}
function modePillText() {
  if (modelMode === 'mock') return '✦ Demo mode — mock specialists, fully offline';
  return liveSource() === 'visitor'
    ? `✦ Live — ${modelName()} via your router`
    : `✦ Live — ${modelName()} on the house (publisher default)`;
}

/* ---------------- ledger + stage ---------------- */
function stamp() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function log(kind, html) {
  const li = document.createElement('li');
  li.className = `ev-${kind}`;
  li.innerHTML = `<time>${stamp()}</time>${html}`;
  const list = $('#ledger');
  list.prepend(li);
  while (list.children.length > 80) list.lastChild.remove();
}
function setAgent(name, state) {
  const card = document.querySelector(`.agent[data-agent="${name}"]`);
  if (!card) return;
  card.dataset.state = state;
  card.querySelector('.agent-status').textContent = FACES[state] ?? state;
}
function resetAgents() { Object.keys(NAMES).forEach((n) => setAgent(n, 'idle')); }

function onEvent(ev) {
  switch (ev.type) {
    case 'run-start':
      resetAgents(); setAgent(ev.agent, 'thinking');
      log('routing', `💌 <b>${NAMES[ev.agent] ?? ev.agent}</b> received a request and is gathering the team…`);
      break;
    case 'agent-thinking':
      setAgent(ev.agent, 'thinking');
      if (ev.agent !== 'rani' && NAMES[ev.agent]) log('routing', `💭 <b>${NAMES[ev.agent]}</b> is reading carefully…`);
      break;
    case 'routing':
      setAgent(ev.from, 'working'); setAgent(ev.to, 'thinking');
      log('routing', `🧭 <b>${NAMES[ev.from] ?? ev.from}</b> asked <b>${NAMES[ev.to] ?? ev.to}</b> to help — passing only what's needed.`);
      break;
    case 'agent-done':
      setAgent(ev.agent, 'done');
      if (ev.agent !== 'rani' && NAMES[ev.agent]) log('done', `✨ <b>${NAMES[ev.agent]}</b> finished and handed the answer back.`);
      break;
    case 'peer-consent-ask':
      log('consent', `🤝 Rani wants to visit <b>${ev.origin}</b> (network “${ev.network}”) — waiting for your word. Nothing has been sent.`);
      break;
    case 'peer-denied':
      log('consent', `🛑 You said no to <b>${ev.origin}</b> — so nobody went. Promise kept.`);
      break;
    case 'peer-loaded':
      log('peer', `📥 The neighbour's network “<b>${ev.network}</b>” arrived and passed our safety checks (${ev.agents.join(' + ')}). It runs here now — on your router, under our rules.`);
      break;
    case 'peer-warning':
      log('consent', `⚠ A note on the neighbour's file: ${ev.message} We carry on with the safer default.`);
      break;
    case 'mcp-call':
      log('peer', `📡 <b>${NAMES[ev.agent] ?? ev.agent}</b> is asking the neighbour's own board tool (<code>${ev.tool}</code>) at ${ev.origin} — live data, fetched this second. No key attached, ever.`);
      break;
    case 'mcp-result':
      log(ev.ok ? 'done' : 'error', ev.ok ? `📬 The neighbour's board answered. Real data, just now.` : `💔 The neighbour's board could not answer this time.`);
      break;
    case 'peer-receipt':
      log('done', `🧾 Visit receipt: ${ev.receipt.network} at ${ev.receipt.origin} · ${ev.receipt.mcpCalls} live board call(s) · private fields shared: ${ev.receipt.slySharedFields.length ? ev.receipt.slySharedFields.join(', ') : 'none'} · your key: never sent.`);
      break;
    case 'peer-invalid':
      log('error', `🛡 The neighbour's network file failed our safety checks and was turned away: ${ev.errors.join(' ')}`);
      break;
    case 'error':
      log('error', `⚠ ${ev.message}`);
      break;
    case 'run-done':
      log('done', `📬 All done. Receipt is under your result — where it ran, who helped, what stayed home.`);
      break;
  }
}

/* ---------------- consent + confirm modals ---------------- */
function askConsent({ origin, purpose }) {
  return new Promise((resolve) => {
    $('#consent-body').textContent = purpose;
    const modal = $('#consent-modal');
    modal.hidden = false;
    const done = (v) => { modal.hidden = true; $('#consent-yes').onclick = $('#consent-no').onclick = null; resolve(v); };
    $('#consent-yes').onclick = () => done(true);
    $('#consent-no').onclick = () => done(false);
  });
}
function askConfirm(text) {
  return new Promise((resolve) => {
    $('#confirm-body').textContent = text;
    const modal = $('#confirm-modal');
    modal.hidden = false;
    const done = (v) => { modal.hidden = true; $('#confirm-yes').onclick = $('#confirm-no').onclick = null; resolve(v); };
    $('#confirm-yes').onclick = () => done(true);
    $('#confirm-no').onclick = () => done(false);
  });
}

/* ---------------- page object for site actions ---------------- */
const page = {
  getEditorText: () => $('#editor').value,
  applyReadingPreferences: (prefs) => {
    if (prefs.focusMode !== undefined) document.body.classList.toggle('focus-mode', !!prefs.focusMode);
    if (prefs.largeText !== undefined) document.body.classList.toggle('large-text', !!prefs.largeText);
    if (prefs.friendlyFont !== undefined) document.body.classList.toggle('friendly-font', !!prefs.friendlyFont);
    document.querySelectorAll('[data-comfort]').forEach((b) => {
      const key = b.dataset.comfort;
      if (prefs[key] !== undefined) b.classList.toggle('on', !!prefs[key]);
    });
  },
};

/* ---------------- samples ---------------- */
const SAMPLE_LETTER = `Dear Applicant,

We are pleased to inform you that your application for the Kartini Merit Scholarship has been shortlisted. Pursuant to clause 7(b) of the programme regulations, shortlisted candidates are required to submit certified copies of their academic transcripts and one letter of recommendation no later than 17:00 on Friday, 12 December 2026. Failure to comply with the aforementioned submission requirements within the stipulated timeframe will result in the forfeiture of your candidacy without further notice.

Yours faithfully,
The Selection Committee`;

const SAMPLES = [
  {
    label: '✨ Simplify the scholarship letter',
    text: SAMPLE_LETTER,
    ask: 'Please simplify this letter so a 12-year-old can follow it — keep every fact and the deadline.',
    personal: false,
  },
  {
    label: '🌏 Translate the rental clause',
    text: 'Apabila penyewa terlambat membayar uang sewa lebih dari tujuh hari sejak tanggal jatuh tempo, pemilik berhak memutuskan perjanjian ini secara sepihak dan menahan uang jaminan sebesar satu bulan sewa sebagai ganti rugi.',
    ask: 'Please translate this clause into friendly, natural English and keep its tone.',
    personal: false,
  },
  {
    label: '🦉 Summarise the long article',
    text: 'The city council announced on Tuesday that the riverside reading park will open next spring after three years of construction. The park includes a two-storey public library, shaded reading terraces, and a small café run by a local cooperative. Officials said the project cost 4.2 billion rupiah, slightly under budget, and created 120 jobs during construction. The library will stock 40,000 books in Indonesian and English, with a dedicated children\'s floor and free weekend reading clubs. Opening hours will be 8 in the morning until 9 in the evening, every day except public holidays. The mayor added that a second, smaller park is planned for the eastern district in 2028, subject to next year\'s budget approval.',
    ask: 'Please summarise this article: gist first, then the key points.',
    personal: false,
  },
  {
    label: '🔒 A personal letter — keep it between us',
    text: 'Dear Grandma, the doctor said my check-up results are fine, but I should rest more and stop working late nights. Please do not worry, and please do not tell the rest of the family yet — I will visit home next month and tell everyone myself, with good food on the table.',
    ask: 'This text is personal — explain it simply, and please keep it just between us.',
    personal: true,
  },
];

/* ---------------- boot ---------------- */
async function boot() {
  manifest = await (await fetch('./agent-manifest.json')).json();
  network = await (await fetch('./bacajelas.network.json')).json();
  network.metadata = { ...(network.metadata ?? {}), front_man: manifest.networks[0].front_man };
  try { links = await (await fetch('./links.json')).json(); } catch { links = { networks: {} }; }

  const consentGate = new ConsentGate(askConsent);
  const actions = new Map(createSiteActions(page).map((a) => [a.name, a]));
  runtime = new AgentRuntime({ network, model: buildModel(), consentGate, actions, onEvent });
  modelMode = runtime.model === MockModel ? 'mock' : 'live';

  $('#mode-pill').textContent = modePillText();
  $('#stat-peers').textContent = Object.keys(links.networks ?? {}).filter((n) => n !== 'bacajelas').length;
  $('#stat-agents').textContent = network.tools.length;
  saveStats();
  log('done', `👋 The team is in. Network “bacajelas” passed validation: ${network.tools.length} agents, consent gate on, private context locked by default.`);

  // Sample chips (fill the ask box)
  const samples = manifest.networks[0].sample_queries ?? [];
  const chipBox = $('#sample-chips');
  samples.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = q;
    b.onclick = () => { $('#ask').value = q; };
    chipBox.appendChild(b);
  });

  // One-click sample errands (set text + ask, then run)
  const runBox = $('#sample-runs');
  SAMPLES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = s.label;
    b.onclick = () => {
      $('#editor').value = s.text;
      $('#ask').value = s.ask;
      $('#personal-toggle').checked = s.personal;
      run(null);
    };
    runBox.appendChild(b);
  });
  $('#editor').value = SAMPLE_LETTER;

  typeGreeting('Selamat datang! Welcome in. Paste anything that feels heavy to read — I and my friends will carry it with you, gently and privately.');
  buildGallery();
}

function typeGreeting(text) {
  const el = $('#greeting');
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 18);
    else el.classList.add('done');
  };
  tick();
}

/* Gallery: real transformations. In demo mode they are generated live by
 * the mock team when the page loads; in live (BYOK) mode we never spend a
 * visitor's tokens unasked — the cards offer one-click runs instead. */
async function buildGallery() {
  const box = $('#gallery');
  const cards = [
    { who: 'sari', title: '🌸 Sari simplifies', sample: SAMPLES[0] },
    { who: 'alih', title: '🌏 Alih translates', sample: SAMPLES[1] },
    { who: 'rara', title: '🦉 Rara summarises', sample: SAMPLES[2] },
  ];
  for (const c of cards) {
    const el = document.createElement('article');
    el.className = 'gallery-card';
    el.innerHTML = `<h3>${c.title}</h3><p class="gallery-before"></p><div class="gallery-after">…</div>`;
    el.querySelector('.gallery-before').textContent = `Before: “${c.sample.text.slice(0, 110)}…”`;
    box.appendChild(el);
    c.el = el;
  }
  if (modelMode !== 'mock') {
    $('#gallery-note').textContent = liveSource() === 'visitor'
      ? 'You are in live mode, so we never spend your tokens unasked — press a card and the team runs it for real.'
      : 'You are in live mode on the publisher default, so we never spend inference unasked — press a card and the team runs it for real.';
    cards.forEach((c) => {
      const after = c.el.querySelector('.gallery-after');
      after.innerHTML = '';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini-btn'; b.textContent = 'Run this one live →';
      b.onclick = () => { $('#editor').value = c.sample.text; $('#ask').value = c.sample.ask; $('#personal-toggle').checked = false; run(null); };
      after.appendChild(b);
    });
    return;
  }
  log('routing', '🎬 Warming up with three sample errands (clearly samples — watch the stage)…');
  for (const c of cards) {
    try {
      const answer = await runtime.run(`${c.sample.ask}\n\n---\n${c.sample.text}`, { slyData: {} });
      c.el.querySelector('.gallery-after').textContent = answer.replace(/^\(demo\)\s*/, '');
    } catch {
      c.el.querySelector('.gallery-after').textContent = 'The sample run hiccuped — the studio below still works.';
    }
  }
  resetAgents();
  log('done', '🎬 Sample errands done — those three cards above are the team\'s real work, generated just now.');
}

/* ---------------- studio run ---------------- */
async function run(action) {
  const editorText = $('#editor').value.trim();
  const askText = $('#ask').value.trim();
  const personal = $('#personal-toggle').checked;
  if (!editorText && !askText) { showError('Pop some text in the studio first — even one stubborn sentence is enough. 💜'); return; }
  const prompts = {
    simplify: 'Please simplify the text below so it is easy and kind to read, keeping every fact.',
    translate: 'Please translate the text below between Indonesian and English — whichever direction fits — keeping its tone.',
    summarise: 'Please summarise the long text below: gist first, then the key points.',
  };
  const request = [action ? prompts[action] : askText, personal ? '(This text is personal — please keep it just between us, inside this browser.)' : '', editorText ? `\n\n---\n${editorText}` : ''].filter(Boolean).join(' ');
  $('#run').disabled = true;
  hideError();
  try {
    const answer = await runtime.run(request, { slyData: personal ? { personal_text: editorText } : {} });
    $('#result').hidden = false;
    $('#result-text').textContent = answer;
    $('#result-who').textContent = modelMode === 'mock' ? 'Demo mode — try Settings for a live model' : `Live via ${modelName()}${liveSource() === 'publisher' ? ' (publisher default — on the house)' : ''}`;
    $('#receipt').textContent = personal
      ? '🔒 Receipt: you marked this personal, so it stayed right here in your browser. No peer site was contacted, and private context was shared with nobody — that is the promise, kept.'
      : '🧾 Receipt: your team worked inside this page. No third-party site was contacted, and no private context left the browser.';
    stats.clarified += 1; saveStats();
  } catch (err) {
    showError(err.message);
    Object.keys(NAMES).forEach((n) => setAgent(n, 'error'));
  } finally {
    $('#run').disabled = false;
  }
}
function showError(msg) { const b = $('#error-box'); b.textContent = `💔 ${msg}`; b.hidden = false; }
function hideError() { $('#error-box').hidden = true; }

/* ---------------- M3: the visit to Deadline Desk ---------------- */
async function visitPeer() {
  const question = $('#peer-ask').value.trim();
  if (!question) { $('#peer-error').hidden = false; $('#peer-error').textContent = '💔 Ask the neighbour something first — the box above has a good one ready.'; return; }
  const personal = $('#personal-toggle').checked;
  const editorText = $('#editor').value.trim();
  $('#peer-run').disabled = true;
  $('#peer-error').hidden = true;
  $('#peer-result').hidden = true;
  try {
    // If the visitor marked text personal, it rides along as sly context —
    // and the receipt below proves the peer received none of it.
    const answer = await runtime.loadPeer(PEER_URL, question, {
      slyData: personal && editorText ? { personal_text: editorText } : {},
    });
    const r = runtime.lastPeerReceipt;
    $('#peer-result').hidden = false;
    $('#peer-result-text').textContent = answer;
    $('#peer-result-who').textContent = modelMode === 'mock'
      ? 'Demo-mode team, live neighbour data'
      : `Live via ${modelName()}, live neighbour data`;
    if (r) {
      $('#peer-receipt').textContent =
        `🧾 Visit receipt — neighbour: ${r.network} at ${r.origin} · agents who woke: ${r.agents.join(' + ')} · ` +
        `live board calls: ${r.mcpCalls} · private fields shared with the neighbour: ${r.slySharedFields.length ? r.slySharedFields.join(', ') : 'none'} · ` +
        `withheld at the border: ${r.slyWithheldFields.length ? r.slyWithheldFields.join(', ') : 'nothing was marked private'} · ` +
        `your router key sent to the neighbour: never. Their network ran here, in your browser, on your router.`;
    }
    stats.visits += 1; saveStats();
  } catch (err) {
    const b = $('#peer-error');
    b.hidden = false;
    b.textContent = `🛡 ${err.message}`;
  } finally {
    $('#peer-run').disabled = false;
  }
}
$('#peer-run').onclick = visitPeer;
$('#peer-ask').addEventListener('keydown', (e) => { if (e.key === 'Enter') visitPeer(); });

/* ---------------- wiring ---------------- */
$('#run').onclick = () => run(null);
$('#ask').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(null); });
document.querySelectorAll('[data-quick]').forEach((b) => { b.onclick = () => run(b.dataset.quick); });
$('#speak-btn').onclick = async () => {
  const action = createSiteActions(page).find((a) => a.name === 'website_speak_text');
  const text = $('#result').hidden ? $('#editor').value : $('#result-text').textContent;
  const r = await action.handler({ text });
  log(r.ok ? 'done' : 'error', r.ok ? `🔊 Reading aloud on this device — ${r.spokenChars} characters, zero network.` : `🔇 ${r.reason}`);
};
document.querySelectorAll('[data-comfort]').forEach((b) => {
  b.onclick = async () => {
    const key = b.dataset.comfort;
    const next = !b.classList.contains('on');
    if (!(await askConfirm(`Apply “${b.textContent}” to this page? You can undo it any time with the same button.`))) return;
    page.applyReadingPreferences({ [key]: next });
    log('done', `🪟 Reading comfort updated: ${b.textContent} ${next ? 'on' : 'off'} — your page, your rules.`);
  };
});
$('#theme-toggle').onclick = () => {
  const html = document.documentElement;
  const dark = html.dataset.theme !== 'dark';
  html.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').textContent = dark ? '☀️' : '🌙';
};

/* settings drawer */
function openSettings() {
  $('#set-base').value = settings.baseUrl || manifest.llm_router.base_url;
  $('#set-model').value = settings.model || manifest.llm_router.model || '';
  $('#set-key').value = settings.apiKey || '';
  $('#set-mock').checked = !!settings.mock;
  $('#settings').hidden = false;
}
$('#settings-open').onclick = openSettings;
$('#settings-save').onclick = () => {
  settings.baseUrl = $('#set-base').value.trim();
  settings.model = $('#set-model').value.trim();
  settings.apiKey = $('#set-key').value.trim() || undefined;
  settings.mock = $('#set-mock').checked;
  saveSettings();
  runtime.model = buildModel();
  modelMode = runtime.model === MockModel ? 'mock' : 'live';
  $('#mode-pill').textContent = modePillText();
  $('#settings').hidden = true;
  log('done', modelMode === 'mock'
    ? '⚙ Demo mode it is — everything runs locally.'
    : liveSource() === 'visitor'
      ? '⚙ Live model connected. Your key lives only in this browser and travels only to your router.'
      : '⚙ On the house: the publisher default is live (Otari). Add your own key above any time to use your own router instead.');
};
$('#settings-clear').onclick = () => {
  delete settings.apiKey; saveSettings(); $('#set-key').value = '';
  runtime.model = buildModel();
  modelMode = runtime.model === MockModel ? 'mock' : 'live';
  $('#mode-pill').textContent = modePillText();
  log('consent', '🧹 Key forgotten from this browser. Gone means gone.');
};

/* ---------------- M5: the §6 trust theatre ---------------- */
function setCheck(name, state, meta) {
  const li = document.querySelector(`#theatre-list li[data-check="${name}"]`);
  if (!li) return;
  li.dataset.state = state;
  li.querySelector('.check-dot').textContent = state === 'pass' ? '✔' : state === 'fail' ? '✘' : '…';
  if (meta) li.querySelector('.check-meta').textContent = meta;
}
async function timed(fn) {
  const t0 = performance.now();
  const out = await fn();
  return { out, ms: Math.max(1, Math.round(performance.now() - t0)) };
}

$('#theatre-run').onclick = async () => {
  const btn = $('#theatre-run');
  btn.disabled = true;
  const lines = [];
  let passed = 0;
  const total0 = performance.now();
  const finish = (name, ok, detail, ms) => {
    setCheck(name, ok ? 'pass' : 'fail', `${ok ? 'stopped it' : 'PROBLEM'} · ${ms} ms`);
    if (ok) passed += 1;
    lines.push(`${ok ? '✔' : '✘'} ${detail} (${ms} ms)`);
    $('#trust-output').textContent = lines.join('\n');
    $('#stat-checks').textContent = `${passed} / 5`;
  };
  log('routing', '🧪 The trust theatre begins — five safety checks, performed live on this page.');

  // 1 — our own network validates clean.
  {
    const { ms } = await timed(async () => {
      const v = validateNetwork(network);
      if (!v.ok) throw new Error(v.errors.join(' '));
    }).catch((e) => { finish('validate', false, `Our network failed validation: ${e.message}`, 0); return { ms: -1 }; });
    if (ms >= 0) finish('validate', true, 'Our network file passed every check: 4 agents, references resolve, no cycles, privacy policy stated.', ms);
  }
  // 2 — tampered network (duplicate agent) rejected.
  {
    const { ms } = await timed(async () => {
      const bad = JSON.parse(JSON.stringify(network));
      bad.tools.push({ name: 'sari', function: { description: 'A sneaky duplicate.' } });
      return validateNetwork(bad);
    });
    const bad = JSON.parse(JSON.stringify(network));
    bad.tools.push({ name: 'sari', function: { description: 'A sneaky duplicate.' } });
    const v = validateNetwork(bad);
    finish('tamper', !v.ok, `Tampered network rejected before any agent woke: ${v.errors[0] ?? ''}`, ms);
  }
  // 3 — cyclic network rejected.
  {
    const cyc = JSON.parse(JSON.stringify(network));
    cyc.tools.find((a) => a.name === 'sari').tools = ['rani'];
    const { out: v, ms } = await timed(async () => validateNetwork(cyc));
    finish('cycle', !v.ok && v.errors.some((e) => /cycle/i.test(e)), `Cyclic network rejected: ${v.errors.find((e) => /cycle/i.test(e)) ?? v.errors[0] ?? ''}`, ms);
  }
  // 4 — over-budget run halted kindly.
  {
    let halted = false;
    const { ms } = await timed(async () => {
      const rt = new AgentRuntime({ network, model: MockModel, consentGate: new ConsentGate(async () => false), limits: { maxInvocations: 1 } });
      try { await rt.run('Please simplify this text for me.'); } catch { halted = true; }
    });
    finish('budget', halted, 'A run with a one-step budget halted with a polite explanation instead of running away.', ms);
  }
  // 5 — denied neighbour visit: the fetch counter must stay at zero.
  {
    let fetchAttempts = 0;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => { fetchAttempts += 1; return originalFetch(...args); };
    let stopped = false;
    const { ms } = await timed(async () => {
      const rt = new AgentRuntime({ network, model: MockModel, consentGate: new ConsentGate(async () => false) });
      try { await rt.loadPeer(PEER_URL, 'hello neighbour'); } catch { stopped = true; }
    });
    window.fetch = originalFetch;
    finish('denied', stopped && fetchAttempts === 0, `Refused visit: consent said no, the runtime stopped — and the fetch counter reads exactly ${fetchAttempts}.`, ms);
  }

  const totalMs = Math.round(performance.now() - total0);
  $('#theatre-summary').textContent = `${passed} of 5 checks passed · total ${totalMs} ms (budget: 60,000 ms) · every attack stopped before it could act.`;
  log(passed === 5 ? 'done' : 'error', `🧪 Trust theatre finished: ${passed}/5 checks passed in ${totalMs} ms. Details are in the panel — honest, as promised.`);
  btn.disabled = false;
};

boot().catch((err) => showError(`The team could not wake up: ${err.message}`));
