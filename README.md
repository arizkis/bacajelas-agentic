# BacaJelas, agentified 🌸

**Read clearly. Privately. Together with friendly agents.**

BacaJelas is an *open agentic website* built for the
[Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/)
(Cognizant · MIT NANDA · Mozilla). It takes the reading companion from the
Firebase Hybrid AI hackathon and gives it a second life on the agentic web:
a small team of named agents who live in the visitor's browser — and who can,
with the visitor's explicit permission, **visit a neighbour's agent network
and bring back live answers**.

**Live:** [bacajelas-agentic.web.app](https://bacajelas-agentic.web.app/) ·
**Watch a neighbour call us:** [bacajelas-caller.web.app](https://bacajelas-caller.web.app/)

## The team

| Agent | Job |
|---|---|
| **Rani** 👩🏽‍🏫 | Front agent and host — greets, understands the errand, delegates, and asks before any neighbour is contacted |
| **Sari** 🌸 | Simplifier — hard text into kind, plain language at three gentleness levels, facts intact |
| **Alih** 🌏 | Translator — Indonesian ↔ English, tone carried across |
| **Rara** 🦉 | Summariser — gist first, then the points that matter |

## What makes it an agentic website (MVP Profile 0.3)

- **Published network** — [`agent-manifest.json`](site/agent-manifest.json) +
  [`bacajelas.network.json`](site/bacajelas.network.json) + [`links.json`](site/links.json),
  CORS-open, plus `.well-known/nsdeploy.json` discovery.
- **Real composition, both directions** — Rani loads **Deadline Desk's**
  network in the visitor's browser (after a consent card) and its agents
  answer with *live board data* through their own MCP tools. In the other
  direction, [the Neighbour's Porch](caller/) — a separate origin — loads
  *our* network and runs Alih.
- **Privacy as architecture, not prose** — `sly_data.allow_to_peer` is empty:
  private context is deny-by-default across site boundaries, the visitor's
  router key is only ever sent to the visitor's router, and every crossing
  produces a written receipt saying what moved and what stayed home.
- **Safety performed, not asserted** — an on-page trust theatre runs five
  checks live (valid network · tampered network rejected · cyclic network
  rejected · over-budget run halted · refused visit = zero fetches), and the
  headless suite covers the same ground: `node --test "tests/*.test.mjs"` (15 tests).
- **Checked by the community's own checker** — Agent Atlas rates the live
  site **conformant, score 100, trust "clean", linkable**.

## Inference

Bring your own key: point Settings at any OpenAI-compatible router (Otari is
pre-filled as a suggestion; the key stays in your browser). With no key, the
site runs in a clearly-labelled demo mode with local mock specialists — every
flow still works, and the Deadline Desk visit still returns live data.

## The validator (shared tooling)

[`validator/validate.mjs`](validator/) is a dependency-free conformance
checker any agentic site can run against its own artifacts:

```bash
node validator/validate.mjs https://your-site.example/
```

## Layout

```
site/       the agentic website (static; Firebase Hosting)
caller/     "The Neighbour's Porch" — the second-origin caller demo
validator/  the standalone conformance checker
tests/      Node test suite for the runtime (§6 behaviours)
docs/       spec notes (Profile 0.2 ↔ 0.3)
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
