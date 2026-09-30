// Ren logik utan Node-beroenden. Används både i webbläsaren (src/) och i skripten.

/** Dagens datum som ÅÅÅÅ-MM-DD enligt svensk tid. */
export function idagIso(nu = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(nu)
}

/** En datumstyrd regel har en lista med perioder i stället för ett enda värde. */
export const arDatumstyrd = (regel) => Array.isArray(regel.varde)

/**
 * Värdet som gäller ett visst datum. Perioder har valfria `fran` och `till`
 * (båda inklusive). Gäller ingen period returneras null.
 */
export function gallandeVarde(regel, idag = idagIso()) {
  if (!arDatumstyrd(regel)) return regel.varde ?? null
  const period = regel.varde.find((p) => (!p.fran || p.fran <= idag) && (!p.till || idag <= p.till))
  return period ? period.varde : null
}

/** Alla värden en regel kan anta, oavsett datum. */
export const allaVarden = (regel) =>
  (arDatumstyrd(regel) ? regel.varde.map((p) => p.varde) : [regel.varde]).filter((v) => v !== null && v !== undefined)
