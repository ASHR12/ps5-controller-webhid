# ps5-controller-webhid

**Unofficial, typed WebHID implementation for PS5 DualSense controllers.**

Use named buttons, sticks, triggers, motion sensors, touch contacts, battery
state, adaptive triggers, and haptic feedback without implementing Sony HID
reports or guessing browser gamepad indexes.

The repository also includes **PS5 Controller Tester**, a live utility that
consumes the exact same public client exported by the package.

## Install

```bash
npm install ps5-controller-webhid
```

The package is browser-only and requires WebHID in a secure context
(`localhost` or HTTPS).

## Minimal usage

```ts
import { PS5Controller } from 'ps5-controller-webhid'

const controller = new PS5Controller({ pollRateHz: 60 })

controller.onError(console.error)

// WebHID permission requests must run inside a user gesture.
connectButton.addEventListener('click', () => controller.connect())

controller.subscribe((input) => {
  if (!input.connected) return

  console.log(input.transport)
  console.log(input.sticks.left)
  console.log(input.triggers.right)
  console.log(input.buttons.cross)
  console.log(input.motion.orientation)
})
```

For a game loop, call `controller.read()` synchronously instead of subscribing.

## React

React is an optional peer dependency and is isolated in a subpath export:

```tsx
import {
  PS5Controller,
  usePS5Controller,
} from 'ps5-controller-webhid/react'

const controller = new PS5Controller()

export function ControllerStatus() {
  const input = usePS5Controller(controller)

  return (
    <>
      <button onClick={() => controller.connect()}>Connect controller</button>
      <span>{input.connected ? input.transport : 'Disconnected'}</span>
    </>
  )
}
```

Create one client outside the component render path and call `dispose()` when
the owning application shuts down.

### Complete React + Vite example

See [`examples/react-vite`](examples/react-vite) for a standalone application
that installs the published npm package and displays live buttons, sticks,
triggers, motion, device details, and haptic controls.

## Outputs

```ts
import {
  PS5Controller,
  TriggerEffect,
} from 'ps5-controller-webhid'

const controller = new PS5Controller()

controller.setRumble(0.8, 0.4)
await controller.pulseRumble(0.8, 0.4, 250)

controller.setTriggerFeedback('right', {
  effect: TriggerEffect.Feedback,
  position: 0.2,
  strength: 0.85,
})

controller.resetOutputs()
```

`dispose()` also stops haptics and resets both adaptive triggers.

## Normalized state

`PS5ControllerState` includes:

- `connected`, `transport`, and report capability status
- `sticks.left/right.x/y` from `-1` to `1` (`+x` right, `+y` up)
- `triggers.left/right` from `0` to `1`
- named digital inputs in `buttons`
- calibrated gyroscope and accelerometer axes
- fused Euler orientation and quaternion
- two touchpad contacts
- battery and charging state
- product, board revision, firmware, and serial identity

The full runtime button list is exported as `DUALSENSE_BUTTONS`. Types are
available as `PS5ControllerButton`, `PS5ControllerOptions`, and
`PS5ControllerState`.

## Detailed integration

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md) for:

- plain TypeScript integration
- React subscription patterns
- React Three Fiber and Rapier flight input
- complete state units and ranges
- haptic and adaptive-trigger examples
- lifecycle and cleanup requirements

## Run the tester

```bash
npm install
npm run dev
```

Open the localhost URL in desktop Chrome or Edge, connect the controller, and
complete the required tests. The tester generates a local JSON report with the
browser, transport, firmware, board revision, observed inputs, motion check,
and physical output confirmations.

## Bluetooth pairing on macOS

1. Disconnect the USB cable.
2. Hold **Create** and the **PS logo button** until the blue lights flash.
3. Connect **DualSense Wireless Controller** in macOS Bluetooth settings.
4. Select **Find PS5 controller**, then choose the controller in Chrome's
   secure WebHID picker.

Bluetooth supports the package inputs, motion sensors, adaptive triggers, and
haptic output.

## Build the npm package

```bash
npm run build:package
```

Generated package files are written to `lib/`:

- ESM: `index.js` and `react.js`
- CommonJS: `index.cjs` and `react.cjs`
- TypeScript declarations and source maps

Inspect exactly what npm would publish:

```bash
npm run pack:check
```

The tester production build is separate:

```bash
npm run build:tester
```

Run every repository check with:

```bash
npm run check
```

## Deploy the tester to Vercel

Import the GitHub repository into Vercel and use:

- Framework preset: **Vite**
- Build command: `npm run build:tester`
- Output directory: `dist`

No environment variables are required. Vercel provides HTTPS, which satisfies
WebHID's secure-context requirement. Device permission must still be requested
from a user click.

## Source layout

```text
src/
  dualsense/       Published framework-independent client and React entry
  diagnostics/     Tester-only pass/fail workflow
  components/      Tester interface
docs/
  INTEGRATION.md   Copy-ready application examples
public/
  ps5-controller-hero.jpg
  ps5-controller-gyro-clean.png
```

## Support

The current release targets a standard DualSense controller in desktop
Chromium browsers. DualSense Edge, DualSense Access, DualShock 4, Safari, and
Firefox are not currently supported.

The Bluetooth path has been physically verified on a BDM-050 controller with
firmware 1.15.10 using Chrome 150 on macOS. Hardware and browser combinations
still need their own testing.

## Privacy and safety

Controller data stays in the browser. The package and tester contain no
backend, analytics, telemetry, advertising, or AI integration.

WebHID access requires an explicit user action. Avoid opening multiple WebHID
controller tools simultaneously, and always call `resetOutputs()` or
`dispose()` when leaving an experience.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes to the public client should be
validated through the tester because it consumes the same hardware path.

This package builds on
[`dualsense-ts`](https://github.com/nsfm/dualsense-ts), distributed under
LGPL-3.0.

## License and trademark notice

The wrapper code is released under the [MIT License](LICENSE).

DualSense, PlayStation, and PS5 are trademarks of Sony Interactive
Entertainment. `ps5-controller-webhid` and PS5 Controller Tester are
independent community projects and are not affiliated with or endorsed by Sony
Interactive Entertainment.
