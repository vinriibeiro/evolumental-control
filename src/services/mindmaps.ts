import type { DataBackend } from '@/lib/data/types'
import type { MindMap, MindMapData } from '@/types/db'

export function initialMapData(title: string): MindMapData {
  return {
    nodes: [{ id: 'root', type: 'mind', position: { x: 0, y: 0 }, data: { label: title, color: '#3B2B20', size: 'lg', shape: 'pill' } }],
    edges: [],
  }
}

export async function createMindMap(
  backend: DataBackend,
  input: { title: string; subject_id?: string | null; topic_id?: string | null; folder?: string | null; description?: string | null },
): Promise<MindMap> {
  const title = input.title.trim().slice(0, 200) || 'Novo mapa'
  const [row] = await backend.insert('mind_maps', [
    {
      title,
      subject_id: input.subject_id ?? null,
      topic_id: input.topic_id ?? null,
      folder: input.folder ?? null,
      description: input.description ?? null,
      data: initialMapData(title),
    },
  ])
  return row
}

export async function duplicateMindMap(backend: DataBackend, map: MindMap): Promise<MindMap> {
  const [row] = await backend.insert('mind_maps', [
    {
      title: `${map.title} (cópia)`.slice(0, 200),
      description: map.description,
      folder: map.folder,
      subject_id: map.subject_id,
      topic_id: map.topic_id,
      data: JSON.parse(JSON.stringify(map.data)),
    },
  ])
  return row
}
