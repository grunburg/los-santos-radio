/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIONS_URL?: string
  readonly VITE_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
