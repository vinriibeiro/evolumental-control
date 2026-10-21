/** Links de pesquisa na internet para um tópico (abrem em nova aba). */
export function searchLinks(term: string, context?: string) {
  const q = encodeURIComponent(`${term}${context ? ` ${context}` : ''}`)
  return [
    { label: 'Google', url: `https://www.google.com/search?q=${q}` },
    { label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Questões', url: `https://www.google.com/search?q=${encodeURIComponent(`${term} questões de concurso`)}` },
  ]
}
