import { useEffect, useState } from 'react'
import {
  DUALSENSE_BUTTONS,
  PS5Controller,
  type PS5ControllerState,
} from 'ps5-controller-webhid'
import { usePS5Controller } from 'ps5-controller-webhid/react'

const controller = new PS5Controller({ pollRateHz: 60 })

type Stick = PS5ControllerState['sticks']['left']

function StickReadout({ label, value }: { label: string; value: Stick }) {
  return (
    <div className="stick-readout">
      <div className="stick-heading">
        <span>{label}</span>
        <code>
          {value.x.toFixed(2)}, {value.y.toFixed(2)}
        </code>
      </div>
      <div className="stick-area" aria-label={`${label} position`}>
        <span className="stick-axis stick-axis-x" />
        <span className="stick-axis stick-axis-y" />
        <span
          className="stick-dot"
          style={{
            left: `${50 + value.x * 42}%`,
            top: `${50 - value.y * 42}%`,
          }}
        />
      </div>
    </div>
  )
}

function TriggerReadout({
  label,
  value,
}: {
  label: string
  value: number
}) {
  const percent = Math.round(value * 100)

  return (
    <div className="trigger-readout">
      <div>
        <span>{label}</span>
        <code>{percent}%</code>
      </div>
      <progress max="1" value={value} />
    </div>
  )
}

function App() {
  const input = usePS5Controller(controller)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [lastAction, setLastAction] = useState('Ready for a controller.')
  const support = controller.support

  useEffect(() => {
    const unsubscribe = controller.onError((nextError) =>
      setError(nextError.message),
    )

    return () => {
      unsubscribe()
      controller.dispose()
    }
  }, [])

  const connect = async () => {
    setConnecting(true)
    setError('')
    try {
      await controller.connect()
      setLastAction('Device permission granted. Waiting for input reports.')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not connect.',
      )
    } finally {
      setConnecting(false)
    }
  }

  const testRumble = async () => {
    setLastAction('Playing a 300 ms haptic pulse.')
    await controller.pulseRumble(0.7, 0.7, 300)
    setLastAction('Haptic pulse completed.')
  }

  const resetOrientation = () => {
    controller.resetOrientation()
    setLastAction('Current orientation set as neutral.')
  }

  const activeButtons = DUALSENSE_BUTTONS.filter(
    ({ key }) => input.buttons[key],
  )

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Installed npm package smoke test</p>
          <h1>PS5 Controller WebHID</h1>
          <p className="intro">
            This page imports <code>ps5-controller-webhid</code> and its React
            subpath directly from <code>node_modules</code>.
          </p>
        </div>
        <span className={`connection ${input.connected ? 'online' : ''}`}>
          <span />
          {input.connected ? input.transport : 'Disconnected'}
        </span>
      </header>

      <section className="support-grid" aria-label="Browser support">
        <div className={support.webHID ? 'pass' : 'fail'}>
          <span>WebHID</span>
          <strong>{support.webHID ? 'Available' : 'Unavailable'}</strong>
        </div>
        <div className={support.secureContext ? 'pass' : 'fail'}>
          <span>Secure context</span>
          <strong>{support.secureContext ? 'Yes' : 'No'}</strong>
        </div>
        <div className={support.supported ? 'pass' : 'fail'}>
          <span>Package support</span>
          <strong>{support.supported ? 'Ready' : 'Blocked'}</strong>
        </div>
      </section>

      <section className="actions">
        <button
          className="primary"
          type="button"
          onClick={() => void connect()}
          disabled={connecting || input.connected || !support.supported}
        >
          {connecting
            ? 'Opening device picker…'
            : input.connected
              ? 'Controller connected'
              : 'Find PS5 controller'}
        </button>
        <button
          type="button"
          onClick={() => void testRumble()}
          disabled={!input.connected}
        >
          Test rumble
        </button>
        <button
          type="button"
          onClick={resetOrientation}
          disabled={!input.connected}
        >
          Reset orientation
        </button>
        <p>{lastAction}</p>
      </section>

      {error && (
        <div className="error" role="alert">
          <strong>Connection error</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="dashboard">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Analog input</p>
              <h2>Sticks and triggers</h2>
            </div>
          </div>
          <div className="sticks">
            <StickReadout label="Left stick" value={input.sticks.left} />
            <StickReadout label="Right stick" value={input.sticks.right} />
          </div>
          <div className="triggers">
            <TriggerReadout label="L2" value={input.triggers.left} />
            <TriggerReadout label="R2" value={input.triggers.right} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Digital input</p>
              <h2>Buttons</h2>
            </div>
            <span className="count">{activeButtons.length} active</span>
          </div>
          <div className="buttons">
            {DUALSENSE_BUTTONS.map(({ key, label }) => (
              <span
                className={input.buttons[key] ? 'button active' : 'button'}
                key={key}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="panel identity">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Device data</p>
              <h2>Identity and motion</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Product</dt>
              <dd>{input.productName || '—'}</dd>
            </div>
            <div>
              <dt>Firmware</dt>
              <dd>{input.firmware || '—'}</dd>
            </div>
            <div>
              <dt>Board</dt>
              <dd>{input.boardRevision || '—'}</dd>
            </div>
            <div>
              <dt>Battery</dt>
              <dd>{input.connected ? input.battery.level : '—'}</dd>
            </div>
            <div>
              <dt>Pitch</dt>
              <dd>{input.motion.orientation.x.toFixed(1)}°</dd>
            </div>
            <div>
              <dt>Yaw</dt>
              <dd>{input.motion.orientation.y.toFixed(1)}°</dd>
            </div>
            <div>
              <dt>Roll</dt>
              <dd>{input.motion.orientation.z.toFixed(1)}°</dd>
            </div>
            <div>
              <dt>Touch contacts</dt>
              <dd>
                {Number(input.touchpad.primary.active) +
                  Number(input.touchpad.secondary.active)}
              </dd>
            </div>
          </dl>
        </section>

        <details className="panel raw">
          <summary>Raw normalized state</summary>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </details>
      </div>

      <footer>
        Use desktop Chrome, Edge, or Opera on localhost or HTTPS. The browser
        device picker must be opened from the button above.
      </footer>
    </main>
  )
}

export default App
