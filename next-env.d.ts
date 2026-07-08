/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly TMAP_API_KEY: string
    readonly NEXT_PUBLIC_TMAP_API_KEY: string
  }
}
