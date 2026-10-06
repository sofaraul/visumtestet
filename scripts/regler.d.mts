import type { Regel, Config } from '../src/types'

export function laRegler(): Regel[]
export function laConfig(): Config
export function laFragor(): { fragor: { id: string; hjalptext: string | null }[] }
export function problemMedRegler(regler: Regel[], idag?: string): { id: string; orsaker: string[] }[]
export function platshallareIConfig(config: unknown, sokvag?: string): string[]
export function epostAktiv(config: Config, env?: Record<string, string | undefined>): boolean
export function saknadKonfiguration(config: Config, env?: Record<string, string | undefined>): string[]
export function nodvandigKonfiguration(config: Config, env?: Record<string, string | undefined>): string[]
export function saknadeHjalptexter(fragor: { fragor: { id: string; hjalptext: string | null }[] }): string[]
