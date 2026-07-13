import {
  Dualsense,
  WebHIDProvider,
  type TriggerFeedbackConfig,
} from 'dualsense-ts'
import {
  createNeutralSnapshot,
  type DualSenseClientOptions,
  type DualSenseSide,
  type DualSenseSnapshot,
  type DualSenseSupport,
  type ErrorListener,
  type SnapshotListener,
} from './types'

const degrees = (radians: number) => (radians * 180) / Math.PI
const clamp = (value: number) => Math.min(1, Math.max(0, value))
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export function getDualSenseSupport(): DualSenseSupport {
  const webHID = typeof navigator !== 'undefined' && 'hid' in navigator
  const secureContext =
    typeof window !== 'undefined' && window.isSecureContext

  return {
    webHID,
    secureContext,
    supported: webHID && secureContext,
  }
}

function readController(controller: Dualsense): DualSenseSnapshot {
  const connected = controller.connection.active
  const firmware = controller.firmwareInfo.mainFirmwareVersion
  const providerDevice = controller.hid.provider.device
  const productName =
    providerDevice && 'productName' in providerDevice
      ? providerDevice.productName
      : 'DualSense'
  const quaternion = controller.orientation.quaternion

  return {
    connected,
    transport: connected
      ? controller.wireless
        ? 'Bluetooth'
        : 'USB'
      : 'Disconnected',
    limited: controller.hid.provider.limited ?? false,
    identityReady: controller.hid.ready,
    productName,
    serialNumber: controller.factoryInfo.serialNumber,
    boardRevision: controller.factoryInfo.boardRevision,
    firmware:
      firmware.major || firmware.minor || firmware.patch
        ? `${firmware.major}.${firmware.minor}.${firmware.patch}`
        : '',
    sticks: {
      left: {
        x: controller.left.analog.x.state,
        y: controller.left.analog.y.state,
      },
      right: {
        x: controller.right.analog.x.state,
        y: controller.right.analog.y.state,
      },
    },
    triggers: {
      left: controller.left.trigger.pressure,
      right: controller.right.trigger.pressure,
    },
    buttons: {
      cross: controller.cross.state,
      circle: controller.circle.state,
      square: controller.square.state,
      triangle: controller.triangle.state,
      dpadUp: controller.dpad.up.state,
      dpadRight: controller.dpad.right.state,
      dpadDown: controller.dpad.down.state,
      dpadLeft: controller.dpad.left.state,
      l1: controller.left.bumper.state,
      r1: controller.right.bumper.state,
      l2Digital: controller.left.trigger.button.state,
      r2Digital: controller.right.trigger.button.state,
      l3: controller.left.analog.button.state,
      r3: controller.right.analog.button.state,
      create: controller.create.state,
      options: controller.options.state,
      touchpad: controller.touchpad.button.state,
      mute: controller.mute.state,
      ps: controller.ps.state,
    },
    motion: {
      gyro: {
        x: controller.gyroscope.x.state,
        y: controller.gyroscope.y.state,
        z: controller.gyroscope.z.state,
      },
      accelerometer: {
        x: controller.accelerometer.x.state,
        y: controller.accelerometer.y.state,
        z: controller.accelerometer.z.state,
      },
      orientation: {
        x: degrees(controller.orientation.pitch),
        y: degrees(controller.orientation.yaw),
        z: degrees(controller.orientation.roll),
      },
      quaternion: [
        quaternion[0],
        quaternion[1],
        quaternion[2],
        quaternion[3],
      ],
      sensorTimestamp: controller.sensorTimestamp,
    },
    touchpad: {
      primary: {
        active: controller.touchpad.left.contact.state,
        id: controller.touchpad.left.tracker.state,
        x: controller.touchpad.left.x.state,
        y: controller.touchpad.left.y.state,
      },
      secondary: {
        active: controller.touchpad.right.contact.state,
        id: controller.touchpad.right.tracker.state,
        x: controller.touchpad.right.x.state,
        y: controller.touchpad.right.y.state,
      },
    },
    battery: {
      level: controller.battery.level.state,
      status: controller.battery.status.state,
    },
  }
}

/**
 * Framework-independent DualSense WebHID client.
 *
 * PS5 Controller Tester uses this exact class for its hardware tests. Games
 * can subscribe to snapshots or call `read()` from their own frame loop.
 */
export class DualSenseClient {
  readonly support = getDualSenseSupport()

  private controller: Dualsense | null = null
  private currentSnapshot = createNeutralSnapshot()
  private readonly snapshotListeners = new Set<SnapshotListener>()
  private readonly errorListeners = new Set<ErrorListener>()
  private readonly frameInterval: number
  private frame = 0
  private lastFrameTime = 0
  private lastError: Error | null = null
  private disposed = false
  private unsubscribeConnection: (() => void) | null = null

