import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChargeStatus,
  PS5Controller,
  TriggerEffect,
  createNeutralSnapshot,
  getDualSenseSupport,
  type DualSenseButton,
  type DualSenseSnapshot,
  type Vec2,
  type Vec3,
} from 'ps5-controller-webhid'

export const BUTTONS = [
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
  { key: 'l2Digital', label: 'L2 click' },
  { key: 'r2Digital', label: 'R2 click' },
  { key: 'create', label: 'Create' },
  { key: 'options', label: 'Options' },
] as const satisfies ReadonlyArray<{ key: DualSenseButton; label: string }>

export type ButtonKey = (typeof BUTTONS)[number]['key']
export type ButtonState = Record<ButtonKey, boolean>
export type ControllerSnapshot = DualSenseSnapshot
export type OutputResult = 'untested' | 'pass' | 'fail'
export type RunningTest = 'haptics' | 'triggers' | null
export type { Vec2, Vec3 }

export interface ObservedInputs {
  leftStick: boolean
  rightStick: boolean
  leftTrigger: boolean
  rightTrigger: boolean
  gyro: boolean
  accelerometer: boolean
  buttons: ButtonState
}

export interface CalibrationResult {
  status: 'idle' | 'sampling' | 'pass' | 'warn' | 'error'
  progress: number
  mean: Vec3 | null
  noiseRms: number | null
  message: string
}

export interface OutputResults {
  haptics: OutputResult
  triggers: OutputResult
}

export interface OutputAttempts {
  haptics: boolean
  triggers: boolean
}

const makeButtonState = (): ButtonState =>
  Object.fromEntries(BUTTONS.map(({ key }) => [key, false])) as ButtonState

const EMPTY_OBSERVED: ObservedInputs = {
  leftStick: false,
  rightStick: false,
  leftTrigger: false,
  rightTrigger: false,
  gyro: false,
  accelerometer: false,
  buttons: makeButtonState(),
}

const INITIAL_CALIBRATION: CalibrationResult = {
  status: 'idle',
  progress: 0,
  mean: null,
  noiseRms: null,
  message: 'Not checked in this session.',
}

const magnitude2 = ({ x, y }: Vec2) => Math.hypot(x, y)
const magnitude3 = ({ x, y, z }: Vec3) => Math.hypot(x, y, z)
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

function collectObserved(
  previous: ObservedInputs,
  snapshot: DualSenseSnapshot,
): ObservedInputs {
  const buttons = { ...previous.buttons }
  for (const { key } of BUTTONS) {
    buttons[key] ||= snapshot.buttons[key]
  }

  return {
    leftStick:
      previous.leftStick || magnitude2(snapshot.sticks.left) > 0.35,
    rightStick:
      previous.rightStick || magnitude2(snapshot.sticks.right) > 0.35,
    leftTrigger:
      previous.leftTrigger || snapshot.triggers.left > 0.25,
    rightTrigger:
      previous.rightTrigger || snapshot.triggers.right > 0.25,
    gyro: previous.gyro || magnitude3(snapshot.motion.gyro) > 0.004,
    accelerometer:
      previous.accelerometer ||
      magnitude3(snapshot.motion.accelerometer) > 0.05,
    buttons,
  }
}

export function formatChargeStatus(status: ChargeStatus) {
  switch (status) {
    case ChargeStatus.Charging:
      return 'Charging'
    case ChargeStatus.Full:
      return 'Full'
    case ChargeStatus.AbnormalVoltage:
      return 'Voltage warning'
    case ChargeStatus.AbnormalTemperature:
      return 'Temperature warning'
    case ChargeStatus.ChargingError:
      return 'Charging error'
    default:
      return 'On battery'
  }
}

/**
 * Tester-specific pass/fail workflow layered on top of PS5Controller.
 *
 * Hardware access remains in the reusable client; this hook only records which
 * tests were observed and the user's confirmation of physical effects.
 */
