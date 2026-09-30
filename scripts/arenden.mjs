// Skapar GitHub-ärenden med etiketten källkontroll. Hoppar över ärenden som redan är öppna.
export const ETIKETT = 'källkontroll'

export async function skapaArenden(arenden, { token, repo, fetchFn = fetch }) {
  const api = async (metod, sokvag, kropp) => {
    const svar = await fetchFn(`https://api.github.com/repos/${repo}${sokvag}`, {
      method: metod,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
      body: kropp ? JSON.stringify(kropp) : undefined,
    })
    return { status: svar.status, data: svar.status === 204 ? null : await svar.json().catch(() => null) }
  }

  // 422 betyder att etiketten redan finns.
  await api('POST', '/labels', { name: ETIKETT, color: 'd93f0b', description: 'Automatisk källkontroll av regler' })

  const oppna = await api('GET', `/issues?state=open&labels=${encodeURIComponent(ETIKETT)}&per_page=100`)
  if (oppna.status !== 200) throw new Error(`kunde inte läsa öppna ärenden (${oppna.status})`)
  const befintliga = new Map(oppna.data.map((i) => [i.title, i.html_url]))

  const resultat = {}
  for (const a of arenden) {
    if (befintliga.has(a.titel)) {
      resultat[a.titel] = `${befintliga.get(a.titel)} (fanns redan)`
      continue
    }
    const nytt = await api('POST', '/issues', { title: a.titel, body: a.text, labels: [ETIKETT] })
    if (nytt.status !== 201) throw new Error(`kunde inte skapa ärendet "${a.titel}" (${nytt.status})`)
    resultat[a.titel] = nytt.data.html_url
  }
  return resultat
}
