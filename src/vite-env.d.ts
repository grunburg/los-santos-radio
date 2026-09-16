/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIONS_URL?: string
  readonly VITE_DEBUG?: string
  readonly VITE_TIME_API_URL?: string
  readonly VITE_TIMEZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
