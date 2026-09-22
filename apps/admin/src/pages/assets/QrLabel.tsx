import type { Asset } from '@cmms/types'
import { Button } from '@cmms/ui'
import { Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useScoped } from '../../state/scoped'
import { SideCard } from './ui'

const qrValue = (code: string) => `cmms://asset/${code}`

// While printing, every direct child of <body> except the label is hidden. The class string has to
// stay literal so Tailwind generates it.
const PRINT_ONLY_LABEL = 'print:[&>*:not([data-print-label])]:hidden'

/** Prints the asset label alone: mounts it, hides the rest of the page for print, cleans up after. */
export function useLabelPrinter() {
  const [printing, setPrinting] = useState(false)
  const print = useCallback(() => {
    flushSync(() => setPrinting(true))
    document.body.classList.add(PRINT_ONLY_LABEL)
    window.addEventListener(
      'afterprint',
      () => {
        document.body.classList.remove(PRINT_ONLY_LABEL)
        setPrinting(false)
      },
      { once: true },
    )
    window.print()
  }, [])
  return { printing, print }
}

/** The label as it comes out of the printer. Mounted on <body> only while printing. */
export function PrintableLabel({ asset }: { asset: Asset }) {
  const { site, locationPath } = useScoped()
  return createPortal(
    <div data-print-label="" className="hidden justify-center bg-white p-8 text-ink print:flex">
      <div className="flex w-[70mm] flex-col items-center gap-2 rounded-2xl border-2 border-ink p-5 text-center">
        <QRCodeSVG value={qrValue(asset.code)} size={220} level="M" marginSize={0} />
        <p className="mt-2 font-mono text-2xl font-bold">{asset.code}</p>
        <p className="text-sm font-semibold">{asset.name}</p>
        <p className="text-xs">{locationPath(asset.locationId)}</p>
        <p className="text-[10px]">{site.name} · Scan to open the asset passport</p>
      </div>
    </div>,
    document.body,
  )
}

export function QrLabelCard({ asset, onPrint }: { asset: Asset; onPrint: () => void }) {
  return (
    <SideCard title="QR label">
      <div className="flex flex-col items-center rounded-2xl bg-surface-2 p-4 text-center">
        <div className="rounded-xl bg-white p-3 shadow-card">
          <QRCodeSVG
            value={qrValue(asset.code)}
            size={136}
            level="M"
            marginSize={0}
            title={`QR code for ${asset.code}`}
          />
        </div>
        <p className="mt-3 font-mono text-sm font-bold">{asset.code}</p>
        <p className="text-xs text-muted">{asset.name}</p>
      </div>
      <Button variant="outline" className="mt-3 w-full" onClick={onPrint}>
        <Printer />
        Print label
      </Button>
      <p className="mt-2 text-xs text-muted">
        A scan opens this passport with its open work, history, documents and parts list.
      </p>
    </SideCard>
  )
}
