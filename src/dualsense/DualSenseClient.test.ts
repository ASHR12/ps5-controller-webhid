import {
  Brightness,
  MuteLedMode,
  PlayerID,
  type Lightbar,
  type Mute,
  type PlayerLeds,
} from 'dualsense-ts'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import { DualSenseClient } from './DualSenseClient'

interface FakeDualsense {
  connection: { active: boolean }
  lightbar: Lightbar
  playerLeds: PlayerLeds
  mute: Mute
  hid: {
    setLightbar: (r: number, g: number, b: number) => void
    setPlayerLeds: Mock
    setMicrophoneLED: Mock
  }
  sentLightbar: Mock
  rumble: Mock
  resetTriggerFeedback: Mock
  dispose: Mock
}

const controllers = vi.hoisted(() => [] as FakeDualsense[])

vi.mock('dualsense-ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dualsense-ts')>()

  class Dualsense {
    connection = { active: true }
    lightbar = new actual.Lightbar()
    playerLeds = new actual.PlayerLeds()
    mute = new actual.Mute()
    sentLightbar = vi.fn()
    hid = {
      provider: {},
      on: vi.fn(),
      onConnectionChange: vi.fn(() => () => {}),
      setLightbar: this.sentLightbar,
      setPlayerLeds: vi.fn(),
      setMicrophoneLED: vi.fn(),
    }
    rumble = vi.fn()
    resetTriggerFeedback = vi.fn()
    dispose = vi.fn()

    constructor() {
      controllers.push(this)
    }
  }

  return { ...actual, Dualsense }
})

const browserWindow = {
  isSecureContext: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  requestAnimationFrame: vi.fn(() => 1),
  cancelAnimationFrame: vi.fn(),
}

function createClient() {
  const client = new DualSenseClient()
  const controller = controllers.at(-1)
  if (!controller) throw new Error('The client did not create a controller.')
  return { client, controller }
}

beforeEach(() => {
  vi.stubGlobal('navigator', { hid: {} })
  vi.stubGlobal('window', browserWindow)
})

