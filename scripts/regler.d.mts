import type { Regel, Config } from '../src/types'

export function laRegler(): Regel[]
export function laConfig(): Config
export function laFragor(): { fragor: { id: string; hjalptext: string | null }[] }
export function problemMedRegler(regler: Regel[], idag?: string): { id: string; orsaker: string[] }[]
export function saknadKonfiguration(config: Config): string[]
export function saknadeHjalptexter(fragor: { fragor: { id: string; hjalptext: string | null }[] }): string[]
