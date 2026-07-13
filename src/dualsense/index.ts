export { ChargeStatus, TriggerEffect } from 'dualsense-ts'
export type { TriggerFeedbackConfig } from 'dualsense-ts'

export {
  DualSenseClient,
  DualSenseClient as PS5Controller,
  getDualSenseSupport,
} from './DualSenseClient'
export {
  DUALSENSE_BUTTONS,
  createNeutralButtonState,
  createNeutralSnapshot,
} from './types'
export type {
  DualSenseButton,
  DualSenseButton as PS5ControllerButton,
  DualSenseButtonState,
  DualSenseClientOptions,
  DualSenseClientOptions as PS5ControllerOptions,
  DualSenseSide,
  DualSenseSnapshot,
  DualSenseSnapshot as PS5ControllerState,
  DualSenseSupport,
  DualSenseTransport,
  ErrorListener,
  SnapshotListener,
  TouchPoint,
  Vec2,
  Vec3,
} from './types'
