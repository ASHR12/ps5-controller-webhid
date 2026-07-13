import { useState } from 'react'

const BUTTONS = [
  ['cross', 'Cross'],
  ['circle', 'Circle'],
  ['square', 'Square'],
  ['triangle', 'Triangle'],
  ['dpadUp', 'D-pad up'],
  ['dpadRight', 'D-pad right'],
  ['dpadDown', 'D-pad down'],
  ['dpadLeft', 'D-pad left'],
  ['l1', 'L1'],
  ['r1', 'R1'],
  ['l2Digital', 'L2 digital'],
  ['r2Digital', 'R2 digital'],
  ['l3', 'Left stick press'],
  ['r3', 'Right stick press'],
  ['create', 'Create'],
  ['options', 'Options'],
  ['touchpad', 'Touchpad press'],
  ['mute', 'Mute'],
  ['ps', 'PS button'],
] as const

const INSTALL = `npm install ps5-controller-webhid`

const QUICK_START = `import { PS5Controller } from 'ps5-controller-webhid'

const controller = new PS5Controller({ pollRateHz: 60 })

controller.onError(console.error)

// connect() must run from a click or another user gesture.
connectButton.addEventListener('click', async () => {
  await controller.connect()
})

const unsubscribe = controller.subscribe((input) => {
  if (!input.connected) return

  console.log(input.transport)
  console.log(input.sticks.left)
  console.log(input.triggers.right)
  console.log(input.buttons.cross)
  console.log(input.motion.orientation)
})

// When the owning experience shuts down:
unsubscribe()
controller.dispose()`

const FRAME_LOOP = `function update() {
  const input = controller.read()

  if (input.connected) {
    player.moveX = input.sticks.left.x
    player.moveY = input.sticks.left.y
    player.thrust = input.triggers.right
    player.brake = input.triggers.left
    player.interact = input.buttons.cross

    const { x: pitch, y: yaw, z: roll } =
      input.motion.orientation
  }

  requestAnimationFrame(update)
}

update()`

const REACT = `import {
  PS5Controller,
  usePS5Controller,
} from 'ps5-controller-webhid/react'

// Create one shared client outside the render path.
const controller = new PS5Controller()

export function ControllerStatus() {
  const input = usePS5Controller(controller)

  return (
    <>
      <button onClick={() => controller.connect()}>
        Connect controller
      </button>
      <p>{input.connected ? input.transport : 'Disconnected'}</p>
      <p>R2: {Math.round(input.triggers.right * 100)}%</p>
    </>
  )
}`

const RAPIER = `import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { PS5Controller } from 'ps5-controller-webhid'

const controller = new PS5Controller({ pollRateHz: 120 })

export function FlightInput() {
  const body = useRef<RapierRigidBody>(null)

  useFrame(() => {
    const input = controller.read()
    if (!input.connected || !body.current) return

    const thrust = input.triggers.right - input.triggers.left

    body.current.addForce({
      x: input.sticks.left.x * 8,
      y: -input.sticks.left.y * 8,
      z: -thrust * 14,
    }, true)

    const rotation = input.motion.orientation
    body.current.addTorque({
      x: -rotation.x * 0.02,
      y: -rotation.y * 0.02,
      z: -rotation.z * 0.02,
    }, true)
  })

  return null
}`

const OUTPUTS = `import {
  PS5Controller,
  TriggerEffect,
} from 'ps5-controller-webhid'

const controller = new PS5Controller()

// Independent left/right haptic intensity, 0–1.
controller.setRumble(0.8, 0.4)
controller.setRumble(0, 0)

// A bounded pulse that stops automatically.
await controller.pulseRumble(0.8, 0.5, 250)

// Adaptive resistance on R2.
controller.setTriggerFeedback('right', {
  effect: TriggerEffect.Feedback,
  position: 0.2,
  strength: 0.85,
})

// Always clear physical effects on exit or pause.
controller.resetOutputs()`

const PACKAGE_EXPORTS = `import {
  PS5Controller,
  getDualSenseSupport,
  DUALSENSE_BUTTONS,
  TriggerEffect,
  type PS5ControllerState,
  type PS5ControllerButton,
  type PS5ControllerOptions,
} from 'ps5-controller-webhid'

import {
  usePS5Controller,
} from 'ps5-controller-webhid/react'`

interface CodeBlockProps {
  title: string
  code: string
}

