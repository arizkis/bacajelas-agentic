/* The Neighbour's Porch — a second-origin caller for BacaJelas.
 * Fetches BacaJelas's public manifest + network cross-origin (consent
 * first), validates the network with the same runtime BacaJelas ships,
 * then runs its front agent locally with the demo model. This is the
 * inbound half of composition: BacaJelas, being called. */
import { AgentRuntime, ConsentGate, MockModel, validateNetwork, resolveReplacements } from './runtime/runtime.js';

const $ = (s) => document.querySelector(s);
const HOST = 'https://bacajelas-agentic.web.app';
const NETWORK_NAME = 'bacajelas';

function stamp() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function log(kind, html) {
  const li = document.createElement('li');
  li.className = `ev-${kind}`;
  li.innerHTML = `<time>${stamp()}</time>${html}`;
  const list = $('#ledger');
  list.prepend(li);
  while (list.children.length > 60) list.lastChild.remove();
}

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

function onEvent(ev) {
  switch (ev.type) {
    case 'run-start': log('routing', `💌 <b>Rani</b> (visiting from BacaJelas) received the errand…`); break;
    case 'routing': log('routing', `🧭 <b>Rani</b> asked <b>${ev.to}</b> to help — the delegation happens here, on the porch.`); break;
    case 'agent-done': if (ev.agent !== 'rani') log('done', `✨ <b>${ev.agent}</b> finished and handed the answer back to Rani.`); break;
    case 'run-done': log('done', `📬 Errand complete — without this page ever holding a key.`); break;
    case 'error': log('error', `⚠ ${ev.message}`); break;
  }
}

log('done', '👋 The porch is open. Press the button and this page will knock on BacaJelas\'s door — politely, and only with your say-so.');

$('#call').onclick = async () => {
  const sentence = $('#sentence').value.trim();
  const errBox = $('#error-box');
  errBox.hidden = true;
  $('#result').hidden = true;
  if (!sentence) { errBox.hidden = false; errBox.textContent = '💔 Give Alih a sentence to carry across first.'; return; }
  $('#call').disabled = true;
  try {
    // Consent BEFORE any contact with the other origin (§3.2).
    const gate = new ConsentGate(askConsent);
    log('consent', `🤝 Asking your permission before contacting ${HOST} — nothing has been sent.`);
    const ok = await gate.ensure(HOST, `Download BacaJelas's public agent network from ${HOST} and run it here, on the porch.`);
    if (!ok) { log('consent', '🛑 You said no — so nobody went. The porch respects a closed door.'); return; }

    log('routing', `📥 Fetching their public manifest…`);
    const manifestRes = await fetch(`${HOST}/agent-manifest.json`);
    if (!manifestRes.ok) throw new Error(`Manifest fetch failed (HTTP ${manifestRes.status}).`);
    const manifest = await manifestRes.json();
    const entry = (manifest.networks ?? []).find((n) => n.name === NETWORK_NAME);
    if (!entry) throw new Error(`BacaJelas does not publish a network named "${NETWORK_NAME}" — stopped rather than guessing.`);
    log('done', `📥 Manifest found their network “${entry.name}” (front agent: ${entry.front_man}). Fetching the network file itself…`);

    const defRes = await fetch(new URL(entry.hocon, `${HOST}/`).toString());
    if (!defRes.ok) throw new Error(`Network fetch failed (HTTP ${defRes.status}).`);
    const net = resolveReplacements(await defRes.json());
    net.metadata = { ...(net.metadata ?? {}), front_man: entry.front_man };

    const v = validateNetwork(net, { profile: 'peer' });
    if (!v.ok) throw new Error(`Their network failed our safety checks and was turned away: ${v.errors.join(' ')}`);
    log('done', `🛡 Their network passed our safety checks: ${v.agents.join(' + ')}. It runs here now, under this page's rules and budgets.`);

    const rt = new AgentRuntime({ network: net, model: MockModel, consentGate: gate, onEvent, validationProfile: 'peer' });
    const answer = await rt.run(`Please translate this into friendly, natural English, keeping its tone:\n\n${sentence}`, { slyData: {} });

    $('#result').hidden = false;
    $('#result-text').textContent = answer;
    $('#receipt').textContent =
      `🧾 Porch receipt — visited: ${NETWORK_NAME} at ${HOST} · files downloaded: 2 (manifest + network, both public) · ` +
      `agents who worked: ${v.agents.join(' + ')} · where they ran: here, on bacajelas-caller.web.app, in your browser · ` +
      `API key held by this page: none — there is nothing here to send · private context shared: none.`;
  } catch (err) {
    errBox.hidden = false;
    errBox.textContent = `💔 ${err.message}`;
    log('error', `⚠ ${err.message}`);
  } finally {
    $('#call').disabled = false;
  }
};
