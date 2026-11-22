# BacaJelas (Agentic Web) — Design Direction

Owner direction, 2026-11-22:
1. "bisa dibuat lebih modern yaa" — current-generation web design, rich and polished, never sparse.
2. **"vibe AI-nya berasa banget tapi tetap ramah"** — the AI presence must be STRONGLY felt,
   while the experience stays friendly and warm. This is the governing rule for every UI/copy choice.

## What "AI vibe kuat" means here (visible, alive, unmistakably agent-powered)
- **The agents are characters, not features.** Four named agents with faces, roles and one-line
  personalities on an "Agent Stage" that is always on screen: Rani (front host), Sari (simplifier),
  Alih (translator), Rara (summariser).
- **Work is shown as it happens.** Agent cards change state live — Resting → Thinking… (gold glow,
  lifts up) → Working (violet glow) → Done ✓ (mint). Routing is announced in the activity ledger
  in plain words ("Rani asked Sari to help — passing only what's needed").
- **Thinking/routing moments are first-class UI**, never hidden spinners: the ledger narrates
  delegation, consent questions, receipts and errors in real time.
- **Rani greets and guides.** Animated avatar with a pulse ring, a typed greeting, sample-request
  chips, and warm hand-offs ("I'll bring the right friend").
- **AI-native touches:** gradient AI badge on results, mode pill that honestly states
  "Demo mode — mock specialists" vs "Live — <model>", trust-demo buttons that let visitors
  poke the safety rails themselves.

## What "tetap ramah" means here (warm, human, never cold/corporate/robotic)
- **Language:** friendly, encouraging, bilingual warmth (EN primary for judging, ID greetings and
  touches throughout; the product itself is ID↔EN). Agents speak like kind people: Sari —
  "the reader is smart, the text was just written badly."
- **Styling:** soft cream/paper light theme + deep-plum dark theme, rounded corners everywhere,
  gentle shadows, coral/violet gradient accents, Atkinson Hyperlegible type. No stark black,
  no terminal green, no robot imagery.
- **Privacy copy is caring, not legalistic.** Not "Your data is processed per policy §…" but:
  "🔒 Just between us — personal text stays in this browser." Receipts say what happened in
  human words: who helped, where it ran, what stayed home. Consent is a friendly visit request
  ("Rani would like to say hello to a neighbour") that names the destination and promises the
  key and personal text never go along.
- **Errors are kind and honest:** "Stopped kindly: …" / "You said no — so nobody went. Promise kept."
  Failures never pretend to be successes (spec §5), and never blame the visitor.

## Non-negotiables carried from BacaJelas (HybridAI build)
- Privacy-tiered reading: personal text is pinned to the browser; sly_data deny-by-default.
- Every result carries a receipt. Every state change is visible in the ledger.
- Rich, dense, complete product feel — the page must never look empty or like a bare chat box.