function CodeBlock({ title, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>{title}</span>
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function DeveloperGuide() {
  return (
    <div className="developer-guide">
      <section className="developer-hero">
        <div>
          <span className="eyebrow">DEVELOPER GUIDE / PACKAGE API</span>
          <h1>Install once. Read every PS5 controller signal by name.</h1>
          <p>
            The tester and npm package use the same PS5Controller class. When a
            capability passes in the tester, this is the API path your
            application will use.
          </p>
          <div className="developer-badges">
            <span>Typed API</span>
            <span>Framework independent</span>
            <span>Optional React hook</span>
            <span>Bluetooth + USB</span>
          </div>
        </div>
        <CodeBlock title="Install from npm" code={INSTALL} />
      </section>

      <aside className="package-notice">
        <strong>Publication status</strong>
        <p>
          The package build is ready locally as version 0.1.0. The install
          command becomes publicly available after the first npm publish.
        </p>
      </aside>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>01</span>
          <div>
            <h2>Connect and subscribe</h2>
            <p>
              Browser permission must start from a user gesture. After that,
              subscribe to typed snapshots or read synchronously in a frame
              loop.
            </p>
          </div>
        </div>
        <div className="developer-code-grid">
          <CodeBlock title="TypeScript quick start" code={QUICK_START} />
          <CodeBlock title="Game-loop polling" code={FRAME_LOOP} />
        </div>
      </section>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>02</span>
          <div>
            <h2>Every button has a stable name</h2>
            <p>
              Use <code>input.buttons.name</code>. No browser button indexes or
              platform-specific lookup tables are required.
            </p>
          </div>
        </div>
        <div className="developer-button-reference">
          {BUTTONS.map(([key, label]) => (
            <article key={key}>
              <strong>{label}</strong>
              <code>input.buttons.{key}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>03</span>
          <div>
            <h2>Normalized state reference</h2>
            <p>
              One snapshot contains connection, identity, inputs, motion,
              touch, and battery information.
            </p>
          </div>
        </div>
        <div className="state-reference">
          <article>
            <span>Analog</span>
            <code>sticks.left/right.x/y</code>
            <small>−1 to 1</small>
            <code>triggers.left/right</code>
            <small>0 to 1</small>
          </article>
          <article>
            <span>Motion</span>
            <code>motion.gyro</code>
            <small>normalized raw axes</small>
            <code>motion.orientation</code>
            <small>pitch, yaw, roll in degrees</small>
            <code>motion.quaternion</code>
            <small>[w, x, y, z]</small>
          </article>
          <article>
            <span>Device</span>
            <code>connected / transport</code>
            <small>Bluetooth, USB, disconnected</small>
            <code>battery.level / status</code>
            <small>charge information</small>
            <code>firmware / boardRevision</code>
            <small>hardware identity</small>
          </article>
          <article>
            <span>Touchpad</span>
            <code>touchpad.primary</code>
            <small>contact, ID, x, y</small>
            <code>touchpad.secondary</code>
            <small>second touch point</small>
          </article>
        </div>
      </section>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>04</span>
          <div>
            <h2>React and React Three Fiber</h2>
            <p>
              Use the optional React entry for interfaces. Read directly in
              useFrame for high-frequency physics input.
            </p>
          </div>
        </div>
        <div className="developer-code-grid">
          <CodeBlock title="React subscription" code={REACT} />
          <CodeBlock title="R3F + Rapier flight input" code={RAPIER} />
        </div>
      </section>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>05</span>
          <div>
            <h2>Haptics and adaptive triggers</h2>
            <p>
              Physical output methods are typed and bounded. Reset effects when
              pausing, changing scenes, or leaving the page.
            </p>
          </div>
        </div>
        <CodeBlock title="Physical outputs" code={OUTPUTS} />
      </section>

      <section className="developer-section">
        <div className="developer-section-heading">
          <span>06</span>
          <div>
            <h2>Exports and lifecycle</h2>
            <p>
              The core entry has no React requirement. The React hook is
              isolated under <code>/react</code>.
            </p>
          </div>
        </div>
        <div className="developer-code-grid compact-grid">
          <CodeBlock title="Public exports" code={PACKAGE_EXPORTS} />
          <div className="lifecycle-card">
            <h3>Required lifecycle rules</h3>
            <ol>
              <li>Create one client per physical controller.</li>
              <li>Call connect from a click or user gesture.</li>
              <li>Use localhost or HTTPS in Chrome or Edge.</li>
              <li>Call resetOutputs on pause and focus loss.</li>
              <li>Call dispose when the owner unmounts.</li>
              <li>Do not open competing WebHID tester tabs.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  )
}
