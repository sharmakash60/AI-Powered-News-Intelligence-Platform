const BASE = '/api'

/**
 * Fetch ALL articles by looping through every page.
 * The backend paginates at up to 500/page, but we loop
 * to collect everything stored in the DB.
 */
export async function fetchArticles() {
  const PAGE_SIZE = 500
  let page = 1
  let allArticles = []

  while (true) {
    const res = await fetch(
      `${BASE}/articles?page=${page}&page_size=${PAGE_SIZE}`
    )
    if (!res.ok) throw new Error(`Articles fetch failed: ${res.status}`)

    const data = await res.json()
    const batch = data.articles || []
    allArticles = allArticles.concat(batch)

    // Stop when we've collected all pages
    if (page >= data.total_pages || batch.length === 0) break
    page++
  }

  return { articles: allArticles }
}

export async function fetchStats() {
  const res = await fetch(`${BASE}/stats`)
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchCategories() {
  const res = await fetch(`${BASE}/categories`)
  if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`)
  return res.json()
}

export async function runPipeline() {
  const res = await fetch(`${BASE}/pipeline/run`, { method: 'POST' })
  if (!res.ok) throw new Error(`Pipeline trigger failed: ${res.status}`)
  return res.json()
}

export async function getPipelineStatus() {
  const res = await fetch(`${BASE}/pipeline/status`)
  if (!res.ok) throw new Error(`Pipeline status fetch failed: ${res.status}`)
  return res.json()
}