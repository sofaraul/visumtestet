/**
 * Belopp i kronor som motsvarar ett belopp i baht, avrundat uppåt till närmaste `avrundning`.
 * Uppåt, så att "minst X kr" aldrig är lägre än kravet i baht. Saknas kurs returneras null.
 */
export function beraknaKr(baht: number, bahtPerKrona: number | null, avrundning: number | null): number | null {
  if (!bahtPerKrona || !baht) return null
  const steg = avrundning || 1
  // Det lilla avdraget hindrar att flyttalsfel gör att ett exakt belopp hamnar ett steg högre.
  return Math.ceil((baht / bahtPerKrona / steg) * (1 - Number.EPSILON)) * steg
}