export function usePS5ControllerDiagnostic() {
  const support = getDualSenseSupport()
  const clientRef = useRef<PS5Controller | null>(null)
  const mountedRef = useRef(true)
  const outputRunRef = useRef(0)
  const runningRef = useRef<RunningTest>(null)

  const [snapshot, setSnapshot] = useState(createNeutralSnapshot)
  const [observed, setObserved] = useState<ObservedInputs>(EMPTY_OBSERVED)
  const [calibration, setCalibration] =
    useState<CalibrationResult>(INITIAL_CALIBRATION)
  const [outputResults, setOutputResults] = useState<OutputResults>({
    haptics: 'untested',
    triggers: 'untested',
  })
  const [outputAttempts, setOutputAttempts] = useState<OutputAttempts>({
    haptics: false,
    triggers: false,
  })
  const [runningTest, setRunningTest] = useState<RunningTest>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    const client = new PS5Controller({
      pollRateHz: 30,
      stickDeadzone: 0.04,
      orientationBeta: 0.08,
    })
    clientRef.current = client

    const unsubscribeSnapshot = client.subscribe((next) => {
      if (!mountedRef.current) return
      setSnapshot(next)
      if (next.connected) {
        setObserved((current) => collectObserved(current, next))
        setConnecting(false)
        setError(null)
      }
    })
    const unsubscribeError = client.onError((clientError) => {
      if (!mountedRef.current) return
      setError(clientError.message)
      setConnecting(false)
    })

    return () => {
      mountedRef.current = false
      outputRunRef.current += 1
      unsubscribeSnapshot()
      unsubscribeError()
      client.dispose()
      clientRef.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    const client = clientRef.current
    if (!client) {
      setError('The controller client is still initializing. Try again.')
      return
    }

    setConnecting(true)
    setError(null)
    try {
      await client.connect()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Controller request failed.',
      )
      setConnecting(false)
    }
  }, [])

  const runOutputTest = useCallback(
    async (
      name: Exclude<RunningTest, null>,
      task: (
        client: PS5Controller,
        isCurrent: () => boolean,
      ) => Promise<void>,
    ) => {
      const client = clientRef.current
      if (!client?.current.connected) {
        setError('Connect the DualSense before testing outputs.')
        return
      }
      if (runningRef.current) return

      const runId = ++outputRunRef.current
      const isCurrent = () => outputRunRef.current === runId
      runningRef.current = name
      setRunningTest(name)
      setError(null)
      setOutputAttempts((current) => ({ ...current, [name]: true }))
      setOutputResults((current) => ({ ...current, [name]: 'untested' }))

      try {
        await task(client, isCurrent)
      } catch (caught) {
        if (mountedRef.current && isCurrent()) {
          setError(
            caught instanceof Error
              ? caught.message
              : `The ${name} test failed.`,
          )
        }
      } finally {
        if (isCurrent()) {
          client.resetOutputs()
          runningRef.current = null
          if (mountedRef.current) setRunningTest(null)
        }
      }
    },
    [],
  )

  const testHaptics = useCallback(
    () =>
      runOutputTest('haptics', async (client, isCurrent) => {
        const pulse = async (
          left: number,
          right: number,
          duration: number,
        ) => {
          if (!isCurrent()) return
          client.setRumble(left, right)
          await wait(duration)
          if (!isCurrent()) return
          client.setRumble(0, 0)
        }

        await pulse(0.12, 0.04, 90)
        await wait(180)
        await pulse(0.2, 0.08, 110)
        await wait(140)
        await pulse(0.32, 0.14, 130)
        await wait(100)
        await pulse(0.85, 0.55, 320)
      }),
    [runOutputTest],
  )

  const testTriggers = useCallback(
    () =>
      runOutputTest('triggers', async (client, isCurrent) => {
        client.setTriggerFeedback('left', {
          effect: TriggerEffect.Feedback,
          position: 0.25,
          strength: 0.55,
        })
        client.setTriggerFeedback('right', {
          effect: TriggerEffect.Feedback,
          position: 0.15,
          strength: 0.9,
        })
        for (let elapsed = 0; elapsed < 7000 && isCurrent(); elapsed += 100) {
          await wait(100)
        }
      }),
    [runOutputTest],
  )

  const resetOutputs = useCallback(() => {
    outputRunRef.current += 1
    runningRef.current = null
    setRunningTest(null)
    clientRef.current?.resetOutputs()
  }, [])

  const confirmOutput = useCallback(
    (output: keyof OutputResults, result: Exclude<OutputResult, 'untested'>) => {
      setOutputResults((current) => ({ ...current, [output]: result }))
    },
    [],
  )

  const calibrate = useCallback(async () => {
    const client = clientRef.current
    if (!client?.current.connected) {
      setError('Connect the controller before checking the gyroscope.')
      return
    }

    client.resetOrientation()
    setCalibration({
      status: 'sampling',
      progress: 0,
      mean: null,
      noiseRms: null,
      message: 'Keep the controller flat and completely still…',
    })

    const samples: Vec3[] = []
    const sampleCount = 120
    for (let index = 0; index < sampleCount; index += 1) {
      const reading = client.read()
      if (!reading.connected) {
        setCalibration({
          status: 'error',
          progress: 0,
          mean: null,
          noiseRms: null,
          message: 'Controller disconnected during the gyro check.',
        })
        return
      }
      samples.push({
        x: reading.motion.gyro.x * 2000,
        y: reading.motion.gyro.y * 2000,
        z: reading.motion.gyro.z * 2000,
      })
      if (index % 6 === 0 && mountedRef.current) {
        setCalibration((current) => ({
          ...current,
          progress: (index + 1) / sampleCount,
        }))
      }
      await wait(16)
      if (!mountedRef.current) return
    }

    const mean = samples.reduce(
      (sum, sample) => ({
        x: sum.x + sample.x / samples.length,
        y: sum.y + sample.y / samples.length,
        z: sum.z + sample.z / samples.length,
      }),
      { x: 0, y: 0, z: 0 },
    )
    const noiseRms = Math.sqrt(
      samples.reduce(
        (sum, sample) =>
          sum +
          ((sample.x - mean.x) ** 2 +
            (sample.y - mean.y) ** 2 +
            (sample.z - mean.z) ** 2) /
            samples.length,
        0,
      ),
    )
    const stable = noiseRms < 6 && magnitude3(mean) < 10
    client.resetOrientation()
    setCalibration({
      status: stable ? 'pass' : 'warn',
      progress: 1,
      mean,
      noiseRms,
      message: stable
        ? 'Gyro is stable. Neutral orientation has been reset.'
        : 'Motion or drift was detected. Put the controller down and retry.',
    })
  }, [])

  const recenterOrientation = useCallback(() => {
    clientRef.current?.resetOrientation()
  }, [])

  const resetObserved = useCallback(() => {
    setObserved(EMPTY_OBSERVED)
    setOutputResults({ haptics: 'untested', triggers: 'untested' })
    setOutputAttempts({ haptics: false, triggers: false })
    setCalibration(INITIAL_CALIBRATION)
  }, [])

  return {
    client: clientRef.current,
    webHIDSupported: support.webHID,
    secureContext: support.secureContext,
    snapshot,
    observed,
    calibration,
    outputResults,
    outputAttempts,
    runningTest,
    connecting,
    error,
    connect,
    testHaptics,
    testTriggers,
    resetOutputs,
    confirmOutput,
    calibrate,
    recenterOrientation,
    resetObserved,
  }
}
