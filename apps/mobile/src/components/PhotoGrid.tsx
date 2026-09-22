import type { Attachment } from '@cmms/types'
import { ImageIcon } from 'lucide-react'

type Photo = Pick<Attachment, 'id' | 'name' | 'url'>

/** Read-only photo tiles. Seeded photos have no file in the browser, so they show a placeholder. */
export function PhotoGrid({ photos }: { photos: Photo[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="aspect-square overflow-hidden rounded-2xl bg-surface">
          {photo.url ? (
            <img src={photo.url} alt={photo.name} className="size-full object-cover" />
          ) : (
            <div role="img" aria-label={photo.name} className="flex size-full items-center justify-center text-muted [&_svg]:size-6">
              <ImageIcon aria-hidden="true" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
