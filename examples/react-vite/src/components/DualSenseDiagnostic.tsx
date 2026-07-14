import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BUTTONS,
  formatChargeStatus,
  usePS5ControllerDiagnostic,
  type OutputResult,
  type Vec2,
  type Vec3,
} from '../diagnostics/usePS5ControllerDiagnostic'
import { ControllerConnectDialog } from './ControllerConnectDialog'
import { DeveloperGuide } from './DeveloperGuide'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function StatusPill({
  tone,
  children,
}: {
  tone: 'idle' | 'pass' | 'warn' | 'fail'
  children: ReactNode
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>
}

function Check({
  passed,
  label,
  detail,
}: {
  passed: boolean
  label: string
  detail: string
}) {
  return (
    <div className={`check ${passed ? 'passed' : ''}`}>
      <span className="check-mark" aria-hidden="true">
        {passed ? '✓' : '·'}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </div>
  )
}

function Stick({
  label,
  value,
  seen,
}: {
  label: string
  value: Vec2
  seen: boolean
}) {
  const x = clamp(value.x, -1, 1)
  const y = clamp(value.y, -1, 1)
  return (
    <div className="stick-readout">
      <div className="readout-heading">
        <span>{label}</span>
        <StatusPill tone={seen ? 'pass' : 'idle'}>
          {seen ? 'detected' : 'move it'}
        </StatusPill>
      </div>
      <div className="stick-field" aria-label={`${label} live position`}>
        <span className="stick-axis horizontal" />
        <span className="stick-axis vertical" />
        <span
          className="stick-dot"
          style={
            {
              '--stick-x': `${x * 43}%`,
              '--stick-y': `${-y * 43}%`,
            } as CSSProperties
          }
        />
      </div>
      <code>
        x {value.x.toFixed(3)} / y {value.y.toFixed(3)}
      </code>
    </div>
  )
}

function TriggerMeter({
  label,
  value,
  seen,
}: {
  label: string
  value: number
  seen: boolean
}) {
  const percent = Math.round(clamp(value, 0, 1) * 100)
  return (
    <div className="trigger-readout">
      <div className="readout-heading">
        <span>{label}</span>
        <span className="numeric">{percent}%</span>
      </div>
      <div className="meter-track">
        <span className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
      <small className={seen ? 'seen-copy' : ''}>
        {seen ? 'Analog range detected' : 'Pull past 25%'}
      </small>
    </div>
  )
}

function Vector({
  label,
  value,
  scale = 1,
  suffix = '',
}: {
  label: string
  value: Vec3
  scale?: number
  suffix?: string
}) {
  return (
    <div className="vector-readout">
      <span>{label}</span>
      <code>
        X {(value.x * scale).toFixed(2)}
        {suffix}
      </code>
      <code>
        Y {(value.y * scale).toFixed(2)}
        {suffix}
      </code>
      <code>
        Z {(value.z * scale).toFixed(2)}
        {suffix}
      </code>
    </div>
  )
}

function Confirmation({
  value,
  disabled,
  onChange,
}: {
  value: OutputResult
  disabled: boolean
  onChange: (value: 'pass' | 'fail') => void
}) {
  return (
    <div className="confirmation" aria-label="Confirm physical result">
      <span>Did you feel it?</span>
      <button
        type="button"
        className={value === 'pass' ? 'selected pass' : ''}
        onClick={() => onChange('pass')}
        disabled={disabled}
      >
        Yes
      </button>
      <button
        type="button"
        className={value === 'fail' ? 'selected fail' : ''}
        onClick={() => onChange('fail')}
        disabled={disabled}
      >
        No
      </button>
    </div>
  )
}

export function DualSenseDiagnostic() {
  const diagnostic = usePS5ControllerDiagnostic()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'tester' | 'developers'>('tester')
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const {
    webHIDSupported,
    secureContext,
    snapshot,
    observed,
    calibration,
    outputResults,
  } = diagnostic

  const seenButtonCount = BUTTONS.filter(
    ({ key }) => observed.buttons[key],
  ).length
  const coreButtonSeen = BUTTONS.some(
    ({ key }) =>
      !['l2Digital', 'r2Digital'].includes(key) &&
      observed.buttons[key],
  )

  const tests = useMemo(
    () => [
      {
        passed: webHIDSupported && secureContext,
        label: 'Browser access',
        detail: 'WebHID on a secure origin',
      },
      {
        passed: snapshot.connected && !snapshot.limited,
        label: 'Full DualSense link',
        detail: snapshot.connected
          ? `${snapshot.transport}; full input report`
          : 'Waiting for controller',
      },
      {
        passed:
          observed.leftStick &&
          observed.rightStick &&
          observed.leftTrigger &&
          observed.rightTrigger &&
          coreButtonSeen,
        label: 'Core inputs',
        detail: 'Sticks, triggers, and buttons',
      },
      {
        passed: observed.gyro && observed.accelerometer,
        label: 'Motion sensors',
        detail: 'Gyroscope and accelerometer',
      },
      {
        passed: calibration.status === 'pass',
        label: 'Gyro stability',
        detail: 'Stationary calibration sample',
      },
      {
        passed: outputResults.triggers === 'pass',
        label: 'Adaptive triggers',
        detail: 'Physical resistance confirmed',
      },
      {
        passed: outputResults.haptics === 'pass',
        label: 'Haptic feedback',
        detail: 'Physical pulse pattern confirmed',
      },
    ],
    [
      calibration.status,
      coreButtonSeen,
      observed.accelerometer,
      observed.gyro,
      observed.leftStick,
      observed.leftTrigger,
      observed.rightStick,
      observed.rightTrigger,
      outputResults.haptics,
      outputResults.triggers,
      secureContext,
      snapshot.connected,
      snapshot.limited,
      snapshot.transport,
      webHIDSupported,
    ],
  )

  const passedTests = tests.filter(({ passed }) => passed).length
  const explicitFailure =
    outputResults.haptics === 'fail' || outputResults.triggers === 'fail'
  const allRequiredTestsPassed = tests.every(({ passed }) => passed)
  const overallTone = allRequiredTestsPassed
    ? 'pass'
    : explicitFailure
      ? 'fail'
      : 'warn'
  const overallLabel = allRequiredTestsPassed
    ? 'ALL REQUIRED TESTS PASSED'
    : explicitFailure
      ? 'OUTPUT TEST FAILED'
      : 'TESTING INCOMPLETE'

  const copyReport = async () => {
    const report = {
      tool: {
        name: 'PS5 Controller Tester',
        package: 'ps5-controller-webhid',
        version: '0.1.1',
      },
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      webHIDSupported,
      secureContext,
      device: {
        connected: snapshot.connected,
        transport: snapshot.transport,
        limitedReport: snapshot.limited,
        productName: snapshot.productName,
        boardRevision: snapshot.boardRevision || null,
        firmware: snapshot.firmware || null,
      },
      observed: {
        ...observed,
        buttons: BUTTONS.filter(({ key }) => observed.buttons[key]).map(
          ({ label }) => label,
        ),
      },
      calibration,
      physicalConfirmation: outputResults,
      allRequiredTestsPassed,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const findController = () => {
    setConnectDialogOpen(true)
  }

  const continueToTests = () => {
    setConnectDialogOpen(false)
    window.requestAnimationFrame(() => {
      document
        .querySelector('#controller-tests')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div>
            <strong>PS5 CONTROLLER</strong>
            <small>npm package integration example</small>
          </div>
        </div>
        {activeTab === 'tester' ? (
          <StatusPill tone={overallTone}>{overallLabel}</StatusPill>
        ) : (
          <StatusPill tone="idle">PACKAGE v0.1.1</StatusPill>
        )}
      </header>

      <nav className="app-tabs" aria-label="Application sections">
        <button
          type="button"
          className={activeTab === 'tester' ? 'active' : ''}
          aria-current={activeTab === 'tester' ? 'page' : undefined}
          onClick={() => setActiveTab('tester')}
        >
          <span>01</span>
          Controller Tester
        </button>
        <button
          type="button"
          className={activeTab === 'developers' ? 'active' : ''}
          aria-current={activeTab === 'developers' ? 'page' : undefined}
          onClick={() => setActiveTab('developers')}
        >
          <span>02</span>
          Developer Guide
        </button>
      </nav>

      {activeTab === 'tester' ? (
        <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">NPM INSTALLATION / REACT + VITE</span>
          <h1>Build on every signal from your PS5 controller.</h1>
          <p>
            This real-world example installs <code>ps5-controller-webhid</code>
            from npm, then builds complete input diagnostics, motion previews,
            adaptive-trigger checks, and haptic controls on its public API.
          </p>
          <div className="utility-tags" aria-label="Project highlights">
            <span>Bluetooth + USB</span>
            <span>Published npm package</span>
            <span>Local browser data</span>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-action"
              onClick={findController}
              disabled={diagnostic.connecting}
            >
              {snapshot.connected
                ? `Connected · ${snapshot.transport}`
                : diagnostic.connecting
                  ? 'Waiting for selection…'
                  : 'Find PS5 controller'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={diagnostic.resetObserved}
            >
              Reset test session
            </button>
          </div>
          <p className="support-note">
            Bluetooth is the target. To pair, hold Create (small button left of
            the center pad) + the PS logo button until the blue lights flash,
            then connect in macOS and Chrome.
          </p>
        </div>
        <div className="hero-product-art" aria-hidden="true">
          <img src="/ps5-controller-hero.jpg" alt="" />
          <span>Installed package · live diagnostics</span>
        </div>
        <div className="test-summary">
          <div className="test-score">
            <span>{passedTests}</span>
            <small>/ {tests.length} required tests passed</small>
          </div>
          <div className="test-progress" aria-hidden="true">
            <span style={{ width: `${(passedTests / tests.length) * 100}%` }} />
          </div>
          <div className="checks">
            {tests.map((test) => (
              <Check key={test.label} {...test} />
            ))}
          </div>
          <button type="button" className="report-button" onClick={copyReport}>
            {copied ? 'Report copied' : 'Copy diagnostic report'}
          </button>
        </div>
      </section>

      {diagnostic.error && (
        <div className="error-banner" role="alert">
          <strong>Controller error</strong>
          <span>{diagnostic.error}</span>
        </div>
      )}

      <section className="system-strip" aria-label="Environment status">
        <div>
          <span className={webHIDSupported ? 'signal pass' : 'signal fail'} />
          <small>WebHID</small>
          <strong>{webHIDSupported ? 'Available' : 'Unavailable'}</strong>
        </div>
        <div>
          <span className={secureContext ? 'signal pass' : 'signal fail'} />
          <small>Secure context</small>
          <strong>{secureContext ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span className={snapshot.connected ? 'signal pass' : 'signal'} />
          <small>Controller</small>
          <strong>{snapshot.connected ? 'Connected' : 'Disconnected'}</strong>
        </div>
        <div>
          <span className={snapshot.connected ? 'signal pass' : 'signal'} />
          <small>Transport</small>
          <strong>{snapshot.transport}</strong>
        </div>
      </section>

      <section className="section-block" id="controller-tests">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / DEVICE</span>
            <h2>Connection and identity</h2>
          </div>
          <StatusPill tone={snapshot.connected ? 'pass' : 'idle'}>
            {snapshot.connected ? 'live' : 'waiting'}
          </StatusPill>
        </div>
        <div className="device-grid">
          <article className="panel device-card">
            <div>
              <span className="panel-kicker">Detected hardware</span>
              <h3>{snapshot.productName || 'PS5 DualSense'}</h3>
              <p>
                {snapshot.connected
                  ? `${snapshot.transport} input reports are streaming.`
                  : 'Connect the controller and approve the browser prompt.'}
              </p>
            </div>
          </article>
          <article className="panel facts-card">
            <dl>
              <div>
                <dt>Report mode</dt>
                <dd>{snapshot.limited ? 'Limited' : 'Full'}</dd>
              </div>
              <div>
                <dt>Identity data</dt>
                <dd>{snapshot.identityReady ? 'Resolved' : 'Waiting'}</dd>
              </div>
              <div>
                <dt>Board</dt>
                <dd>{snapshot.boardRevision || '—'}</dd>
              </div>
              <div>
                <dt>Firmware</dt>
                <dd>{snapshot.firmware || '—'}</dd>
              </div>
              <div>
                <dt>Battery</dt>
                <dd>
                  {snapshot.connected
                    ? `${Math.round(snapshot.battery.level * 100)}%`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Power</dt>
                <dd>
                  {snapshot.connected
                    ? formatChargeStatus(snapshot.battery.status)
                    : '—'}
                </dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">02 / ANALOG INPUT</span>
            <h2>Sticks and analog triggers</h2>
          </div>
          <span className="section-instruction">
            Move both sticks and pull both triggers
          </span>
        </div>
        <div className="input-grid">
          <article className="panel sticks-panel">
            <Stick
              label="Left stick"
              value={snapshot.sticks.left}
              seen={observed.leftStick}
            />
            <Stick
              label="Right stick"
              value={snapshot.sticks.right}
              seen={observed.rightStick}
            />
          </article>
          <article className="panel triggers-panel">
            <TriggerMeter
              label="L2 / left trigger"
              value={snapshot.triggers.left}
              seen={observed.leftTrigger}
            />
            <TriggerMeter
              label="R2 / right trigger"
              value={snapshot.triggers.right}
              seen={observed.rightTrigger}
            />
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 / DIGITAL INPUT</span>
            <h2>Buttons</h2>
          </div>
          <span className="section-instruction">
            {seenButtonCount} / {BUTTONS.length} seen
          </span>
        </div>
        <div className="button-grid">
          {BUTTONS.map(({ key, label }) => (
            <div
              key={key}
              className={[
                'button-tile',
                snapshot.buttons[key] ? 'active' : '',
                observed.buttons[key] ? 'seen' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="button-indicator" />
              <strong>{label}</strong>
              <small>
                {snapshot.buttons[key]
                  ? 'pressed'
                  : observed.buttons[key]
                    ? 'verified'
                    : 'untested'}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">04 / MOTION</span>
            <h2>Motion and neutral zero</h2>
          </div>
          <StatusPill tone={observed.gyro ? 'pass' : 'idle'}>
            {observed.gyro ? 'motion detected' : 'rotate controller'}
          </StatusPill>
        </div>
        <div className="motion-grid">
          <article className="panel orientation-panel">
            <div
              className="orientation-stage"
              aria-label="Live controller orientation"
            >
              <div
                className="orientation-object"
                style={{
                  transform: `rotateX(${-snapshot.motion.orientation.x}deg) rotateY(${snapshot.motion.orientation.y}deg) rotateZ(${snapshot.motion.orientation.z}deg)`,
                }}
              >
                <img
                  className="orientation-controller"
                  src="/ps5-controller-gyro-clean.png"
                  alt=""
                  draggable={false}
                />
              </div>
              <i className="horizon-line" />
            </div>
            <Vector
              label="Fused orientation"
              value={snapshot.motion.orientation}
              suffix="°"
            />
            <button
              type="button"
              className="secondary-action compact"
              onClick={diagnostic.recenterOrientation}
              disabled={!snapshot.connected}
            >
              Recenter orientation
            </button>
          </article>
          <article className="panel sensor-panel">
            <Vector
              label="Gyroscope"
              value={snapshot.motion.gyro}
              scale={2000}
              suffix="°/s"
            />
            <Vector
              label="Accelerometer"
              value={snapshot.motion.accelerometer}
              scale={4}
              suffix="g"
            />
            <div className="sensor-meta">
              <span>Sensor timestamp</span>
              <code>{snapshot.motion.sensorTimestamp || '—'}</code>
            </div>
          </article>
          <article className="panel calibration-panel">
            <span className="panel-kicker">Stationary gyro check</span>
            <h3>Place it flat and do not touch it.</h3>
            <p>
              A two-second sample measures noise and bias, then resets the
              session orientation. It never writes to controller firmware.
            </p>
            {calibration.status === 'sampling' && (
              <div className="calibration-progress">
                <span style={{ width: `${calibration.progress * 100}%` }} />
              </div>
            )}
            <div className={`calibration-result ${calibration.status}`}>
              <strong>{calibration.message}</strong>
              {calibration.noiseRms !== null && (
                <small>
                  Noise RMS {calibration.noiseRms.toFixed(2)}°/s
                  {calibration.mean &&
                    ` · bias ${Math.hypot(
                      calibration.mean.x,
                      calibration.mean.y,
                      calibration.mean.z,
                    ).toFixed(2)}°/s`}
                </small>
              )}
            </div>
            <button
              type="button"
              className="primary-action compact"
              onClick={diagnostic.calibrate}
              disabled={
                !snapshot.connected || calibration.status === 'sampling'
              }
            >
              {calibration.status === 'sampling'
                ? 'Sampling…'
                : 'Check and zero gyro'}
            </button>
          </article>
        </div>
      </section>

      <section className="section-block output-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">05 / PHYSICAL OUTPUT</span>
            <h2>Features the browser cannot self-verify</h2>
          </div>
          <button
            type="button"
            className="reset-output"
            onClick={diagnostic.resetOutputs}
            disabled={!snapshot.connected}
          >
            Stop and reset all effects
          </button>
        </div>
        <p className="section-lead">
          Run each test, then tell the diagnostic what you physically felt.
          Effects always stop automatically.
        </p>
        <div className="output-grid">
          <article className="panel output-card">
            <span className="output-number">A</span>
            <span className="panel-kicker">Haptic output</span>
            <h3>Haptic pulse sequence</h3>
            <p>
              Four pulses should build from a faint tick into one strong final
              pulse, confirming the intensity range.
            </p>
            <button
              type="button"
              className="test-action"
              onClick={diagnostic.testHaptics}
              disabled={
                !snapshot.connected || diagnostic.runningTest !== null
              }
            >
              {diagnostic.runningTest === 'haptics'
                ? 'Playing pattern…'
                : 'Play haptic pattern'}
            </button>
            <Confirmation
              value={outputResults.haptics}
              disabled={!diagnostic.outputAttempts.haptics}
              onChange={(result) =>
                diagnostic.confirmOutput('haptics', result)
              }
            />
          </article>
          <article className="panel output-card">
            <span className="output-number">B</span>
            <span className="panel-kicker">Trigger output</span>
            <h3>Adaptive trigger resistance</h3>
            <p>
              For seven seconds, repeatedly pull L2 and R2. R2 should feel
              distinctly heavier than L2.
            </p>
            <button
              type="button"
              className="test-action"
              onClick={diagnostic.testTriggers}
              disabled={
                !snapshot.connected || diagnostic.runningTest !== null
              }
            >
              {diagnostic.runningTest === 'triggers'
                ? 'Pull both triggers now…'
                : 'Test adaptive triggers'}
            </button>
            <Confirmation
              value={outputResults.triggers}
              disabled={!diagnostic.outputAttempts.triggers}
              onChange={(result) =>
                diagnostic.confirmOutput('triggers', result)
              }
            />
          </article>
        </div>
      </section>

      <section className={`final-result ${overallTone}`}>
        <div>
          <span className="eyebrow">TEST SUMMARY</span>
          <h2>
            {allRequiredTestsPassed
              ? 'This controller passed every required test.'
              : explicitFailure
                ? 'A required physical output was reported as failed.'
                : 'Complete the remaining controller tests.'}
          </h2>
          <p>
            {allRequiredTestsPassed
              ? 'Copy the JSON report to save or share the verified device details.'
              : 'Live input observations and manual output confirmations are combined into one portable report.'}
          </p>
        </div>
        <div className="final-score">
          <strong>
            {passedTests}/{tests.length}
          </strong>
          <button type="button" onClick={copyReport}>
            {copied ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </section>

      <section className="open-source-section">
        <div className="open-source-heading">
          <span className="eyebrow">OPEN-SOURCE FOUNDATION</span>
          <h2>Built to inspect, fork, and extend.</h2>
          <p>
            Every test panel uses the same exported PS5Controller intended for
            installed applications. New controls and game systems build on a
            hardware path already exercised here.
          </p>
        </div>
        <div className="project-principles">
          <article>
            <span>01</span>
            <h3>Local by design</h3>
            <p>Controller reports stay in your browser. There is no backend.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Safe hardware access</h3>
            <p>Every physical effect has explicit controls and cleanup paths.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Ready to build on</h3>
            <p>Typed core client, optional React hook, and integration guides.</p>
          </article>
        </div>
      </section>
        </>
      ) : (
        <DeveloperGuide />
      )}

      <ControllerConnectDialog
        open={connectDialogOpen}
        connecting={diagnostic.connecting}
        error={diagnostic.error}
        webHIDSupported={webHIDSupported}
        secureContext={secureContext}
        snapshot={snapshot}
        onConnect={() => void diagnostic.connect()}
        onClose={() => setConnectDialogOpen(false)}
        onContinue={continueToTests}
      />

      <footer>
        <span>PS5 CONTROLLER TESTER / WEBHID PACKAGE</span>
        <span>Local only · no telemetry · unofficial project</span>
      </footer>
    </main>
  )
}
