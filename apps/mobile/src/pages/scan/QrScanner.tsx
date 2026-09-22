import { Button } from '@cmms/ui'
import { CameraOff, LoaderCircle, ScanLine, VideoOff } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

// BarcodeDetector is not in the TypeScript DOM library yet; this is the part the scanner uses.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance

const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
const SUPPORTED = !!Detector && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const SCAN_EVERY_MS = 300

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'unsupported'

/** Rear camera viewfinder that reports every QR payload it reads, about three times a second. */
export function QrScanner({ onDetect }: { onDetect: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectRef = useRef(onDetect)
  const [state, setState] = useState<CameraState>(SUPPORTED ? 'starting' : 'unsupported')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    onDetectRef.current = onDetect
  })

  useEffect(() => {
    if (!SUPPORTED || !Detector) return
    const detector = new Detector({ formats: ['qr_code'] })
    let stream: MediaStream | null = null
    let timer = 0
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        const video = videoRef.current
        if (cancelled || !video) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream = media
        video.srcObject = media
        await video.play().catch(() => undefined)
        if (cancelled) return
        setState('scanning')
        let busy = false
        timer = window.setInterval(() => {
          if (busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
          busy = true
          detector
            .detect(video)
            .then((codes) => {
              const value = codes[0]?.rawValue
              if (value && !cancelled) onDetectRef.current(value)
            })
            .catch(() => undefined) // a frame that cannot be decoded; the next one usually can
            .finally(() => {
              busy = false
            })
        }, SCAN_EVERY_MS)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ''
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt])

  const retry = () => {
    setState('starting')
    setAttempt((n) => n + 1)
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-ink text-on-ink shadow-float">
      <video ref={videoRef} muted playsInline aria-label="Camera preview" className="absolute inset-0 size-full object-cover" />
      {state === 'scanning' && <Frame />}
      {state === 'starting' && (
        <Overlay icon={<LoaderCircle className="animate-spin" />} title="Starting the camera" text="Allow camera access when your phone asks." />
      )}
      {state === 'denied' && (
        <Overlay
          icon={<CameraOff />}
          title="Camera access is off"
          text="Allow the camera for this app in your browser settings, or type the code on the tag below."
          action={
            <Button variant="onInk" className="h-11" onClick={retry}>
              Try again
            </Button>
          }
        />
      )}
      {state === 'unavailable' && (
        <Overlay
          icon={<VideoOff />}
          title="No camera found"
          text="Another app may be using it. Type the code on the tag below instead."
          action={
            <Button variant="onInk" className="h-11" onClick={retry}>
              Try again
            </Button>
          }
        />
      )}
      {state === 'unsupported' && (
        <Overlay
          icon={<ScanLine />}
          title="This browser cannot read QR codes"
          text="Type the code printed under the QR tag below, or open the app in Chrome on Android."
        />
      )}
    </div>
  )
}

function Frame() {
  const corner = 'absolute size-10 border-white'
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-[18%]">
        <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
        <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
      </div>
      <p className="absolute inset-x-0 bottom-5 text-center text-sm font-semibold text-white">Point at the QR tag on the machine</p>
    </div>
  )
}

function Overlay({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink px-8 text-center">
      <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-white/10 [&_svg]:size-6">{icon}</span>
      <p className="text-base font-bold">{title}</p>
      <p className="text-sm text-on-ink-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
