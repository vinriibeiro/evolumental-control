import type { CharacterLook, ItemDef, Speaker } from '../engine/types'

/** Aparências do personagem do jogador (escolhidas na criação). */
export const PLAYER_LOOKS: Array<{ id: string; label: string; look: CharacterLook }> = [
  { id: 'trilha', label: 'Trilheira', look: { skin: '#e2b48c', hair: '#3b2b20', outfit: '#2a78d6', accent: '#deb887' } },
  { id: 'aurora', label: 'Aurora', look: { skin: '#8d5a3b', hair: '#1c1410', outfit: '#1baf7a', accent: '#f5deb3' } },
  { id: 'brasa', label: 'Brasa', look: { skin: '#f1cfa8', hair: '#b4483c', outfit: '#6250d6', accent: '#eda100' } },
  { id: 'nevoa', label: 'Névoa', look: { skin: '#c68e62', hair: '#d9d4cc', outfit: '#3b2b20', accent: '#e87ba4' } },
]

export const SPEAKERS: Speaker[] = [
  { id: 'iara', name: 'Mestra Iara', role: 'Líder da Guilda dos Estudos', look: { skin: '#a86f4c', hair: '#e8e2d6', outfit: '#6b4b8a', accent: '#deb887' } },
  { id: 'tomo', name: 'Tomo', role: 'Guardião das Revisões', look: { skin: '#e9c49c', hair: '#4f6d8a', outfit: '#4f7a55', accent: '#f5deb3' } },
  { id: 'dora', name: 'Dora', role: 'Bilheteira da Rodoviária', look: { skin: '#b97a52', hair: '#6b3b25', outfit: '#2f5f8a', accent: '#eda100' } },
  { id: 'morador', name: 'Morador', role: 'Minha Cidade', look: { skin: '#d9a77a', hair: '#4a3728', outfit: '#4f7a55', accent: '#f5deb3' } },
  { id: 'lina', name: 'Arquiteta Lina', role: 'Prefeitura · terrenos e obras', look: { skin: '#f0c9a0', hair: '#26201c', outfit: '#d95926', accent: '#f5deb3' } },
  { id: 'maya', name: 'Maya Kort', role: 'Analista de dados', look: { skin: '#c99068', hair: '#18120e', outfit: '#1d3a5f', accent: '#38d0ff' } },
  { id: 'bras', name: 'Brás Teles', role: 'Chefe de segurança', look: { skin: '#7a4d33', hair: '#2b2b2b', outfit: '#3b3f46', accent: '#eda100' } },
  { id: 'ze', name: 'Zé Pixel', role: 'Manutenção do subsolo', look: { skin: '#e5b38a', hair: '#8a5a2b', outfit: '#d95926', accent: '#f5deb3' } },
  { id: 'root', name: 'ROOT', role: 'Administrador corrompido', look: { skin: '#2a1030', hair: '#ff3d6e', outfit: '#120814', accent: '#ff3d6e' } },
  { id: 'sentinel', name: 'Sentinela S-7', role: 'Segurança automatizada', look: { skin: '#59606b', hair: '#ff3d3d', outfit: '#2c3138', accent: '#ff3d3d' } },
  { id: 'terminal', name: 'Terminal', role: 'Sistema', look: { skin: '#0f2a1f', hair: '#38ff9c', outfit: '#0b1d16', accent: '#38ff9c' } },
]

export const ITEMS: ItemDef[] = [
  { id: 'mapa_mundo', name: 'Mapa do Mundo', icon: '🗺️', description: 'Mostra as cidades do Mundo Evolumental e as passagens que você já tem. Abra com M.' },
  { id: 'vale_bilhete', name: 'Vale da Guilda', icon: '🎟️', description: 'Vale uma passagem grátis na Rodoviária, para a cidade que você escolher.' },
  { id: 'escritura', name: 'Escritura do terreno', icon: '📜', description: 'Seu terreno na linha "Minha Cidade". Cada lote recebe uma matéria do Control e cresce com as horas estudadas.' },
  {
    id: 'cracha_temporario',
    name: 'Crachá temporário',
    icon: '🪪',
    description: 'Emitido por Brás. Abre a sala de energia da Cidade dos Dados.',
  },
  {
    id: 'manual_painel',
    name: 'Manual do painel de energia',
    icon: '📘',
    description: 'Anotações do Zé sobre os disjuntores do núcleo.',
    read: [
      'MANUAL DO PAINEL — NÚCLEO (anotado à mão pelo Zé)',
      '',
      '1. O núcleo só acende com EXATAMENTE dois disjuntores ligados.',
      '2. Se A estiver ligado, C precisa estar desligado (sobrecarga!).',
      '3. B e D nunca podem ficar no mesmo estado.',
      '4. C liga o resfriamento. Sem resfriamento o núcleo derrete.',
      '5. D alimenta a porta do subsolo, que precisa ficar FECHADA durante o religamento.',
      '',
      '"Lê tudo antes de mexer. Aquele painel morde." — Zé',
    ].join('\n'),
  },
  { id: 'ficha_cafe', name: 'Ficha de café', icon: '☕', description: 'Vale um café no subsolo. Presente do Zé por resolver a aposta.' },
  { id: 'log_impresso', name: 'Log impresso', icon: '📄', description: 'Três alterações de madrugada, todas com a credencial de Renata Antunes — que está de férias.' },
  { id: 'nucleo_restaurado', name: 'Emblema da Cidade dos Dados', icon: '🏅', description: 'Concedido a quem restaurou o núcleo. Os habitantes reconhecem você.' },
]