  constructor(options: DualSenseClientOptions = {}) {
    const pollRateHz = Math.min(240, Math.max(1, options.pollRateHz ?? 60))
    this.frameInterval = 1000 / pollRateHz

    if (!this.support.supported) return

    try {
      this.controller = new Dualsense({
        left: { analog: { deadzone: options.stickDeadzone ?? 0.04 } },
        right: { analog: { deadzone: options.stickDeadzone ?? 0.04 } },
        orientation: { beta: options.orientationBeta ?? 0.08 },
      })
      this.controller.hid.on('error', (error) => this.publishError(error))
      this.unsubscribeConnection = this.controller.hid.onConnectionChange(() =>
        this.publishSnapshot(),
      )
      window.addEventListener('pagehide', this.handlePageExit)
      this.frame = window.requestAnimationFrame(this.poll)
    } catch (caught) {
      this.publishError(
        caught instanceof Error
          ? caught
          : new Error('Could not initialize the DualSense WebHID client.'),
      )
    }
  }

  /** Latest cached state, updated at the configured polling rate. */
  get current(): DualSenseSnapshot {
    return this.currentSnapshot
  }

  /** Request browser device permission. Must be called from a user gesture. */
  async connect(): Promise<void> {
    if (!this.support.webHID) {
      throw new Error(
        'WebHID is unavailable. Use desktop Chrome, Edge, or Opera.',
      )
    }
    if (!this.support.secureContext) {
      throw new Error('WebHID requires localhost or HTTPS.')
    }
    if (!this.controller) {
      throw new Error('The DualSense client could not be initialized.')
    }
    if (!(this.controller.hid.provider instanceof WebHIDProvider)) {
      throw new Error('The active controller provider is not WebHID.')
    }

    await this.controller.hid.provider.getRequest()()
  }

  /** Read fresh state synchronously. Useful inside a game frame loop. */
  read(): DualSenseSnapshot {
    if (this.controller) {
      this.currentSnapshot = readController(this.controller)
    }
    return this.currentSnapshot
  }

  /** Subscribe to normalized snapshots. The current snapshot fires immediately. */
  subscribe(listener: SnapshotListener, emitCurrent = true): () => void {
    this.snapshotListeners.add(listener)
    if (emitCurrent) listener(this.currentSnapshot)
    return () => this.snapshotListeners.delete(listener)
  }

  /** Subscribe to initialization, permission, and HID transport errors. */
  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener)
    if (this.lastError) listener(this.lastError)
    return () => this.errorListeners.delete(listener)
  }

  /** Set independent left/right haptic intensity from 0 to 1. */
  setRumble(left: number, right: number): void {
    if (!this.controller?.connection.active) return
    this.controller.left.rumble(clamp(left))
    this.controller.right.rumble(clamp(right))
  }

  /** Play a bounded haptic pulse and always stop afterward. */
  async pulseRumble(
    left: number,
    right: number,
    durationMs: number,
  ): Promise<void> {
    this.setRumble(left, right)
    try {
      await wait(Math.max(0, durationMs))
    } finally {
      this.setRumble(0, 0)
    }
  }

  /** Apply one of dualsense-ts's typed adaptive-trigger effects. */
  setTriggerFeedback(
    side: DualSenseSide,
    config: TriggerFeedbackConfig,
  ): void {
    if (!this.controller?.connection.active) return
    this.controller[side].trigger.feedback.set(config)
  }

  /** Return both adaptive triggers to their normal linear feel. */
  resetTriggerFeedback(): void {
    this.controller?.resetTriggerFeedback()
  }

  /** Stop haptics and clear adaptive-trigger effects. */
  resetOutputs(): void {
    if (!this.controller) return
    this.controller.rumble(0)
    this.controller.resetTriggerFeedback()
  }

  /** Set the controller's current fused orientation as the session neutral. */
  resetOrientation(): void {
    this.controller?.orientation.reset()
  }

  /** Release listeners, animation frames, HID resources, and outputs. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageExit)
      window.cancelAnimationFrame(this.frame)
    }
    this.unsubscribeConnection?.()
    this.unsubscribeConnection = null
    this.resetOutputs()
    this.controller?.dispose()
    this.controller = null
    this.snapshotListeners.clear()
    this.errorListeners.clear()
  }

  private readonly handlePageExit = () => {
    this.resetOutputs()
  }

  private readonly poll = (time: number) => {
    if (this.disposed) return
    if (time - this.lastFrameTime >= this.frameInterval) {
      this.publishSnapshot()
      this.lastFrameTime = time
    }
    this.frame = window.requestAnimationFrame(this.poll)
  }

  private publishSnapshot(): void {
    const snapshot = this.read()
    for (const listener of this.snapshotListeners) listener(snapshot)
  }

  private publishError(error: Error): void {
    this.lastError = error
    for (const listener of this.errorListeners) listener(error)
  }
}
