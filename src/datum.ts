/** Datum på svenska, t.ex. "15 september 2026". Kan inte datumet tolkas returneras det som det är. */
export function formatDatum(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(d)
}
