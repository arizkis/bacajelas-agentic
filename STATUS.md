# BacaJelas, agentified — Open Agentic Web Challenge — STATUS

**Competition:** Open Agentic Web Challenge (Devpost, Cognizant / MIT NANDA / Mozilla).
Submissions close **Mon 11 Jan 2027, 23:00 WIB**. Pool $10,000 cash (5/3/2K) + Otari credits.
**Dissection:** `~/workspace/saved/2026-11-22-open-agentic-web/DISSECTION.md` — verdict GO.
**Owner orders:** 2026-11-22 "Gass, daftar + mulai bangun"; design: "bisa dibuat lebih modern yaa";
"vibe AI-nya berasa banget tapi tetap ramah" (see DESIGN.md — governing design rule).
**ESCALATION 2026-11-22 12:49 WIB: "kenapa gak ngejar top 1 sekalian" — the target is #1
($5,000), not top-3.** Every must-have is benchmarked against the field's BEST per criterion,
not a top-3 average: **Tech = ScopeGate-level depth** (sandboxed runtime, full §6 surface,
measured interop) · **Potential Impact = Atlas-level community infrastructure** (a checker/
tool the field itself uses, listed + badged) · **Idea = Citation Mirror-level sharpness** (a
composition trick that only works *because* sites can call each other) · **Design = best
vertical product feel** (Plainly/Citation Mirror product polish, but alive per §7). Backlog
items that close a gap to the single best entry in a criterion are IN SCOPE for stage 2–3,
in WIN-PLAN §6 tier order.

## Stage 1 — skeleton + conformance — DONE 2026-11-22

### ⚠ Tooling deviation (read this first)
The official repo clone failed an execution-risk check in this environment. Per policy its
content was **read as text only** — the `agentify-website` SKILL.md and the MVP spec 0.3 were
read in full, but **nothing was run, built, or copied** (no vendored nsDeploy runtime, no
build_network.mjs). Instead, `site/runtime/runtime.js` is an **original implementation** of the
spec's observable behaviours (spec §1 explicitly allows this: conformance = same public
artifacts + observable behaviours). If the parent/owner wants the official runtime vendored
instead, that requires an explicit go-ahead to process the cloned repo's code.

### What exists on disk (`~/workspace/hackathons/open-agentic-web/`)
- `site/index.html` + `styles.css` + `app.js` — the product page (see Design below).
- `site/agent-manifest.json` — network `bacajelas`, front_man `rani`, hocon →
  `./bacajelas.network.json`, Otari `llm_router` metadata, `peer_policy.mode: "ask"`,
  `allowed_peers: []`, theme, actions module pointer.
- `site/bacajelas.network.json` — resolved, data-only Neuro SAN network (Profile 0.3):
  **Rani** (front host) → **Sari** (simplifier), **Alih** (translator ID↔EN), **Rara**
  (summariser); every agent has a JSON-Schema `function.parameters`; `sly_data.allow_to_peer: []`
  (deny-by-default), `internal_allow: [reading_level, ui_language]`; sample queries; model hint
  `alibaba/qwen3.8-flash`.
- `site/links.json` — `{version: 1, networks: {bacajelas: {}}}` (peer bindings land in stage 2).
- `site/runtime/runtime.js` — original runtime: validator (malformed/dupes/dangling refs/
  ghost front agent/cycles/missing sly policy → reject), bounded engine (depth 4, 24
  invocations, 4 remote calls, 120 s), ConsentGate (per-origin, session, asked BEFORE fetch),
  sly_data filter, OpenAI-compatible RouterClient (key only to the chosen router), MockModel
  (deterministic offline specialists), peer loader (§3.2 protocol: exact-name match, validate
  before run, peer inherits OUR router, no sly crosses).
- `site/site-actions.js` — 4 registered local site actions: `website_get_editor_text` (read),
  `website_detect_language` (read, local heuristic), `website_set_reading_preferences` (write —
  confirmation dialog first), `website_speak_text` (read, on-device speech).
