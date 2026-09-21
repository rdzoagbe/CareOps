/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build for a plain static host with no SPA rewrite rule. See src/config.ts. */
  readonly VITE_STATIC_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
