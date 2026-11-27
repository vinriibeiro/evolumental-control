import { createLowlight } from 'lowlight'
import type { HLJSApi, Language } from 'highlight.js'
import sql from 'highlight.js/lib/languages/sql'
import pgsql from 'highlight.js/lib/languages/pgsql'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import powershell from 'highlight.js/lib/languages/powershell'
import plaintext from 'highlight.js/lib/languages/plaintext'

export interface CodeLanguageDef {
  id: string
  label: string
  runnable: 'python' | 'sql' | null
  sqliteNotice?: boolean
}

export const CODE_LANGUAGES: CodeLanguageDef[] = [
  { id: 'sql', label: 'SQL', runnable: 'sql', sqliteNotice: true },
  { id: 'postgresql', label: 'PostgreSQL', runnable: 'sql', sqliteNotice: true },
  { id: 'tsql', label: 'T-SQL', runnable: 'sql', sqliteNotice: true },
  { id: 'python', label: 'Python', runnable: 'python' },
  { id: 'r', label: 'R', runnable: null },
  { id: 'dax', label: 'DAX', runnable: null },
  { id: 'powerquery', label: 'Power Query M', runnable: null },
  { id: 'javascript', label: 'JavaScript', runnable: null },
  { id: 'typescript', label: 'TypeScript', runnable: null },
  { id: 'html', label: 'HTML', runnable: null },
  { id: 'css', label: 'CSS', runnable: null },
  { id: 'json', label: 'JSON', runnable: null },
  { id: 'yaml', label: 'YAML', runnable: null },
  { id: 'bash', label: 'Bash', runnable: null },
  { id: 'powershell', label: 'PowerShell', runnable: null },
  { id: 'plaintext', label: 'Texto simples', runnable: null },
]

/** Gramática leve e determinística para DAX (Power BI / Analysis Services). */
function daxLanguage(hljs: HLJSApi): Language {
  return {
    name: 'DAX',
    case_insensitive: true,
    keywords: {
      keyword: 'VAR RETURN DEFINE MEASURE EVALUATE ORDER BY ASC DESC START AT IN NOT AND OR TRUE FALSE BLANK',
      built_in:
        'CALCULATE CALCULATETABLE FILTER ALL ALLEXCEPT ALLSELECTED VALUES DISTINCT SUM SUMX AVERAGE AVERAGEX COUNT COUNTROWS DISTINCTCOUNT MIN MAX DIVIDE IF SWITCH RELATED RELATEDTABLE USERELATIONSHIP TREATAS SUMMARIZE SUMMARIZECOLUMNS ADDCOLUMNS SELECTCOLUMNS DATESYTD SAMEPERIODLASTYEAR DATEADD TOTALYTD RANKX TOPN COALESCE ISBLANK HASONEVALUE SELECTEDVALUE',
    },
    contains: [
      hljs.COMMENT('--', '$'),
      hljs.COMMENT('//', '$'),
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      { className: 'variable', begin: /'[^']+'\[[^\]]+\]|\[[^\]]+\]/ },
      hljs.C_NUMBER_MODE,
    ],
  }
}

/** Gramática leve e determinística para Power Query M. */
function powerQueryLanguage(hljs: HLJSApi): Language {
  return {
    name: 'Power Query M',
    keywords: {
      keyword: 'let in each if then else try otherwise error type meta section shared as is and or not true false null',
      built_in:
        'Table.SelectRows Table.AddColumn Table.TransformColumnTypes Table.Group Table.NestedJoin Table.ExpandTableColumn Table.Combine Table.RenameColumns Table.RemoveColumns List.Sum List.Average List.Distinct List.Transform Text.Trim Text.Upper Text.Lower Date.Year Date.Month Number.From Value.ReplaceType',
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      { className: 'variable', begin: /#"[^"]+"/ },
      hljs.C_NUMBER_MODE,
    ],
  }
}

let cachedLowlight: ReturnType<typeof createLowlight> | null = null

export function getNotebookLowlight() {
  if (cachedLowlight) return cachedLowlight
  const lowlight = createLowlight()
  lowlight.register('sql', sql)
  lowlight.register('postgresql', pgsql)
  lowlight.register('tsql', sql)
  lowlight.register('python', python)
  lowlight.register('r', r)
  lowlight.register('dax', daxLanguage)
  lowlight.register('powerquery', powerQueryLanguage)
  lowlight.register('javascript', javascript)
  lowlight.register('typescript', typescript)
  lowlight.register('html', xml)
  lowlight.register('css', css)
  lowlight.register('json', json)
  lowlight.register('yaml', yaml)
  lowlight.register('bash', bash)
  lowlight.register('powershell', powershell)
  lowlight.register('plaintext', plaintext)
  cachedLowlight = lowlight
  return lowlight
}

export function getLanguageDef(id: string | null | undefined): CodeLanguageDef {
  const key = (id ?? 'plaintext').toLowerCase()
  return CODE_LANGUAGES.find((l) => l.id === key) ?? CODE_LANGUAGES[CODE_LANGUAGES.length - 1]
}
