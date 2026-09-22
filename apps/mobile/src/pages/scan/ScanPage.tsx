import type { Asset } from '@cmms/types'
import { Button, Chip, Input } from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Section } from '../../components/Section'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { parseAssetCode } from '../../lib/qr'
import { usePersistentState } from '../../lib/storage'
import { useMobileScope } from '../../state/scope'
import { QrScanner } from './QrScanner'

const RECENT_KEY = 'cmms.mobile.recent'
const MAX_RECENT = 8
const MAX_NEARBY = 10

export function ScanPage() {
  const { assets, areaAssets, myRequests, isTechnician, site, maps } = useMobileScope()
  const navigate = useNavigate()
  const [recent, setRecent] = usePersistentState<string[]>(RECENT_KEY, [])
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const byCode = useMemo(() => new Map(assets.map((a) => [a.code.toUpperCase(), a])), [assets])

  const open = (raw: string) => {
    const parsed = parseAssetCode(raw)
    const asset = parsed ? byCode.get(parsed) : undefined
    if (!asset) {
      setError(parsed ? `No asset with code ${parsed} at ${site.name}.` : 'Type the code printed under the QR tag.')
      return
    }
    setError('')
    setRecent((prev) => [asset.code, ...prev.filter((c) => c !== asset.code)].slice(0, MAX_RECENT))
    navigate(paths.asset(asset.code))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    open(code)
  }

  // Technicians get the machines their team maintains; requesters the machines they reported on.
  const nearby = useMemo(() => {
    if (isTechnician) return areaAssets.filter((a) => !a.parentId).slice(0, MAX_NEARBY)
    return [...new Set(myRequests.map((r) => r.assetId))]
      .map((id) => maps.asset.get(id))
      .filter((a) => !!a)
      .slice(0, MAX_NEARBY)
  }, [isTechnician, areaAssets, myRequests, maps])
  const recentAssets = recent.map((c) => byCode.get(c.toUpperCase())).filter((a) => !!a)

  return (
    <div className="space-y-6">
      <ScreenHeader greeting={`Asset tags · ${site.name}`} title="Scan" />
      <QrScanner onDetect={open} />

      <form onSubmit={submit} className="space-y-2" noValidate>
        <label htmlFor="asset-code" className="block text-sm font-medium">
          Or type the code on the tag
        </label>
        <div className="flex gap-2">
          <Input
            id="asset-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError('')
            }}
            placeholder="POL-03"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            invalid={!!error}
            aria-describedby={error ? 'asset-code-error' : undefined}
            inputClassName="h-12 font-mono uppercase"
          />
          <Button type="submit" size="lg" disabled={!code.trim()}>
            Open
          </Button>
        </div>
        {error && (
          <p id="asset-code-error" role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </form>

      {recentAssets.length > 0 && (
        <Section title="Recent scans">
          <AssetChips assets={recentAssets} onPick={(a) => open(a.code)} />
        </Section>
      )}
      {nearby.length > 0 && (
        <Section title={isTechnician ? 'In your area' : 'Machines you reported on'}>
          <AssetChips assets={nearby} onPick={(a) => open(a.code)} />
        </Section>
      )}
    </div>
  )
}

function AssetChips({ assets, onPick }: { assets: Asset[]; onPick: (asset: Asset) => void }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {assets.map((a) => (
        <Chip key={a.id} className="h-11" onClick={() => onPick(a)}>
          <span className="font-mono">{a.code}</span>
          <span className="font-medium text-muted">{a.name}</span>
        </Chip>
      ))}
    </div>
  )
}
