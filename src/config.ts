/**
 * Build-time configuration.
 *
 * VITE_STATIC_HOST=true builds for a plain static host with no SPA rewrite
 * rule: routing moves into the URL fragment so no deep link can 404, and
 * links to the prototype become relative so they survive being served from a
 * sub-path. The default build targets Vercel, where `vercel.json` rewrites
 * unknown paths to index.html and real paths are the better URLs.
 */
export const STATIC_HOST = import.meta.env.VITE_STATIC_HOST === "true";

/** Where the prototype is served, correct for either hosting mode. */
export const PROTOTYPE_URL = STATIC_HOST ? "prototype/index.html" : "/prototype/index.html";
