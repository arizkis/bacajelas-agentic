# Spec version note — Profile 0.2 (rules-pinned) vs 0.3 (live)

- **Rules §4 pin** conformance to the spec as published at the start of the Submission Period
  (11 Nov 2026) — the 10 Nov revision, **MVP Profile 0.2** (repo commit `fd872b9`).
- **Live spec** (read in full 2026-11-22 from `docs/worldwide_agentic_web_mvp_spec.md` in
  cognizant-ai-labs/agentic-web): **MVP Profile 0.3, dated 18 November 2026** (commit `a0ceda3`).

## Decision (from DISSECTION.md §2.2, followed in this build)
Build to **0.3** — it is the current reference-runtime behaviour, and everything 0.3 requires
(manifest shape, resolved data-only network JSON, links.json, consent-before-contact,
sly_data deny-by-default, bounded execution, fail-closed) is a superset discipline of the
0.2-era requirements as recorded in the dissection. The published artifacts here use only
constructs present in the 0.3 text: `networks[]` with `name`/`front_man`/`hocon`,
`llm_router.base_url`, `peer_policy`/`allowed_peers`, Neuro SAN `tools[]` data model with
JSON-Schema `function.parameters`, `links.json` `{version, networks}`.

## Honest limitation
A line-by-line 0.2↔0.3 diff was NOT produced in stage 1: only the 0.3 text was read in full
(the dissection characterised 0.2 from the rules pin + commit metadata). **TODO before
submission (final week): fetch the `fd872b9` revision, diff it against the pinned 0.3 copy,
and confirm no 0.2 requirement is missed.** A copy of the 0.3 spec revision used should be
pinned into this folder at that time.

## Implementation constraint discovered in stage 1
The official repo clone in this environment failed an execution-risk check, so per policy its
code was **read as text only** — nothing from it was run, built, or copied. This project's
runtime (`site/runtime/runtime.js`) is an original implementation of the spec's observable
behaviours, written from the spec text. Functionally this is spec-legal (spec §1: an
implementation conforms when it produces and consumes the same public artifacts and observable
behaviours), but it differs from the field's common path of vendoring the nsDeploy runtime —
worth one line in the Devpost write-up later ("runtime implemented from the spec").
