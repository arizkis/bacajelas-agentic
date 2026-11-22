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

## Stage 2 — live composition, hosting, community — DONE 2026-11-22

**Live URLs:** main site **https://bacajelas-agentic.web.app** · caller porch
**https://bacajelas-caller.web.app** · repo **https://github.com/arizkis/bacajelas-agentic**
(PUBLIC, Apache-2.0) · community PR **https://github.com/cognizant-ai-labs/agentic-web/pull/68**.

### M2 (Otari default router) — PARKED, owner's key does not authenticate
Retested once under the owner's re-authorization ("aman udah", 2026-11-22): keyed call to
`https://api.otari.ai/api/v1/chat/completions` → **HTTP 401 `{"detail":"Invalid API key"}`**
(same as the first probe). Per instructions: parked, no retries, no workarounds. The key
stays in `.otari-key.txt` (mode 600, `.gitignore`d — verified absent from the repo tree and
from the staged commit). Default path remains **BYOK + clearly-labelled mock**, and the
manifest's `llm_router.note` now says exactly that, honestly. If the owner later supplies a
working key, M2 is a small wiring job (RouterClient already supports it).

### What shipped
- **loadPeer wiring completed** (`site/runtime/runtime.js`): accepts a network-definition
  URL, a network name, or {manifestUrl, networkName}; consent precedes ALL fetches;
  peers validate under the **peer profile** (a missing sly_data policy — Deadline Desk has
  none — warns and applies caller-side deny-all instead of rejecting); `resolveReplacements`
  resolves peers' `{placeholder}` instructions; a **peer receipt** is recorded/emitted
  (origin, network, agents, MCP calls, sly fields shared vs withheld, key-never-sent).
- **Tests 15/15 green** — new `tests/peer.test.mjs` (6 tests) serves a Deadline-Desk-shaped
  peer + stub MCP endpoint and proves the full chain: consent → load → warning → MCP tool
  really called **with no Authorization header** → live-shaped board answer → receipt with
  `slySharedFields: []`, `slyWithheldFields: [personal_text]`. Also verified against the
  REAL peer from Node: validation ok (1 warning), MCP tools listed, `find_open_calls`
  returned 9 live hackathon calls.
- **M3 — the visit**: "Neighbours we can visit" panel on the main page. One click → consent
  card → Rani loads `deadline_desk` and its agents answer with **live board data**; the
  receipt renders under the answer. `links.json` binds deadline_desk; manifest
  `allowed_peers` + `linking.imports` name the origin.
- **M4 — the porch**: `caller/` is a separate origin whose page fetches OUR manifest +
  network cross-origin (consent first), validates them with the same runtime, and runs
  Alih on a sample sentence — with its own porch receipt. Composition is now proven in
  both directions.
- **M5 — trust theatre**: five checks performed live on-page with per-check timing and a
  summary line (validate ours · tampered rejected · cycle rejected · over-budget halted ·
  refused visit with a fetch counter that must read exactly 0).
- **Liveliness (§7)**: editor pre-loaded with a sample scholarship letter; four one-click
  sample errands that run end-to-end; a gallery of three transformations generated by the
  team at page load in demo mode (in BYOK mode the cards offer one-click runs instead of
  spending the visitor's tokens); a stats strip (agents · neighbours · texts clarified on
  this device · theatre score); ledger narrates MCP calls, peer warnings and receipts.
- **M1 — hosting**: Firebase project `bacajelas` (Spark, nothing paid), sites
  `bacajelas-agentic` + `bacajelas-caller`; CORS `*` on manifest/network/links (and the
  well-known file) via firebase.json headers — note Firebase ignores `_headers` files;
  the file is kept for other static hosts. Deployed runtime is byte-identical to the
  tested local runtime on both origins.
- **M6 — Atlas check**: Agent Atlas `/api/check` on the live site → **verdict
  "conformant", score 100, 20 pass / 0 warn / 0 fail, trustLevel "clean", linkable: true**
  (checker profile: MVP 0.2). Its one INFO — optional `.well-known/nsdeploy.json` missing —
  was fixed the same hour (file live, 200, CORS open, mirroring our linking exports/imports);
  Atlas's cached result still shows the pre-fix 404, which is their cache, not the site.
  Atlas on the caller origin reports "no manifest" — correct by design: the porch is a
  caller demo, not a network publisher.
- **M7 — shared tooling + PR**: `validator/validate.mjs` (dependency-free; passes on our
  local files and on the live site), public repo above, and PR #68 to
  cognizant-ai-labs/agentic-web adding BacaJelas to `docs/agentic_websites.md`
  (file updated via the GitHub API on a fork branch — the upstream repo was never cloned
  or executed locally, per the standing tooling-deviation policy).

### Still owed (later stages)
M8 video + Devpost submission package (owner narrates, <2 min) · full spec 0.2↔0.3 line
diff in the final week · backlog tiers B–E from WIN-PLAN §6 (second peer = Citation Mirror
spot check is the highest-value next item) · M2 if a working Otari key ever arrives.
