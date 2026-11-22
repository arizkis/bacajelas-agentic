# bacajelas-validate

A tiny, dependency-free conformance checker for **Open Agentic Web** sites
(MVP Profile 0.3 observable behaviours) — the same validation core that
BacaJelas's browser runtime runs before it lets any agent network, its own
or a neighbour's, wake up.

## Run it

```bash
# Check a live site
node validator/validate.mjs https://bacajelas-agentic.web.app/

# Check a local folder of artifacts
node validator/validate.mjs ./site
```

No install, no dependencies — any modern Node.js.

## What it checks

- `agent-manifest.json` is published and names `name` / `front_man` / `hocon`
- the network definition parses and validates: agents named and unique,
  every tool reference resolves, no delegation cycles, an explicit
  `sly_data` private-context policy
- `sly_data.allow_to_peer` empty = private context is deny-by-default
  across site boundaries (reported as a strength, not a requirement)
- `links.json`, when present, is well-formed
- for live sites: the artifacts are reachable **and CORS-open**, so other
  sites' browsers can actually fetch them

Exit code `0` = conformant, `1` = problems found. Warnings never fail.

Built for the Open Agentic Web Challenge as shared community tooling —
if it helps your site pass Stage One, it did its job. Apache-2.0.
