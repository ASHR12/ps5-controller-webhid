# Integrating ps5-controller-webhid

PS5 Controller Tester and the npm package use the same `PS5Controller`. If an
input or output works in the tester, the code path used by an installed
application is already being exercised.

The reusable module lives in [`src/dualsense`](../src/dualsense):

- `DualSenseClient.ts` — framework-independent `PS5Controller` implementation
- `types.ts` — normalized snapshots and complete button names
- `useDualSense.ts` — optional React subscription
- `index.ts` — public exports

## Add it to another project

```bash
npm install ps5-controller-webhid
```

The framework-independent entry has no React requirement. React consumers use
the optional `ps5-controller-webhid/react` entry. Contributors can also copy
`src/dualsense` directly when experimenting with the source.

## Minimal browser integration

```ts
import { PS5Controller } from 'ps5-controller-webhid'

const controller = new PS5Controller({ pollRateHz: 60 })

controller.onError(console.error)

// WebHID requires connect() to run inside a user gesture.
document.querySelector('#connect')?.addEventListener('click', async () => {
  await controller.connect()
})

const unsubscribe = controller.subscribe((input) => {
  if (!input.connected) return

  const moveX = input.sticks.left.x
  const moveY = input.sticks.left.y
  const thrust = input.triggers.right
  const brake = input.triggers.left
  const interact = input.buttons.cross
  const { x: pitch, y: yaw, z: roll } = input.motion.orientation

  updateGame({ moveX, moveY, thrust, brake, interact, pitch, yaw, roll })
})

window.addEventListener('pagehide', () => {
  unsubscribe()
  controller.dispose()
})
```

Create only one client for each physical controller. A second WebHID tool or
tab can compete for the same device.

## Reading in a game loop

Subscriptions are convenient for interfaces. A game can read synchronously in
its existing frame loop:

```ts
function frame() {
  const input = controller.read()

  if (input.connected) {
    player.thrust = input.triggers.right - input.triggers.left
    player.strafe = input.sticks.left.x
    player.pitch = input.motion.orientation.x
    player.yaw = input.motion.orientation.y
    player.roll = input.motion.orientation.z
  }

  requestAnimationFrame(frame)
}
```

## React integration

Create the client outside the component render path so React development
remounts cannot claim the HID device twice:

```tsx
import { useEffect } from 'react'
import {
  PS5Controller,
  usePS5Controller,
} from 'ps5-controller-webhid/react'

const controller = new PS5Controller()

export function ControllerStatus() {
  const input = usePS5Controller(controller)

  useEffect(() => () => controller.dispose(), [])

  return (
    <>
      <button onClick={() => controller.connect()}>Connect controller</button>
      <p>{input.connected ? input.transport : 'Disconnected'}</p>
      <p>R2: {Math.round(input.triggers.right * 100)}%</p>
    </>
  )
}
```

## React Three Fiber and Rapier

Read the client inside `useFrame`; do not route high-frequency flight input
through React component state:

```tsx
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { PS5Controller } from 'ps5-controller-webhid'

const controller = new PS5Controller({ pollRateHz: 120 })

export function PlayerFlightController() {
  const body = useRef<RapierRigidBody>(null)

  useFrame(() => {
    const input = controller.read()
    if (!input.connected || !body.current) return

    const forward = input.triggers.right - input.triggers.left
    body.current.addForce(
      {
        x: input.sticks.left.x * 8,
        y: -input.sticks.left.y * 8,
        z: -forward * 14,
      },
      true,
    )

    const orientation = input.motion.orientation
    body.current.addTorque(
      {
        x: -orientation.x * 0.02,
        y: -orientation.y * 0.02,
        z: -orientation.z * 0.02,
      },
      true,
    )
  })

  return null
}
```

Tune forces, deadzones, smoothing, and orientation recentering for the game.
The example intentionally keeps policy out of the reusable hardware layer.

## Haptics

```ts
// Independent continuous intensity, 0–1.
controller.setRumble(0.7, 0.35)
controller.setRumble(0, 0)

// Bounded pulse with automatic cleanup.
await controller.pulseRumble(0.8, 0.5, 250)
```

## Adaptive triggers

```ts
import { TriggerEffect } from 'ps5-controller-webhid'

controller.setTriggerFeedback('right', {
  effect: TriggerEffect.Feedback,
  position: 0.2,
  strength: 0.85,
})

controller.resetTriggerFeedback()
```

Call `resetOutputs()` when pausing, losing focus, disconnecting, or leaving the
experience. `dispose()` also resets outputs.

## Snapshot reference

Important normalized fields:

- `connected`, `transport`, `limited`
- `sticks.left/right.x/y` — `-1` to `1` (`+x` right, `+y` up)
- `triggers.left/right` — `0` to `1`
- `buttons` — every named DualSense digital input
- `motion.gyro` — normalized raw axes; multiply by `2000` for degrees/second
- `motion.accelerometer` — normalized raw axes; multiply by `4` for g
- `motion.orientation` — fused pitch, yaw, and roll in degrees
- `motion.quaternion` — fused orientation as `[w, x, y, z]`
- `touchpad.primary/secondary` — contact, ID, and normalized coordinates
- `battery.level` and `battery.status`
- identity fields for product, board revision, firmware, and serial number

The full button union is exported as `DualSenseButton`, and the runtime list is
exported as `DUALSENSE_BUTTONS`. This removes browser-index guessing from
application code.

## Verified hardware path

The Bluetooth path has been physically verified with:

- standard DualSense, board revision BDM-050
- firmware 1.15.10
- Chrome 150 on macOS
- full input reports, both sticks, both triggers, buttons
- gyroscope and accelerometer input
- adaptive-trigger resistance and haptic output

WebHID availability and behavior still depend on the browser, operating system,
controller revision, and firmware. PS5 Controller Tester's JSON report captures
those details for troubleshooting.
