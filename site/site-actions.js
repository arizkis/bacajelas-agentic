/**
 * BacaJelas registered local site actions (spec §2.1 / §3.1).
 * Each action: name, purpose, JSON Schema, effect class, handler.
 * Read actions run freely; the write action requires the runtime's
 * user-confirmation dialog before it runs (the runtime owns confirmation).
 * Handlers only touch THIS page's own state — nothing leaves the browser.
 */

export function createSiteActions(page) {
  return [
    {
      name: 'website_get_editor_text',
      purpose: 'Read the text currently in the visitor\'s reading editor, so an agent can work on exactly what the visitor sees.',
      effect: 'read',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async () => ({ ok: true, text: page.getEditorText() }),
    },
    {
      name: 'website_detect_language',
      purpose: 'Guess whether a text is Indonesian or English, locally, with a word-list heuristic. No network call.',
      effect: 'read',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'The text to check.' } },
        required: ['text'],
      },
      handler: async ({ text }) => {
        const idWords = ['yang', 'dan', 'di', 'ini', 'itu', 'dengan', 'untuk', 'tidak', 'saya', 'adalah', 'dari', 'ke'];
        const enWords = ['the', 'and', 'of', 'this', 'that', 'with', 'for', 'not', 'you', 'are', 'from', 'to'];
        const words = String(text).toLowerCase().split(/[^a-z]+/);
        const id = words.filter((w) => idWords.includes(w)).length;
        const en = words.filter((w) => enWords.includes(w)).length;
        return { ok: true, language: id === en ? 'unknown' : id > en ? 'id' : 'en', idSignals: id, enSignals: en };
      },
    },
    {
      name: 'website_set_reading_preferences',
      purpose: 'Apply reading comfort preferences to the page (focus mode, larger text, dyslexia-friendly font). Reversible at any time.',
      effect: 'write',
      parameters: {
        type: 'object',
        properties: {
          focusMode: { type: 'boolean' },
          largeText: { type: 'boolean' },
          friendlyFont: { type: 'boolean' },
        },
        required: [],
      },
      handler: async (args) => {
        page.applyReadingPreferences(args);
        return { ok: true, applied: args };
      },
    },
    {
      name: 'website_speak_text',
      purpose: 'Read a text aloud with the browser\'s built-in speech voice. Runs entirely on the visitor\'s device.',
      effect: 'read',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'The text to speak.' } },
        required: ['text'],
      },
      handler: async ({ text }) => {
        if (!('speechSynthesis' in window)) return { ok: false, reason: 'This browser has no speech voice — nothing was spoken.' };
        const utter = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
        window.speechSynthesis.speak(utter);
        return { ok: true, spokenChars: Math.min(String(text).length, 1200) };
      },
    },
  ];
}