afterEach(() => {
  controllers.length = 0
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('setLightbar', () => {
  it('sends the color to dualsense-ts', () => {
    const { client, controller } = createClient()
    const set = vi.spyOn(controller.lightbar, 'set')

    client.setLightbar({ r: 255, g: 64, b: 0 })

    expect(set).toHaveBeenCalledWith({ r: 255, g: 64, b: 0 })
    expect(controller.lightbar.color).toEqual({ r: 255, g: 64, b: 0 })
  })

  it('clamps each channel to 0–255 and rounds it', () => {
    const { client, controller } = createClient()
    const set = vi.spyOn(controller.lightbar, 'set')

    client.setLightbar({ r: 300, g: -20, b: 127.5 })
    client.setLightbar({ r: Number.NaN, g: Infinity, b: 0.4 })

    expect(set.mock.calls).toEqual([
      [{ r: 255, g: 0, b: 128 }],
      [{ r: 0, g: 255, b: 0 }],
    ])
  })

  it('keeps a color set while disconnected', () => {
    const { client, controller } = createClient()
    controller.connection.active = false

    client.setLightbar({ r: 0, g: 200, b: 80 })

    expect(controller.lightbar.color).toEqual({ r: 0, g: 200, b: 80 })
  })

  it('carries the player LEDs in every lightbar report', () => {
    const { client, controller } = createClient()
    client.setPlayerLeds(PlayerID.Player2, Brightness.Low)

    // dualsense-ts's output loop sends lightbar changes through this method.
    controller.hid.setLightbar(255, 0, 0)

    expect(controller.hid.setPlayerLeds).toHaveBeenCalledWith(
      PlayerID.Player2,
      Brightness.Low,
    )
    expect(controller.sentLightbar).toHaveBeenCalledWith(255, 0, 0, undefined)
    const [ledsQueued] = controller.hid.setPlayerLeds.mock.invocationCallOrder
    const [lightbarQueued] = controller.sentLightbar.mock.invocationCallOrder
    expect(ledsQueued).toBeLessThan(lightbarQueued)
  })
})

describe('setPlayerLeds', () => {
  it('sends the mask and brightness to dualsense-ts', () => {
    const { client, controller } = createClient()

    client.setPlayerLeds(PlayerID.Player3, Brightness.Medium)
    expect(controller.playerLeds.bitmask).toBe(PlayerID.Player3)
    expect(controller.playerLeds.brightness).toBe(Brightness.Medium)

    client.setPlayerLeds(0b10001)
    expect(controller.playerLeds.bitmask).toBe(0b10001)
    expect(controller.playerLeds.brightness).toBe(Brightness.High)
  })

  it('rejects masks outside 0–31 and unknown brightness', () => {
    const { client, controller } = createClient()

    for (const mask of [-1, 32, 1.5, Number.NaN]) {
      expect(() => client.setPlayerLeds(mask)).toThrow(RangeError)
    }
    expect(() => client.setPlayerLeds(1, 3 as number as Brightness)).toThrow(
      RangeError,
    )
    expect(controller.playerLeds.bitmask).toBe(0)
  })
})

describe('setMuteLed', () => {
  it('sends the mode to dualsense-ts', () => {
    const { client, controller } = createClient()

    client.setMuteLed(MuteLedMode.Pulse)

    expect(controller.mute.ledMode).toBe(MuteLedMode.Pulse)
  })

  it('rejects unknown modes', () => {
    const { client, controller } = createClient()

    expect(() => client.setMuteLed(3 as number as MuteLedMode)).toThrow(
      RangeError,
    )
    expect(controller.mute.ledMode).toBeUndefined()
  })
})

describe('resetOutputs', () => {
  it('stops haptics and triggers and turns off every light', () => {
    const { client, controller } = createClient()
    client.setLightbar({ r: 255, g: 0, b: 0 })
    client.setPlayerLeds(PlayerID.All, Brightness.Low)
    client.setMuteLed(MuteLedMode.Pulse)

    client.resetOutputs()

    expect(controller.rumble).toHaveBeenCalledWith(0)
    expect(controller.resetTriggerFeedback).toHaveBeenCalled()
    expect(controller.lightbar.color).toEqual({ r: 0, g: 0, b: 0 })
    expect(controller.playerLeds.bitmask).toBe(0)
    expect(controller.playerLeds.brightness).toBe(Brightness.High)
    expect(controller.hid.setMicrophoneLED).toHaveBeenCalledWith(
      MuteLedMode.Off,
    )
    expect(controller.mute.ledMode).toBeUndefined()
  })

  it('leaves a mute LED the game never set to the controller', () => {
    const { client, controller } = createClient()

    client.resetOutputs()

    expect(controller.hid.setMicrophoneLED).not.toHaveBeenCalled()
  })

  it('runs on page exit', () => {
    const { client, controller } = createClient()
    client.setLightbar({ r: 255, g: 0, b: 0 })
    const [type, handlePageExit] =
      browserWindow.addEventListener.mock.lastCall ?? []

    expect(type).toBe('pagehide')
    handlePageExit()

    expect(controller.lightbar.color).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('dispose', () => {
  it('releases dualsense-ts only after its output timers send the reset', () => {
    vi.useFakeTimers()
    const { client, controller } = createClient()
    client.setLightbar({ r: 255, g: 0, b: 0 })

    client.dispose()

    expect(controller.lightbar.color).toEqual({ r: 0, g: 0, b: 0 })
    vi.advanceTimersByTime(2 * (1000 / 30))
    expect(controller.dispose).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(controller.dispose).toHaveBeenCalledOnce()

    client.setLightbar({ r: 0, g: 255, b: 0 })
    expect(controller.lightbar.color).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('without WebHID', () => {
  it('ignores output calls', () => {
    vi.stubGlobal('navigator', {})
    const client = new DualSenseClient()

    expect(controllers).toHaveLength(0)
    expect(() => {
      client.setLightbar({ r: 255, g: 0, b: 0 })
      client.setPlayerLeds(PlayerID.Player1)
      client.setMuteLed(MuteLedMode.On)
      client.resetOutputs()
      client.dispose()
    }).not.toThrow()
  })
})
