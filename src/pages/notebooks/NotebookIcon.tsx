import {
  BarChart3,
  BookOpen,
  Brain,
  Code2,
  Compass,
  Database,
  FileText,
  FlaskConical,
  Folder,
  GraduationCap,
  Layers,
  Notebook as NotebookLucide,
  Scale,
  Shield,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  notebook: NotebookLucide,
  database: Database,
  'code-2': Code2,
  terminal: Terminal,
  layers: Layers,
  brain: Brain,
  'bar-chart-3': BarChart3,
  'file-text': FileText,
  folder: Folder,
  compass: Compass,
  'flask-conical': FlaskConical,
  scale: Scale,
  shield: Shield,
  'graduation-cap': GraduationCap,
}

export function NotebookIcon({ name, className = 'size-4' }: { name?: string | null; className?: string }) {
  const Icon = (name && ICON_MAP[name]) || BookOpen
  return <Icon className={className} aria-hidden />
}
