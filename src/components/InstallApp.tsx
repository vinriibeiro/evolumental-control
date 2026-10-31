import { useState } from 'react'
import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LogoMark } from '@/components/brand/Logo'
import { useInstallApp } from '@/hooks/useInstallApp'

/** Botão "Instalar aplicativo": usa o convite nativo do navegador ou mostra o passo a passo. */
export function InstallAppButton({ variant = 'secondary', size = 'md', className }: { variant?: 'primary' | 'secondary' | 'ghost' | 'dark'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const app = useInstallApp()
  const [help, setHelp] = useState(false)
  if (app.installed) return null
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        icon={<Download className="size-4" />}
        onClick={async () => {
          if (app.canPrompt) await app.install()
          else setHelp(true)
        }}
      >
        Instalar aplicativo
      </Button>
      <InstallHelp open={help} onClose={() => setHelp(false)} ios={app.ios} />
    </>
  )
}

function InstallHelp({ open, onClose, ios }: { open: boolean; onClose: () => void; ios: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Instalar o VLM Control no celular" size="sm" footer={<Button onClick={onClose}>Entendi</Button>}>
      <div className="space-y-4 text-sm text-ink">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <p className="text-muted">O app abre em tela cheia, com ícone na tela inicial, e usa a mesma conta do site.</p>
        </div>
        <div className={ios ? 'order-first' : ''}>
          <p className="mb-1 font-semibold">iPhone / iPad (Safari)</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>
              Toque em <Share className="inline size-4 text-ink" aria-label="Compartilhar" /> <strong className="text-ink">Compartilhar</strong>.
            </li>
            <li>
              Escolha <strong className="text-ink">Adicionar à Tela de Início</strong> e confirme.
            </li>
          </ol>
        </div>
        <div>
          <p className="mb-1 font-semibold">Android (Chrome, Edge, Samsung Internet)</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>
              Abra o menu <strong className="text-ink">⋮</strong> do navegador.
            </li>
            <li>
              Toque em <strong className="text-ink">Instalar app</strong> (ou <strong className="text-ink">Adicionar à tela inicial</strong>).
            </li>
          </ol>
        </div>
        <div>
          <p className="mb-1 font-semibold">Computador (Chrome ou Edge)</p>
          <p className="text-muted">Clique no ícone de instalar na barra de endereço ou no menu → “Instalar VLM Control”.</p>
        </div>
      </div>
    </Modal>
  )
}

/** Seção para Configurações. */
export function InstallAppSection() {
  const app = useInstallApp()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Smartphone className="size-8 shrink-0 text-accent-strong" />
      <p className="min-w-0 flex-1 basis-56 text-sm text-muted">
        {app.installed ? (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 className="size-4" /> Você está usando o aplicativo instalado.
          </span>
        ) : (
          'Instale o VLM Control no celular ou no computador direto pelo navegador — sem loja de aplicativos.'
        )}
      </p>
      <InstallAppButton variant="primary" />
    </div>
  )
}
