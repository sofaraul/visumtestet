export interface Period {
  fran?: string | null
  till?: string | null
  varde: number | string | null
}
export function idagIso(nu?: Date): string
export function arDatumstyrd(regel: { varde: unknown }): boolean
export function gallandePeriod(regel: { varde: unknown }, idag?: string): Period | null
export function gallandeVarde(regel: { varde: unknown }, idag?: string): number | string | null
export function allaVarden(regel: { varde: unknown }): (number | string)[]
