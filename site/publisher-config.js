/* Publisher default inference — spec §4 "Default inference".
 *
 * This committed file is a PLACEHOLDER: it contains no credential, and the
 * public repository never will. The publisher-funded Otari key lives only
 * in the gitignored `.otari-key.txt` at the project root.
 *
 * `scripts/deploy.mjs` copies the site into the gitignored `.deploy/`
 * staging folder and generates the DEPLOYED copy of this module there,
 * with the key filled in — so the live site can offer judges a working
 * default router with no key wall, while git history stays clean.
 *
 * Residual exposure, stated plainly: a static site cannot keep a secret
 * from its own visitors — anyone who views the deployed bundle's source
 * can find the key. It is a bounded, revocable registrant-credit key;
 * the owner can rotate or revoke it from the Otari dashboard at any
 * time. The safer spec §4 route — a publisher-controlled default-
 * inference endpoint holding the key server-side — needs a backend,
 * which this Spark-plan static deployment does not have; if one is ever
 * added, the key moves behind it and this file goes back to null.
 *
 * Shape when generated: { baseUrl, model, apiKey }.
 */
export const PUBLISHER_DEFAULT = null;
