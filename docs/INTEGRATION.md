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

## Lightbar and LEDs

```ts
import {
  Brightness,
  MuteLedMode,
  PlayerID,
} from 'ps5-controller-webhid'

// Lightbar color, 0–255 per channel.
controller.setLightbar({ r: 255, g: 64, b: 0 })

// Five player LEDs from a 5-bit mask; bit 0 is the leftmost LED.
controller.setPlayerLeds(PlayerID.Player1) // center LED, high brightness
controller.setPlayerLeds(0b10001, Brightness.Low) // outer LEDs, dimmed

// Override the mute button LED: Off, On, or Pulse.
controller.setMuteLed(MuteLedMode.Pulse)
```

- The same calls work over USB and Bluetooth.
- Lights can be set before `connect()` and are re-applied after a reconnect.
- Only changes are sent to the controller, so calling `setLightbar()` every
  frame is fine.
- Lightbar channels are clamped to `0`–`255` and rounded. `setPlayerLeds()`
  throws a `RangeError` for a mask outside `0`–`31` or an unknown brightness,
  and `setMuteLed()` throws one for an unknown mode.
- By default the controller toggles the mute LED with the mute button.
  `resetOutputs()` hands an overridden mute LED back to it.
- `RGBColor` types a `{ r, g, b }` color.

Show health on the lightbar, from green at full through yellow to red:

```ts
// health: 0 (empty) to 1 (full)
function showHealth(health: number) {
  controller.setLightbar({
    r: 255 * Math.min(1, 2 * (1 - health)),
    g: 255 * Math.min(1, 2 * health),
    b: 0,
  })
}

function frame() {
  showHealth(player.health / player.maxHealth)
  requestAnimationFrame(frame)
}
```

## Resetting outputs

Call `resetOutputs()` when pausing, losing focus, disconnecting, or leaving the
experience. It stops haptics and clears adaptive-trigger effects. Since 0.2.0
it also turns the lightbar off and clears the player LEDs, and a mute LED set
with `setMuteLed()` is switched off and handed back to the controller. Set the
lights again when play resumes; a game that sets the lightbar from its frame
loop does this automatically.

`dispose()` resets every output the same way.

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
