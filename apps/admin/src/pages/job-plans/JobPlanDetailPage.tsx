import { emptyJobPlan, fmtDate, newId, nextJobPlanCode, nowIso } from '@cmms/fixtures'
import type { JobPlan } from '@cmms/types'
import { WO_TYPE_LABEL } from '@cmms/types'
import { Banner, Button, Card, Combobox, ConfirmDialog, EmptyState, FormField, PageHeader, toast } from '@cmms/ui'
import { ListChecks, Save } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { ChecklistBuilder } from './ChecklistBuilder'
import {
  type PlanErrors,
  emptyTask,
  firstError,
  hasErrors,
  normalizeGroup,
  normalizePlan,
  planGroups,
  samePlan,
  suggestGroup,
  validatePlan,
} from './lib'
import { DetailsCard, NotesCard, PartsCard, SafetyCard, StatusCard, ToolsCard, UsedByCard } from './PlanSections'

const LIST = '/preventive/job-plans'

export function JobPlanDetailPage() {
  const { id = '' } = useParams()
  const { maps } = useScoped()
  const { can } = useAuth()
  const creating = id === 'new'
  const plan = creating ? null : maps.jobPlan.get(id)

  if (plan === undefined || (creating && !can('jobplan.manage'))) {
    return (
      <>
        <BackButton fallback={LIST} className="mb-2" />
        <Card className="mx-auto mt-6 max-w-lg">
          <EmptyState
            icon={<ListChecks />}
            title={creating ? 'Your role cannot create job plans' : 'Job plan not found'}
            description={creating ? 'Planners and supervisors build job plans.' : 'It may have been deleted, or the link is old.'}
            action={
              <Button asChild variant="outline">
                <Link to={LIST}>All job plans</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }
  return <JobPlanEditor key={id} original={plan} />
}

const NO_ERRORS: PlanErrors = { fields: {}, tasks: {} }

/** `original` is null while creating. Edits stay in a local draft until saved. */
function JobPlanEditor({ original }: { original: JobPlan | null }) {
  const { state, dispatch } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const readOnly = !can('jobplan.manage')
  const [baseline] = useState<JobPlan>(() =>
    original ? structuredClone(original) : { ...emptyJobPlan(nowIso()), tasks: [emptyTask('passfail')] },
  )
  const [draft, setDraft] = useState<JobPlan>(baseline)
  const [group, setGroup] = useState('')
  const [tried, setTried] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Set before navigations the editor starts itself, so the unsaved-changes guard lets them through.
  const leaving = useRef(false)
  const set = (patch: Partial<JobPlan>) => setDraft((d) => ({ ...d, ...patch }))

  const groupCode = original ? null : group || suggestGroup(draft.assetTypeIds, state.jobPlans) || ''
  const code = original?.code ?? (groupCode ? nextJobPlanCode(state.jobPlans, groupCode) : null)
  const errors = validatePlan(draft, groupCode)
  const shown = tried ? errors : NO_ERRORS
  const dirty = original ? !samePlan(draft, original) : group !== '' || !samePlan(draft, baseline)
  const usedBy = original ? state.pmSchedules.filter((p) => p.jobPlanId === original.id).map((p) => p.code) : []

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => !readOnly && dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )

  const save = () => {
    setTried(true)
    if (hasErrors(errors)) {
      toast('Check the highlighted fields', { tone: 'danger', description: firstError(errors, draft.tasks) })
      return
    }
    const item: JobPlan = {
      ...normalizePlan(draft),
      id: original?.id ?? newId('jp'),
      code: original?.code ?? nextJobPlanCode(state.jobPlans, groupCode ?? ''),
      revision: original ? original.revision + 1 : 1,
      updatedAt: nowIso(),
    }
    dispatch({ type: 'jobPlans/upsert', item })
    toast(original ? `${item.code} saved as revision ${item.revision}` : `${item.code} created`, { tone: 'success', description: item.name })
    setDraft(item)
    setTried(false)
    if (!original) {
      leaving.current = true
      navigate(paths.jobPlan(item.id), { replace: true })
    }
  }

  const discard = () => {
    if (!original) {
      leaving.current = true
      navigate(LIST)
      return
    }
    setDraft(structuredClone(original))
    setTried(false)
  }

  const remove = () => {
    if (!original) return
    dispatch({ type: 'jobPlans/remove', id: original.id })
    toast(`${original.code} deleted`, { tone: 'success', description: 'Work orders created from it keep their checklist.' })
    leaving.current = true
    navigate(LIST)
  }

  const groups = planGroups(state.jobPlans)
  const groupItems = groupCode && !groups.some((g) => g.group === groupCode) ? [{ group: groupCode, names: [] }, ...groups] : groups
  const codeField = original ? (
    <FormField label="Code" hint={`Revision ${original.revision}`}>
      <div className="flex h-11 items-center rounded-2xl bg-surface px-4 font-mono text-sm">{original.code}</div>
    </FormField>
  ) : (
    <FormField
      label="Code group"
      required
      htmlFor="jp-group"
      error={shown.fields.group}
      hint={code ? `Saves as ${code}` : 'Asset types suggest a group, or type a new one.'}
    >
      <Combobox
        id="jp-group"
        items={groupItems}
        value={groupCode || null}
        placeholder="Choose a group"
        searchPlaceholder="Search or type a new group"
        getKey={(g) => g.group}
        getLabel={(g) => g.group}
        getDescription={(g) => (g.names.length ? g.names.slice(0, 2).join(', ') : 'New group')}
        onChange={(g) => setGroup(g ?? '')}
        onCreate={(q) => setGroup(normalizeGroup(q))}
        createLabel={(q) => `Use ${normalizeGroup(q) || q} as a new group`}
      />
    </FormField>
  )

  return (
    <>
      <BackButton fallback={LIST} className="mb-2" />
      <PageHeader
        eyebrow={code ? <span className="font-mono normal-case tracking-normal">{code}</span> : 'Draft'}
        title={draft.name.trim() || original?.name || 'New job plan'}
        description={
          original
            ? `${WO_TYPE_LABEL[original.woType]} · revision ${original.revision}, saved ${fmtDate(original.updatedAt)}`
            : 'Build the template once. Every work order created from it copies the checklist, parts, tools and safety steps.'
        }
        actions={
          readOnly ? undefined : (
            <Button disabled={!dirty} onClick={save}>
              <Save />
              {original ? 'Save changes' : 'Create job plan'}
            </Button>
          )
        }
      />
      {readOnly && (
        <Banner tone="neutral" title="View only" className="mb-4">
          Your role can read job plans. Planners and supervisors change them.
        </Banner>
      )}

      <fieldset disabled={readOnly} className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DetailsCard plan={draft} set={set} errors={shown.fields} code={codeField} />
          <div className="min-w-0 space-y-4">
            <StatusCard plan={draft} set={set} readOnly={readOnly} original={original} usedBy={usedBy} onDelete={() => setDeleting(true)} />
            <UsedByCard plan={original} canSchedule={can('pm.manage')} />
          </div>
        </div>
        <ChecklistBuilder tasks={draft.tasks} errors={shown.tasks} error={shown.fields.tasks} readOnly={readOnly} onChange={(tasks) => set({ tasks })} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PartsCard plan={draft} set={set} readOnly={readOnly} error={shown.fields.parts} />
          <ToolsCard plan={draft} set={set} readOnly={readOnly} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SafetyCard plan={draft} set={set} readOnly={readOnly} />
          <NotesCard plan={draft} set={set} readOnly={readOnly} />
        </div>
      </fieldset>

      {!readOnly && dirty && (
        <div className="sticky bottom-24 z-10 mt-4 md:bottom-2">
          <div className="flex flex-wrap items-center gap-3 rounded-card bg-ink px-4 py-3 text-on-ink shadow-float">
            <span className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {original ? 'Unsaved changes' : 'This job plan is not saved yet'}
            </span>
            <Button variant="onInk" size="sm" onClick={discard}>
              Discard
            </Button>
            <Button size="sm" onClick={save}>
              <Save />
              {original ? `Save as revision ${original.revision + 1}` : 'Create job plan'}
            </Button>
          </div>
        </div>
      )}

      {original && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          destructive
          confirmLabel="Delete job plan"
          title={`Delete ${original.code}?`}
          description={`${original.name} leaves the job plan list. Work orders created from it keep their checklist.`}
          onConfirm={remove}
        />
      )}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && !leaving.current) blocker.reset?.()
        }}
        destructive
        title="Leave without saving?"
        description={original ? `Your changes to ${original.code} are lost if you leave now.` : 'The new job plan is lost if you leave now.'}
        confirmLabel="Leave page"
        cancelLabel="Keep editing"
        onConfirm={() => {
          leaving.current = true
          blocker.proceed?.()
        }}
      />
    </>
  )
}
