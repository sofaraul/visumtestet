type Barn = Node | string | null | undefined | false

/** Minimal hjälpare för att bygga DOM. Text sätts alltid som text, aldrig som HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tagg: K,
  attr: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...barn: Barn[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagg)
  for (const [namn, varde] of Object.entries(attr)) {
    if (typeof varde === 'function') el.addEventListener(namn.replace(/^on/, ''), varde)
    else if (typeof varde === 'boolean') varde && el.setAttribute(namn, '')
    else el.setAttribute(namn, varde)
  }
  for (const b of barn) if (b) el.append(b)
  return el
}
