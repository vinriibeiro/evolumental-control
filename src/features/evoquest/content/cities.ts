// Cidades do Mundo Evolumental: uma por disciplina. Cada cidade tem uma linha
// de ônibus saindo da Rodoviária da Vila e um bilhete vendido no balcão.
// O preço vale no servidor (game_shop_items, kind = 'ticket'); a primeira
// passagem é o vale da Guilda e sai de graça.

export interface CityDef {
  /** Id da região (estável: aparece em salvamentos e no catálogo). */
  id: string
  name: string
  subtitle: string
  /** Disciplina do EvoQuest clássico. */
  subject: string
  blurb: string
  price: number
  /** Posição no mapa do mundo (%). */
  x: number
  y: number
  /** Cor dos telhados e do chão das cidades geradas. */
  theme: { roof: string; ground: string; path: string }
}

export const TICKET_PRICE = 80

export const CITIES: CityDef[] = [
  { id: 'data_city', name: 'Cidade dos Dados', subtitle: 'Distrito Relacional', subject: 'sql', blurb: 'SQL', price: TICKET_PRICE, x: 80, y: 50, theme: { roof: '#3a4352', ground: '#1d2430', path: '#252e3c' } },
  { id: 'lab_aurora', name: 'Aurora', subtitle: 'Cidade das Máquinas', subject: 'python', blurb: 'Python para Dados', price: TICKET_PRICE, x: 50, y: 86, theme: { roof: '#2f7f73', ground: '#7fa36a', path: '#b9b2a2' } },
  { id: 'language_tower', name: 'Babel', subtitle: 'Cidade dos Idiomas', subject: 'ingles', blurb: 'Inglês', price: TICKET_PRICE, x: 50, y: 13, theme: { roof: '#2a5aa8', ground: '#6aa457', path: '#d6c39a' } },
  { id: 'logic_temple', name: 'Silogia', subtitle: 'Cidade da Lógica', subject: 'logica', blurb: 'Raciocínio Lógico', price: TICKET_PRICE, x: 18, y: 50, theme: { roof: '#6250d6', ground: '#8aa070', path: '#c7b9a0' } },
  { id: 'observatory', name: 'Gaussópolis', subtitle: 'Cidade da Estatística', subject: 'estatistica', blurb: 'Estatística', price: TICKET_PRICE, x: 22, y: 18, theme: { roof: '#1f6f9a', ground: '#9bb27a', path: '#d9cfb5' } },
  { id: 'archive', name: 'Vernácula', subtitle: 'Cidade das Letras', subject: 'portugues', blurb: 'Português', price: TICKET_PRICE, x: 22, y: 82, theme: { roof: '#9b3d2f', ground: '#6fa055', path: '#d8b98a' } },
  { id: 'command_tower', name: 'Medida Certa', subtitle: 'Cidade dos Painéis', subject: 'dax', blurb: 'DAX', price: TICKET_PRICE, x: 78, y: 18, theme: { roof: '#c47f12', ground: '#86a865', path: '#cdbd9c' } },
  { id: 'refinery', name: 'Pipeline', subtitle: 'Cidade da Linguagem M', subject: 'm', blurb: 'Linguagem M', price: TICKET_PRICE, x: 78, y: 82, theme: { roof: '#7a4d33', ground: '#93a46b', path: '#c9b08a' } },
]

export const cityById = (id: string) => CITIES.find((c) => c.id === id)

/** Id do bilhete no catálogo do servidor. */
export const ticketId = (city: string) => `ticket_${city}`
export const cityOfTicket = (itemId: string) => (itemId.startsWith('ticket_') ? itemId.slice('ticket_'.length) : null)

/** Onde o ônibus deixa o jogador na Vila (plataforma da Rodoviária). */
export const STATION_SPOT = { region: 'hub', x: 15.5, y: 25.5 }
