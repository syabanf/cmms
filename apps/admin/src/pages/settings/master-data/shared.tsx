import { listOf } from '@cmms/fixtures'
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  NativeSelect,
  Tooltip,
  useIsPhone,
} from '@cmms/ui'
import { Ellipsis, Pencil, Plus, Search, Trash } from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/auth'
import { useScoped } from '../../../state/scoped'
import { isTaken } from './lib'

/** Sites the user works at, the current one first. Site-bound master data lists all of them. */
export function useUserSites() {
  const { sites } = useAuth()
  const { siteId } = useScoped()
  return useMemo(() => {
    const ordered = [...sites].sort((a, b) => Number(b.id === siteId) - Number(a.id === siteId))
    const rank = new Map(ordered.map((site, i) => [site.id, i]))
    return {
      sites: ordered,
      options: ordered.map((site) => ({ value: site.id, label: site.name })),
      name: (id: string) => ordered.find((site) => site.id === id)?.name ?? 'Another site',
      /** Records at the user's sites, grouped by site in the same order. */
      inScope: <T extends { siteId: string }>(list: readonly T[]) =>
        list
          .filter((x) => rank.has(x.siteId))
          .sort((a, b) => (rank.get(a.siteId) ?? 0) - (rank.get(b.siteId) ?? 0)),
    }
  }, [sites, siteId])
}

