// Ren logik utan Node-beroenden. Används både i webbläsaren (src/) och i skripten.

/** Dagens datum som ÅÅÅÅ-MM-DD enligt svensk tid. */
export function idagIso(nu = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(nu)
}

/** En datumstyrd regel har en lista med perioder i stället för ett enda värde. */
export const arDatumstyrd = (regel) => Array.isArray(regel.varde)

/**
 * Perioden som gäller ett visst datum, eller null. Perioder har valfria `fran` och `till`
 * (båda inklusive). En regel utan perioder har ingen period.
 */
export function gallandePeriod(regel, idag = idagIso()) {
  if (!arDatumstyrd(regel)) return null
  return regel.varde.find((p) => (!p.fran || p.fran <= idag) && (!p.till || idag <= p.till)) ?? null
}

/** Värdet som gäller ett visst datum. Gäller ingen period returneras null. */
export function gallandeVarde(regel, idag = idagIso()) {
  if (!arDatumstyrd(regel)) return regel.varde ?? null
  return gallandePeriod(regel, idag)?.varde ?? null
}

/** Alla värden en regel kan anta, oavsett datum. */
export const allaVarden = (regel) =>
  (arDatumstyrd(regel) ? regel.varde.map((p) => p.varde) : [regel.varde]).filter((v) => v !== null && v !== undefined)
