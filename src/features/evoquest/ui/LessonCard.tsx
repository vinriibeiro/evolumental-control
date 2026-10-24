import { useState } from 'react'
import { BookOpen, Play, Turtle, Volume2 } from 'lucide-react'
import { execPython, type PyStatus } from '@/game/lab/runPython'
import { runSql } from '@/game/lab/runSql'
import type { QueryResult } from '@/game/lab/sqlCore'
import { speakAll, speechAvailable } from '@/game/speech'
import { DATASETS } from '../content/datasets'
import type { LessonDef } from '../engine/pedagogy'

/**
 * Ficha de campo: o mínimo para quem nunca viu o conceito, com exemplo
 * executável — SQL sobre um banco de exemplo, Python (saída impressa) ou uma
 * fala em inglês que o navegador lê em voz alta. Compartilhada pelos
 * terminais SQL e Python e pelo rádio.
 */
export function LessonCard({ lesson, defaultOpen, showMistakes }: { lesson: LessonDef; defaultOpen: boolean; showMistakes: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [example, setExample] = useState<{ result?: QueryResult; stdout?: string; error?: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<PyStatus | null>(null)
  const ex = lesson.workedExample
  const isPython = ex?.lang === 'python'
  const isSpeech = ex?.lang === 'speech'

  const run = async () => {
    if (!ex) return
    setRunning(true)
    if (isPython) {
      const r = await execPython(ex.code, setStatus)
      setExample({ stdout: r.stdout, error: r.error })
    } else {
      setExample(await runSql(DATASETS[ex.dataset ?? ''] ?? '', ex.code, null))
    }
    setStatus(null)
    setRunning(false)
  }

  return (
    <section className="rounded-md border-2 border-[var(--eq-edge-dark)] bg-[#120e0b]" aria-label={lesson.title}>
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BookOpen className="size-4 text-[var(--eq-gold)]" aria-hidden />
        <span className="flex-1">{lesson.title}</span>
        <span className="text-xs font-normal text-[var(--eq-muted)]">{open ? 'recolher' : 'abrir'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--eq-edge-dark)] px-3 py-3 text-sm leading-relaxed">
          <p>
            <span className="font-semibold text-[var(--eq-gold)]">Objetivo: </span>
            {lesson.learningObjective}
          </p>
          <p className="text-[var(--eq-muted)]">{lesson.whyItMatters}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {lesson.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
          {ex && isSpeech && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--eq-muted)]">{ex.caption}</p>
              <p className="rounded bg-[#0c2230] p-2 text-sm text-[#d7f3ff]" lang="en">
                “{ex.code}”
              </p>
              {speechAvailable() ? (
                <div className="flex flex-wrap gap-2">
                  <button className="eq-btn" onClick={() => speakAll([ex.code], 'en-US', 1)}>
                    <Volume2 className="size-4" /> Ouvir o exemplo
                  </button>
                  <button className="eq-btn" onClick={() => speakAll([ex.code], 'en-US', 0.6)}>
                    <Turtle className="size-4" /> Devagar
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--eq-muted)]">Seu navegador não oferece leitura em voz alta; acompanhe pelo texto.</p>
              )}
            </div>
          )}
          {ex && !isSpeech && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--eq-muted)]">{ex.caption}</p>
              <pre className="overflow-x-auto rounded bg-[#07130e] p-2 font-mono text-xs text-[#b8ffd9]">{ex.code}</pre>
              <button className="eq-btn" disabled={running} onClick={() => void run()}>
                <Play className="size-4" /> {running ? (status === 'loading' ? 'Carregando o Python…' : 'Executando…') : 'Executar o exemplo'}
              </button>
              {example?.error && <p className="font-mono text-xs text-[var(--eq-bad)]">{example.error}</p>}
              {example?.result && <ResultTable result={example.result} />}
              {isPython && example?.stdout !== undefined && !example.error && (
                <pre className="overflow-x-auto rounded border-2 border-[#1f3d30] bg-[#07130e] p-2 font-mono text-xs text-[#d7ffe9]" aria-label="Saída do exemplo">
                  {example.stdout || '(sem saída)'}
                </pre>
              )}
            </div>
          )}
          {showMistakes && lesson.commonMistakes.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">Erros comuns</p>
              <ul className="list-disc space-y-0.5 pl-5 text-[var(--eq-muted)]">
                {lesson.commonMistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function ResultTable({ result }: { result: QueryResult }) {
  if (!result.rows.length) return <p className="font-mono text-sm text-[var(--eq-muted)]">(0 linhas)</p>
  return (
    <div className="max-h-64 overflow-auto rounded-md border-2 border-[#1f3d30]">
      <table className="w-full font-mono text-xs">
        <caption className="sr-only">Resultado da consulta</caption>
        <thead className="sticky top-0 bg-[#0d2a1d] text-left text-[var(--eq-good)]">
          <tr>
            {result.columns.map((c, i) => (
              <th key={i} scope="col" className="px-2 py-1.5 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className="border-t border-[#163024] odd:bg-[#081610]">
              {r.map((v, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap text-[#d7ffe9]">
                  {v == null ? <span className="text-[var(--eq-muted)]">NULL</span> : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#163024] px-2 py-1 text-[11px] text-[var(--eq-muted)]">{result.rows.length} linha(s)</p>
    </div>
  )
}
