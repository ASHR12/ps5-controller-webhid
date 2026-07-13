import { useEffect, useRef } from 'react'
import type { ControllerSnapshot } from '../diagnostics/usePS5ControllerDiagnostic'

interface ControllerConnectDialogProps {
  open: boolean
  connecting: boolean
  error: string | null
  webHIDSupported: boolean
  secureContext: boolean
  snapshot: ControllerSnapshot
  onConnect: () => void
  onClose: () => void
  onContinue: () => void
}

export function ControllerConnectDialog({
  open,
  connecting,
  error,
  webHIDSupported,
  secureContext,
  snapshot,
  onConnect,
  onClose,
  onContinue,
}: ControllerConnectDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !connecting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [connecting, onClose, open])

  if (!open) return null

  const supported = webHIDSupported && secureContext
  const connected = snapshot.connected

  return (
    <div className="connect-dialog-backdrop" role="presentation">
      <section
        className="connect-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-dialog-title"
      >
        <header className="connect-dialog-header">
          <div>
            <span className="eyebrow">CONTROLLER CONNECTION</span>
            <h2 id="connect-dialog-title">
              {connected ? 'PS5 controller connected' : 'Find a PS5 controller'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="dialog-close"
            aria-label="Close controller connection dialog"
            onClick={onClose}
            disabled={connecting}
          >
            ×
          </button>
        </header>

        <div className="connection-steps" aria-label="Connection progress">
          <div className={supported ? 'complete' : 'current'}>
            <span>1</span>
            <small>Browser ready</small>
          </div>
          <i />
          <div className={connected ? 'complete' : 'current'}>
            <span>2</span>
            <small>Grant access</small>
          </div>
          <i />
          <div className={connected ? 'complete' : ''}>
            <span>3</span>
            <small>Start testing</small>
          </div>
        </div>

        {!supported ? (
          <div className="connection-blocked">
            <strong>WebHID is not available in this browser context.</strong>
            <p>
              Open this site over HTTPS or localhost in desktop Chrome or Edge,
              then try again.
            </p>
            <dl>
              <div>
                <dt>WebHID</dt>
                <dd>{webHIDSupported ? 'Available' : 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Secure context</dt>
                <dd>{secureContext ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>
        ) : connected ? (
          <>
            <div className="connected-device-card">
              <span className="connected-pulse" aria-hidden="true" />
              <div>
                <small>Selected device</small>
                <h3>{snapshot.productName}</h3>
                <p>
                  Full input reports are streaming over{' '}
                  <strong>{snapshot.transport}</strong>.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Board</dt>
                  <dd>{snapshot.boardRevision || 'Resolving…'}</dd>
                </div>
                <div>
                  <dt>Firmware</dt>
                  <dd>{snapshot.firmware || 'Resolving…'}</dd>
                </div>
                <div>
                  <dt>Report</dt>
                  <dd>{snapshot.limited ? 'Limited' : 'Full'}</dd>
                </div>
              </dl>
            </div>
            <div className="connect-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={onContinue}
              >
                Continue to tests
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pairing-guide">
              <article>
                <span>Bluetooth pairing</span>
                <h3>Pair with the operating system first</h3>
                <p>
                  Hold <strong>Create + PS</strong> until the blue lights flash,
                  then connect <strong>DualSense Wireless Controller</strong> in
                  your Bluetooth settings. Previously approved controllers
                  reconnect automatically when switched on.
                </p>
              </article>
              <article>
                <span>First-time permission</span>
                <h3>Approve controller access once</h3>
                <p>
                  If this browser has not been approved before, continue to
                  Chrome’s secure chooser and select{' '}
                  <strong>DualSense Wireless Controller</strong>.
                </p>
              </article>
            </div>

            {error && (
              <div className="connection-error" role="alert">
                <strong>Could not connect</strong>
                <span>{error}</span>
              </div>
            )}

            <div className="connect-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={onClose}
                disabled={connecting}
              >
                Not now
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={onConnect}
                disabled={connecting}
              >
                {connecting
                  ? 'Chrome picker open…'
                  : 'Allow controller access'}
              </button>
            </div>
            <p className="native-picker-note">
              Chrome controls the first-time chooser, so websites cannot style
              or move it. After approval, this controller reconnects
              automatically without showing the chooser again.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
