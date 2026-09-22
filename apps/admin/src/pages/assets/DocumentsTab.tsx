import { fmtDate, fmtFileSize, newId, nowIso, toMs } from '@cmms/fixtures'
import type { Asset, AssetDocument, DocumentType } from '@cmms/types'
import { DOCUMENT_TYPE_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Combobox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  IconTile,
  Input,
  toast,
} from '@cmms/ui'
import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Trash2,
  Upload,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { SectionTitle } from './ui'

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]

const DOC_ICON: Partial<Record<DocumentType, ReactNode>> = {
  photo: <FileImage />,
  video: <FileVideo />,
  plc_backup: <FileArchive />,
  inspection_sheet: <FileSpreadsheet />,
}

function guessType(file: File): DocumentType {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('video/')) return 'video'
  if (/\.(xlsx?|csv)$/i.test(file.name)) return 'inspection_sheet'
  return 'manual'
}

/** Manuals, drawings, certificates and photos kept on the passport. */
export function DocumentsTab({ asset }: { asset: Asset }) {
  const { documents, dispatch, personName } = useScoped()
  const { can } = useAuth()
  const canManage = can('asset.manage')
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File | null>(null)
  const [removing, setRemoving] = useState<AssetDocument | null>(null)

  const docs = useMemo(
    () =>
      documents.filter((d) => d.assetId === asset.id).sort((a, b) => toMs(b.uploadedAt) - toMs(a.uploadedAt)),
    [documents, asset.id],
  )
  const upload = canManage && (
    <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
      <Upload />
      Upload document
    </Button>
  )

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          setPending(e.target.files?.[0] ?? null)
          // Let the same file be picked again after a cancel.
          e.target.value = ''
        }}
      />
      <SectionTitle count={docs.length} action={docs.length > 0 && upload}>
        Documents
      </SectionTitle>

      {docs.length ? (
        <ul className="divide-y divide-border">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              <IconTile size="sm">{DOC_ICON[doc.type] ?? <FileText />}</IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="max-w-full min-w-0 truncate text-sm font-medium">{doc.name}</p>
                  <Badge variant="outline">{DOCUMENT_TYPE_LABEL[doc.type]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  <span className="font-mono">{doc.fileName}</span> · {fmtFileSize(doc.sizeKb)}
                </p>
                <p className="truncate text-xs text-muted">
                  Uploaded by {personName(doc.uploadedBy)} on {fmtDate(doc.uploadedAt)}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-accent"
                  aria-label={`Remove ${doc.name}`}
                  onClick={() => setRemoving(doc)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={<FolderOpen />}
          title="No documents yet"
          description="Upload the manual, drawings, diagrams and warranty papers so technicians find them from the QR scan."
          action={upload || undefined}
        />
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent size="sm">
          {pending && <UploadForm file={pending} assetId={asset.id} onDone={() => setPending(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'this document'}?`}
        description="It leaves the passport and the asset history. Upload it again if you need it back."
        confirmLabel="Remove document"
        destructive
        onConfirm={() => {
          if (!removing) return
          dispatch({ type: 'documents/remove', id: removing.id })
          toast('Document removed', { tone: 'success', description: removing.name })
          setRemoving(null)
        }}
      />
    </div>
  )
}

function UploadForm({ file, assetId, onDone }: { file: File; assetId: string; onDone: () => void }) {
  const { dispatch, user } = useScoped()
  const [name, setName] = useState(() => file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  const [type, setType] = useState<DocumentType>(() => guessType(file))
  const [tried, setTried] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!name.trim()) return
    dispatch({
      type: 'documents/upsert',
      item: {
        id: newId('doc'),
        assetId,
        type,
        name: name.trim(),
        fileName: file.name,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        uploadedAt: nowIso(),
        uploadedBy: user.id,
      },
    })
    toast('Document uploaded', { tone: 'success', description: name.trim() })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Upload document</DialogTitle>
        <DialogDescription className="break-all">
          {file.name} · {fmtFileSize(file.size / 1024)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <FormField
          label="Title"
          required
          htmlFor="doc-name"
          error={tried && !name.trim() ? 'Give the document a title.' : undefined}
        >
          <Input id="doc-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Document type" htmlFor="doc-type">
          <Combobox
            id="doc-type"
            items={DOCUMENT_TYPES}
            value={type}
            searchPlaceholder="Search document types"
            getKey={(t) => t}
            getLabel={(t) => DOCUMENT_TYPE_LABEL[t]}
            onChange={(next) => setType(DOCUMENT_TYPES.find((t) => t === next) ?? type)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">
          <Upload />
          Upload
        </Button>
      </DialogFooter>
    </form>
  )
}
