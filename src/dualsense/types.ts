import { ChargeStatus } from 'dualsense-ts'

export const DUALSENSE_BUTTONS = [
  { key: 'cross', label: 'Cross' },
  { key: 'circle', label: 'Circle' },
  { key: 'square', label: 'Square' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'dpadUp', label: 'D-pad up' },
  { key: 'dpadRight', label: 'D-pad right' },
  { key: 'dpadDown', label: 'D-pad down' },
  { key: 'dpadLeft', label: 'D-pad left' },
  { key: 'l1', label: 'L1' },
  { key: 'r1', label: 'R1' },
  { key: 'l2Digital', label: 'L2 digital' },
  { key: 'r2Digital', label: 'R2 digital' },
  { key: 'l3', label: 'L3 / left stick press' },
  { key: 'r3', label: 'R3 / right stick press' },
  { key: 'create', label: 'Create' },
  { key: 'options', label: 'Options' },
  { key: 'touchpad', label: 'Touchpad press' },
  { key: 'mute', label: 'Mute' },
  { key: 'ps', label: 'PS' },
] as const

export type DualSenseButton = (typeof DUALSENSE_BUTTONS)[number]['key']
export type DualSenseButtonState = Record<DualSenseButton, boolean>
export type DualSenseSide = 'left' | 'right'
export type DualSenseTransport = 'Bluetooth' | 'USB' | 'Disconnected'

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface TouchPoint extends Vec2 {
  active: boolean
  id: number
}

export interface DualSenseSnapshot {
  connected: boolean
  transport: DualSenseTransport
  limited: boolean
  identityReady: boolean
  productName: string
  serialNumber: string
  boardRevision: string
  firmware: string
  sticks: {
    left: Vec2
    right: Vec2
  }
  triggers: {
    left: number
    right: number
  }
  buttons: DualSenseButtonState
  motion: {
    gyro: Vec3
    accelerometer: Vec3
    orientation: Vec3
    quaternion: readonly [number, number, number, number]
    sensorTimestamp: number
  }
  touchpad: {
    primary: TouchPoint
    secondary: TouchPoint
  }
  battery: {
    level: number
    status: ChargeStatus
  }
}

export interface DualSenseClientOptions {
  pollRateHz?: number
  stickDeadzone?: number
  orientationBeta?: number
}

export interface DualSenseSupport {
  webHID: boolean
  secureContext: boolean
  supported: boolean
}

export type SnapshotListener = (snapshot: DualSenseSnapshot) => void
export type ErrorListener = (error: Error) => void

export function createNeutralButtonState(): DualSenseButtonState {
  return Object.fromEntries(
    DUALSENSE_BUTTONS.map(({ key }) => [key, false]),
  ) as DualSenseButtonState
}

export function createNeutralSnapshot(): DualSenseSnapshot {
  return {
    connected: false,
    transport: 'Disconnected',
    limited: false,
    identityReady: false,
    productName: 'DualSense',
    serialNumber: '',
    boardRevision: '',
    firmware: '',
    sticks: {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    },
    triggers: {
      left: 0,
      right: 0,
    },
    buttons: createNeutralButtonState(),
    motion: {
      gyro: { x: 0, y: 0, z: 0 },
      accelerometer: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0 },
      quaternion: [1, 0, 0, 0],
      sensorTimestamp: 0,
    },
    touchpad: {
      primary: { active: false, id: 0, x: 0, y: 0 },
      secondary: { active: false, id: 0, x: 0, y: 0 },
    },
    battery: {
      level: 0,
      status: ChargeStatus.Discharging,
    },
  }
}
