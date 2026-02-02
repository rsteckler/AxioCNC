import { socketService } from '@/services/socket'
import { parseConsoleMessage } from '@/routes/Setup/utils/consoleParser'

/**
 * Feeder status payload from backend (feeder.toJSON()).
 * Used to detect when the command queue is empty and the batch is done.
 */
export interface FeederStatusPayload {
  hold?: boolean
  holdReason?: unknown
  queue?: number
  pending?: boolean
  changed?: boolean
}

export interface RunGcodeBatchOptions {
  /** Multi-line G-code string (will be sent via socket command 'gcode') */
  gcode: string
  /** Controller port (e.g. from useConnectedPort / settings) */
  port: string
  /** Optional AbortSignal to cancel waiting; listeners are removed and promise rejected with DOMException name 'AbortError' */
  signal?: AbortSignal
  /** If true, resolve only after feeder empty AND machine status is not running and not hold. Default false. */
  waitForIdle?: boolean
}

/**
 * Sends a batch of G-code and returns a Promise that resolves when the feeder is empty
 * (and optionally when the machine is idle), or rejects on error, disconnect, or abort.
 */
export function runGcodeBatch(options: RunGcodeBatchOptions): Promise<void> {
  const { gcode, port, signal, waitForIdle = false } = options

  if (!port || !gcode.trim()) {
    return Promise.reject(new Error('runGcodeBatch requires non-empty port and gcode'))
  }

  if (!socketService.isConnected()) {
    return Promise.reject(new Error('Socket not connected'))
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let sent = false
    let feederEmptySeen = false

    function finish(err?: Error | DOMException) {
      if (settled) return
      settled = true
      socketService.off('feeder:status', onFeederStatus)
      socketService.off('machine:status', onMachineStatus)
      socketService.off('serialport:read', onSerialRead)
      socketService.off('disconnect', onDisconnect)
      signal?.removeEventListener('abort', onAbort)
      if (err) reject(err)
      else resolve()
    }

    function onAbort() {
      finish(new DOMException('Aborted', 'AbortError'))
    }

    function onFeederStatus(status: unknown) {
      if (settled) return
      const payload = status as FeederStatusPayload
      const empty =
        (payload.queue ?? 0) === 0 &&
        !payload.pending &&
        !payload.hold

      if (!empty || !sent) return

      if (!waitForIdle) {
        finish()
        return
      }
      feederEmptySeen = true
      // Resolve is deferred to onMachineStatus when waitForIdle and we see idle
    }

    function checkIdleAndFinish(portArg: string, status: unknown) {
      if (portArg !== port || !feederEmptySeen || settled) return
      const s = status as { machineStatus?: string }
      const ms = s?.machineStatus
      if (ms !== 'running' && ms !== 'hold') {
        finish()
      }
    }

    function onMachineStatus(portArg: string, status: unknown) {
      checkIdleAndFinish(portArg, status)
    }

    function onSerialRead(data: string) {
      if (settled) return
      const line = parseConsoleMessage(data, 'read')
      if (line.type === 'error' || line.type === 'alarm') {
        finish(new Error(line.message || line.raw || data))
      }
    }

    function onDisconnect() {
      if (settled) return
      finish(new Error('Socket disconnected during batch'))
    }

    socketService.on('feeder:status', onFeederStatus)
    socketService.on('serialport:read', onSerialRead)
    socketService.on('disconnect', onDisconnect)
    if (waitForIdle) {
      socketService.on('machine:status', onMachineStatus)
    }
    if (signal) {
      if (signal.aborted) {
        finish(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    socketService.command(port, 'gcode', gcode)
    sent = true
  })
}

export interface WaitForFeederEmptyOptions {
  /** Controller port (e.g. from useConnectedPort / settings) */
  port: string
  /** Optional AbortSignal to cancel waiting; listeners are removed and promise rejected with DOMException name 'AbortError' */
  signal?: AbortSignal
}

/**
 * Waits for the feeder to be empty (queue === 0 && !pending && !hold) without sending any G-code.
 * Use after macro:run or other commands that feed the queue from the backend.
 * Rejects on disconnect, serial error/alarm, or abort.
 * Only resolves after having seen the feeder non-empty and then empty, so we don't show "Done"
 * too early if the first feeder:status arrives before the backend has fed the macro.
 */
export function waitForFeederEmpty(options: WaitForFeederEmptyOptions): Promise<void> {
  const { port, signal } = options

  if (!port) {
    return Promise.reject(new Error('waitForFeederEmpty requires a non-empty port'))
  }

  if (!socketService.isConnected()) {
    return Promise.reject(new Error('Socket not connected'))
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let sawNonEmpty = false

    function finish(err?: Error | DOMException) {
      if (settled) return
      settled = true
      socketService.off('feeder:status', onFeederStatus)
      socketService.off('serialport:read', onSerialRead)
      socketService.off('disconnect', onDisconnect)
      signal?.removeEventListener('abort', onAbort)
      if (err) reject(err)
      else resolve()
    }

    function onAbort() {
      finish(new DOMException('Aborted', 'AbortError'))
    }

    function onFeederStatus(status: unknown) {
      if (settled) return
      const payload = status as FeederStatusPayload
      const empty =
        (payload.queue ?? 0) === 0 &&
        !payload.pending &&
        !payload.hold
      if (!empty) sawNonEmpty = true
      if (empty && sawNonEmpty) finish()
    }

    function onSerialRead(data: string) {
      if (settled) return
      const line = parseConsoleMessage(data, 'read')
      if (line.type === 'error' || line.type === 'alarm') {
        finish(new Error(line.message || line.raw || data))
      }
    }

    function onDisconnect() {
      if (settled) return
      finish(new Error('Socket disconnected while waiting for feeder'))
    }

    socketService.on('feeder:status', onFeederStatus)
    socketService.on('serialport:read', onSerialRead)
    socketService.on('disconnect', onDisconnect)
    if (signal) {
      if (signal.aborted) {
        finish(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', onAbort)
    }
  })
}
