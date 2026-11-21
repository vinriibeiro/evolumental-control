// Entrada rápida de tarefa: só o título já basta. Se o texto trouxer um horário no começo ("19h", "19:30")
// ou uma duração no fim ("45min", "1h", "1h30"), eles são aproveitados — sem obrigar ninguém a abrir um formulário.
export interface QuickTask {
  title: string
  start_time: string | null
  duration_minutes: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function parseQuickTask(input: string): QuickTask {
  let text = input.trim().replace(/\s+/g, ' ')
  let start_time: string | null = null
  let duration_minutes: number | null = null

  // horário no começo: "19h", "19h30", "19:30", "7:05"
  const time = /^(\d{1,2})(?::(\d{2})|h(\d{2})?)(?=\s|$)/i.exec(text)
  if (time) {
    const h = Number(time[1])
    const m = Number(time[2] ?? time[3] ?? 0)
    const rest = text.slice(time[0].length).trim()
    // só vale como horário se sobrar um título depois dele
    if (h <= 23 && m <= 59 && rest) {
      start_time = `${pad(h)}:${pad(m)}`
      text = rest
    }
  }

  // duração no fim: "45min", "45 min", "1h", "1h30", "2 h"
  const dur = /(?:^|\s)(?:(\d{1,2})\s?h(?:\s?(\d{1,2}))?|(\d{1,3})\s?min)$/i.exec(text)
  if (dur) {
    const minutes = dur[3] != null ? Number(dur[3]) : Number(dur[1]) * 60 + Number(dur[2] ?? 0)
    const rest = text.slice(0, dur.index).trim()
    // só vale como duração se sobrar um título (senão "1h" é o próprio título)
    if (minutes >= 1 && minutes <= 1440 && rest) {
      duration_minutes = minutes
      text = rest
    }
  }

  return { title: text.slice(0, 300), start_time, duration_minutes }
}
