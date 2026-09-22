import { emptyRequest, newId, nowIso } from '@cmms/fixtures'
import type { MaintenanceRequest, OperationalImpact, Severity } from '@cmms/types'
import { IMPACT_LABEL, SEVERITIES, SEVERITY_LABEL } from '@cmms/types'
import { Button, Card, Combobox, FormField, Input, PhotoInput, SegmentedControl, Textarea, toast } from '@cmms/ui'
import { Send } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AssetIcon } from '../../components/icons'
import { StickyBar } from '../../components/StickyBar'
import { SuccessCard } from '../../components/SuccessCard'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { useMobileScope } from '../../state/scope'

const IMPACTS: OperationalImpact[] = ['none', 'reduced', 'stopped']

export function NewRequestPage() {
  const { maps } = useMobileScope()
  const [sentId, setSentId] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const sent = sentId ? maps.request.get(sentId) : undefined

  if (sent) {
    const asset = maps.asset.get(sent.assetId)
    return (
      <div className="space-y-4">
        <DetailHeader title="Request sent" subtitle={asset ? `${asset.name} · ${asset.code}` : undefined} fallback={paths.requests} />
        <SuccessCard
          title={`${sent.code} is on its way`}
          actions={
            <>
              <Button asChild size="lg" className="w-full">
                <Link to={paths.requests} replace>
                  Back to requests
                </Link>
              </Button>
              <Button
                variant="onInk"
                size="lg"
                className="w-full"
                onClick={() => {
                  setSentId(null)
                  setRound((n) => n + 1)
                }}
              >
                Report another problem
              </Button>
            </>
          }
        >
          <p>A supervisor reviews it and decides whether it becomes a work order. You can follow every step under Requests.</p>
        </SuccessCard>
      </div>
    )
  }
  return <RequestForm key={round} onSent={setSentId} />
}

function RequestForm({ onSent }: { onSent: (id: string) => void }) {
  const { site, user, isTechnician, assets, dispatch } = useMobileScope()
  const [params] = useSearchParams()
  const presetCode = params.get('asset')?.toUpperCase()
  const [draft, setDraft] = useState<MaintenanceRequest>(() => ({
    ...emptyRequest(site.id, user.id, nowIso()),
    assetId: assets.find((a) => a.code.toUpperCase() === presetCode)?.id ?? '',
    source: isTechnician ? 'technician' : 'operator',
  }))
  const [photos, setPhotos] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<MaintenanceRequest>) => setDraft((d) => ({ ...d, ...patch }))
  const missingAsset = tried && !draft.assetId
  const missingTitle = tried && !draft.title.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!draft.assetId || !draft.title.trim()) {
      toast('Add the machine and what is wrong', { tone: 'danger' })
      return
    }
    const at = nowIso()
    dispatch({
      type: 'requests/create',
      item: {
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        reportedAt: at,
        attachments: photos.map((url, i) => ({ id: newId('att'), kind: 'photo', name: `Photo ${i + 1}.jpg`, url, at, by: user.id })),
      },
    })
    toast('Request sent', { tone: 'success', description: 'The supervisor sees it now.' })
    onSent(draft.id)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-28">
      <DetailHeader title="Report a problem" subtitle={site.name} fallback={paths.requests} />
      <Card className="space-y-5 p-5">
        <FormField label="Machine" required error={missingAsset ? 'Choose the machine, or scan its tag first.' : undefined}>
          <AssetPicker value={draft.assetId || null} invalid={missingAsset} onChange={(id) => set({ assetId: id ?? '' })} />
        </FormField>
        <FormField label="What is wrong?" required error={missingTitle ? 'Describe the problem in a few words.' : undefined}>
          <Input
            variant="soft"
            value={draft.title}
            maxLength={120}
            placeholder="Spindle noise rougher than usual"
            onChange={(e) => set({ title: e.target.value })}
          />
        </FormField>
        <FormField label="Details" hint="When it started and what you saw, heard or smelled. Any language is fine.">
          <Textarea variant="soft" value={draft.description} placeholder="Getaran terasa sampai meja kerja" onChange={(e) => set({ description: e.target.value })} />
        </FormField>
        <FormField label="Severity">
          <SegmentedControl
            aria-label="Severity"
            value={draft.severity}
            onChange={(v) => set({ severity: v as Severity })}
            options={SEVERITIES.map((s) => ({
              value: s,
              label: SEVERITY_LABEL[s],
              tone: s === 'critical' ? 'danger' : s === 'high' ? 'warning' : 'default',
            }))}
            className="grid w-full grid-cols-2 rounded-[22px] [&>button]:h-11"
          />
        </FormField>
        <FormField label="Impact on production">
          <SegmentedControl
            aria-label="Impact on production"
            value={draft.impact}
            onChange={(v) => set({ impact: v as OperationalImpact })}
            options={IMPACTS.map((x) => ({ value: x, label: IMPACT_LABEL[x], tone: x === 'stopped' ? 'danger' : 'default' }))}
            className="grid w-full grid-cols-1 rounded-[22px] [&>button]:h-11"
          />
        </FormField>
        <FormField label="Photos" hint="A photo of the spot saves the technician a trip.">
          <PhotoInput
            photos={photos}
            onAdd={(urls) => setPhotos((p) => [...p, ...urls])}
            onRemove={(url) => setPhotos((p) => p.filter((x) => x !== url))}
          />
        </FormField>
      </Card>
      <StickyBar>
        <Button type="submit" size="lg" className="flex-1">
          <Send />
          Send request
        </Button>
      </StickyBar>
    </form>
  )
}

function AssetPicker({ value, invalid, onChange }: { value: string | null; invalid: boolean; onChange: (id: string | null) => void }) {
  const { assets, maps, locationPath } = useMobileScope()
  const items = useMemo(() => assets.filter((a) => a.status !== 'retired'), [assets])
  return (
    <Combobox
      variant="soft"
      items={items}
      value={value}
      invalid={invalid}
      onChange={onChange}
      placeholder="Select the machine"
      searchPlaceholder="Search code, name or serial"
      getKey={(a) => a.id}
      getLabel={(a) => `${a.code} · ${a.name}`}
      getDescription={(a) => locationPath(a.locationId)}
      getKeywords={(a) => [a.serialNumber, a.model, maps.assetType.get(a.typeId)?.name ?? '']}
      renderIcon={(a) => (
        <span className="flex size-7 items-center justify-center rounded-lg bg-surface text-body">
          <AssetIcon icon={maps.assetType.get(a.typeId)?.icon} className="size-3.5" />
        </span>
      )}
    />
  )
}