- `site/_headers` — CORS `*` on the three public artifacts for static hosting.
- `tests/runtime.test.mjs` — Node suite, **9/9 green** (`node --test "tests/*.test.mjs"`).
- `DESIGN.md`, `docs/spec-diff-0.2-0.3.md` (build to live 0.3; full 0.2↔0.3 diff still owed
  before submission — noted honestly in that file).

### §6 interop checklist — stage-1 results
| Check | Result |
|---|---|
| Publish multi-agent network + manifest on ordinary hosting | ✅ Artifacts written; served locally all HTTP 200; CORS headers file ready. Public hosting = stage 2. |
| Load + run in browser with default router; BYOK path if offered | 🟡 Engine + RouterClient + BYOK settings UI built; mock mode runs the full flow offline today. Live Otari run pending an Otari key (owner step, below). |
| Call an internal agent + a grounded capability (site action) | ✅ Node test: Rani→Sari delegation with routing events; `website_detect_language` + `website_get_editor_text` answer for real. |
| After approval, load an exact named network from a second origin | 🟡 Machinery built + consent-denial path tested (fetch never called when denied). Live cross-origin run = stage 2 (needs a real peer + hosting). |
| Peer never receives the visitor's key; cannot change the router | ✅ By construction: key is attached only inside RouterClient calls to the chosen router; peer manifests' router metadata is never read by `loadPeer`. |
| Private context absent at peer unless explicitly allowed | ✅ Tested: `filterSlyData(secret, allow_to_peer=[])` → `{}`; internal allow-list passes only named fields. |
| Stop invalid network / cycle / over-budget / denied origin with visible errors | ✅ All four covered by tests (tamper, cycle, ghost front, budget, consent-denied) and surfaced in the on-page Trust demos + ledger. |

Two real bugs were caught and fixed by the tests during the build (budget check off-by-one;
cycle detection erased by duplicate-name overwrite in the validator graph).

### Design direction taken (owner: modern + "AI vibe kuat tapi tetap ramah")
Full rationale in `DESIGN.md`. In the build: warm cream/plum palette with violet→coral AI
gradient, aurora background washes, glassy sticky header, dark mode done properly; an Agent
Stage where Rani/Sari/Alih/Rara are named characters whose cards glow and lift as they think,
work and finish; a live activity ledger narrating routing, consent and receipts in friendly
words; Rani's typed bilingual greeting; privacy written as care ("Just between us", receipts
that say what stayed home) instead of legalese; errors that are kind and honest ("Stopped
kindly…", "You said no — so nobody went. Promise kept."). Reading features ported from the
HybridAI BacaJelas: 3-level simplification (in Sari's schema), focus mode / bigger text /
friendly font comfort toggles, ID↔EN (Alih), read-aloud action, personal-text boundary.

### Owner-only steps logged
1. **Devpost registration** for the Open Agentic Web Challenge — not done by the agent
   (hackathon registration is his account action; the earlier "daftar" order is noted, the
   click itself is his / a browser-task step for the parent).
2. **Otari account/key**: registrant credit info arrives on registration. Once he has it, the
   key goes into the site's Settings (BYOK-style, stays in his browser) or a publisher default
   can be configured — until then the site demos fully in mock mode. **Nothing was paid for;
   no signup was attempted by the agent.**
3. **Demo video (<2 min, he narrates himself, not AI-generated)** — stage 4, his step.

### Not started (by design — later stages)
Live cross-origin peer call demo · open-source validator + PR to `docs/agentic_websites.md` ·
public hosting (Firebase) + repo publication · Devpost submission package · demo video.
Also owed: full spec 0.2↔0.3 line diff in the final week (see docs/spec-diff-0.2-0.3.md).

### How to run locally
`cd site && python3 -m http.server 8080` → http://localhost:8080 (mock mode works offline;
add a key in ⚙ AI model settings for live inference). Tests: `node --test "tests/*.test.mjs"`.