/** Header of a master data card: what the list is, where it shows up, search and the add button. */
export function ListHeader({
  title,
  usedIn,
  query,
  onQuery,
  searchLabel,
  addLabel,
  onAdd,
}: {
  title: string
  usedIn: string
  query: string
  onQuery: (query: string) => void
  searchLabel: string
  addLabel: string
  onAdd?: () => void
}) {
  return (
    <div className="gap-3 p-5 flex flex-wrap items-start justify-between">
      <div className="min-w-0 basis-64 flex-1">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{usedIn}</p>
      </div>
      <div className="gap-2 sm:w-auto flex w-full flex-wrap items-center">
        <Input
          variant="soft"
          className="sm:w-60 w-full"
          inputClassName="rounded-full"
          leftIcon={<Search />}
          value={query}
          placeholder="Search"
          aria-label={searchLabel}
          onChange={(e) => onQuery(e.target.value)}
        />
        {onAdd && (
          <Button onClick={onAdd}>
            <Plus />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Table empty state: an empty list offers the add action, a search without hits offers to clear it. */
export function ListEmpty({
  query,
  noun,
  onClear,
  onAdd,
  icon,
}: {
  query: string
  noun: string
  onClear: () => void
  onAdd?: () => void
  icon: ReactNode
}) {
  if (query.trim()) {
    return (
      <EmptyState
        compact
        icon={<Search />}
        title={`No ${noun} match "${query.trim()}"`}
        description="Search by name or code."
        action={
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear search
          </Button>
        }
      />
    )
  }
  return (
    <EmptyState
      compact
      icon={icon}
      title={`No ${noun} yet`}
      description={
        onAdd
          ? `Add the first one and it shows up wherever people pick ${noun}.`
          : `An administrator or maintenance manager can add ${noun}.`
      }
      action={
        onAdd ? (
          <Button size="sm" onClick={onAdd}>
            <Plus />
            Add
          </Button>
        ) : undefined
      }
    />
  )
}

export function IconAction({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className={danger ? 'text-accent' : undefined}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

interface RowAction {
  label: string
  icon: ReactNode
  onSelect: () => void
}

/** Edit, delete and any extra row actions: icon buttons from `md` up, one overflow menu on phones. */
export function RowActions({
  name,
  onEdit,
  onDelete,
  extra = [],
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  extra?: RowAction[]
}) {
  const isPhone = useIsPhone()
  if (isPhone) {
    return (
      <div className="flex justify-end">
        <ActionMenu
          title={name}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
              <Ellipsis />
            </Button>
          }
          items={[
            ...extra.map((a) => ({ key: a.label, label: a.label, icon: a.icon, onSelect: a.onSelect })),
            { key: 'edit', label: 'Edit', icon: <Pencil />, onSelect: onEdit },
            'separator',
            { key: 'delete', label: 'Delete', icon: <Trash />, destructive: true, onSelect: onDelete },
          ]}
        />
      </div>
    )
  }
  return (
    <div className="gap-1 flex justify-end">
      {extra.map((a) => (
        <IconAction key={a.label} label={a.label} onClick={a.onSelect}>
          {a.icon}
        </IconAction>
      ))}
      <IconAction label={`Edit ${name}`} onClick={onEdit}>
        <Pencil />
      </IconAction>
      <IconAction label={`Delete ${name}`} onClick={onDelete} danger>
        <Trash />
      </IconAction>
    </div>
  )
}

/** Open and target state for one list's edit dialog and delete confirmation. The target survives the closing animation. */
export function useEditor<T, P = undefined>() {
  const [dialog, setDialog] = useState<{ open: boolean; editing: T | null; preset: P | undefined }>({
    open: false,
    editing: null,
    preset: undefined,
  })
  const [removal, setRemoval] = useState<{ open: boolean; item: T | null }>({ open: false, item: null })
  return {
    dialog,
    removal,
    create: (preset?: P) => setDialog({ open: true, editing: null, preset }),
    edit: (item: T) => setDialog({ open: true, editing: item, preset: undefined }),
    setDialogOpen: (open: boolean) => setDialog((d) => ({ ...d, open })),
    remove: (item: T) => setRemoval({ open: true, item }),
    setRemovalOpen: (open: boolean) => setRemoval((r) => ({ ...r, open })),
  }
}

/**
 * Delete confirmation that refuses while other records point at the row. `usage` names them,
 * such as "12 work orders", and an empty list allows the delete.
 */
export function DeleteDialog({
  open,
  onOpenChange,
  name,
  noun,
  usage,
  consequence,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  noun: string
  usage: string[]
  consequence: string
  onConfirm: () => void
}) {
  const blocked = usage.length > 0
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={blocked ? `${name} is in use` : `Delete ${name}?`}
      description={
        blocked
          ? `Used by ${listOf(usage)}. It stays while those records point at it. Edit it instead if the name is wrong.`
          : consequence
      }
      confirmLabel={`Delete ${noun}`}
      destructive
      confirmDisabled={blocked}
      onConfirm={onConfirm}
    />
  )
}

/** Centered dialog whose form mounts fresh on every open. */
export function FormDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && children}</DialogContent>
    </Dialog>
  )
}

export function EntityForm({
  title,
  description,
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  title: string
  description?: string
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">{children}</div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  )
}

/** Draft values for an entity form, with errors shown after the first submit. */
export function useDraft<D extends object>(initial: () => D) {
  const [draft, setDraft] = useState(initial)
  const [tried, setTried] = useState(false)
  return {
    draft,
    set: (patch: Partial<D>) => setDraft((d) => ({ ...d, ...patch })),
    /** Marks the form as submitted; returns true when it may save. */
    attempt: (errors: Record<string, string | undefined>) => {
      setTried(true)
      return !Object.values(errors).some(Boolean)
    },
    show: (error: string | undefined) => (tried ? error : undefined),
  }
}

interface SiteCode {
  siteId: string
  code: string
  name: string
}

/** Fields shared by site-bound records that carry a unique code: cost centers and warehouses. */
export function SiteCodeForm({
  noun,
  description,
  example,
  editing,
  defaultSiteId,
  takenCodes,
  siteLocked,
  onSave,
  onCancel,
}: {
  noun: string
  description: string
  example: { code: string; name: string }
  editing: SiteCode | null
  defaultSiteId: string
  takenCodes: string[]
  siteLocked: boolean
  onSave: (values: SiteCode) => void
  onCancel: () => void
}) {
  const userSites = useUserSites()
  const { draft, set, attempt, show } = useDraft(() => ({
    siteId: editing?.siteId ?? defaultSiteId,
    code: editing?.code ?? '',
    name: editing?.name ?? '',
  }))
  const code = draft.code.trim().toUpperCase()
  const name = draft.name.trim()
  const errors = {
    code: !code
      ? `Enter a code, such as ${example.code}.`
      : isTaken(code, takenCodes)
        ? `${code} is already used.`
        : undefined,
    name: name ? undefined : `Enter a name, such as ${example.name}.`,
  }
  const submit = () => {
    if (attempt(errors)) onSave({ siteId: draft.siteId, code, name })
  }
  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : `Add ${noun}`}
      description={description}
      submitLabel={editing ? 'Save changes' : `Add ${noun}`}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <FormField
        label="Site"
        htmlFor="sc-site"
        hint={siteLocked ? 'Records at this site use it, so it stays here.' : undefined}
        className="sm:col-span-2"
      >
        <NativeSelect
          id="sc-site"
          options={userSites.options}
          value={draft.siteId}
          disabled={siteLocked}
          onChange={(e) => set({ siteId: e.target.value })}
        />
      </FormField>
      <FormField
        label="Code"
        required
        htmlFor="sc-code"
        error={show(errors.code)}
        hint="Unique across sites."
      >
        <Input
          id="sc-code"
          value={draft.code}
          inputClassName="font-mono uppercase"
          placeholder={example.code}
          onChange={(e) => set({ code: e.target.value })}
        />
      </FormField>
      <FormField label="Name" required htmlFor="sc-name" error={show(errors.name)}>
        <Input
          id="sc-name"
          value={draft.name}
          placeholder={example.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
    </EntityForm>
  )
}
