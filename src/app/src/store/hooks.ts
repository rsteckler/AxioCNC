import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'
import type { RootState, AppDispatch } from './index'
import { createSelector } from '@reduxjs/toolkit'

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Selectors for computed values from backendStatus
const selectBackendStatus = (state: RootState) => state.machine.backendStatus

// Computed connection state
export const selectIsConnected = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.connected ?? false
)

export const selectConnectedPort = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.port ?? null
)

// Computed position values (parsed from strings to numbers)
export const selectMachinePosition = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const mpos = backendStatus?.controllerState?.mpos
    if (!mpos) return { x: 0, y: 0, z: 0 }
    return {
      x: parseFloat(mpos.x || '0'),
      y: parseFloat(mpos.y || '0'),
      z: parseFloat(mpos.z || '0'),
    }
  }
)

export const selectWorkPosition = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const wpos = backendStatus?.controllerState?.wpos
    if (!wpos) return { x: 0, y: 0, z: 0 }
    return {
      x: parseFloat(wpos.x || '0'),
      y: parseFloat(wpos.y || '0'),
      z: parseFloat(wpos.z || '0'),
    }
  }
)

// Computed spindle state
export const selectSpindleState = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const spindle = backendStatus?.parserstate?.modal?.spindle
    if (spindle === 'M3' || spindle === 'M4' || spindle === 'M5') {
      return spindle
    }
    return 'M5' as const
  }
)

export const selectSpindleSpeed = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const speed = backendStatus?.parserstate?.spindle
    return speed ? parseFloat(speed || '0') : 0
  }
)

// Computed tool
export const selectCurrentTool = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const tool = backendStatus?.parserstate?.tool
    const toolNum = tool ? parseFloat(tool || '0') : 0
    return toolNum > 0 ? toolNum : undefined
  }
)

// Computed feedrate
export const selectFeedrate = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const feedrate = backendStatus?.parserstate?.feedrate
    return feedrate ? parseFloat(feedrate || '0') : 0
  }
)

// Computed buffer state
export const selectRxBufferSize = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.status?.buf?.rx ?? 0
)

export const selectPlannerQueue = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const availableBlocks = backendStatus?.status?.buf?.planner ?? 0
    const maxBlocks = 15
    const usedBlocks = Math.max(0, maxBlocks - availableBlocks)
    return { depth: usedBlocks, max: maxBlocks }
  }
)

// Computed workflow state
export const selectWorkflowState = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.workflowState ?? null
)

// Computed work coordinate system
export const selectCurrentWCS = createSelector(
  [selectBackendStatus],
  (backendStatus) => {
    const wcs = backendStatus?.parserstate?.modal?.wcs
    return wcs || 'G54'
  }
)

export const selectIsJobRunning = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.isJobRunning ?? false
)

// Computed homed state
export const selectIsHomed = createSelector(
  [selectBackendStatus],
  (backendStatus) => backendStatus?.isHomed ?? false
)

// Convenience hooks for machine state
export const useMachineState = () => useAppSelector((state) => state.machine)
export const useJobState = () => useAppSelector((state) => state.job)

// Convenience hooks for computed values
export const useIsConnected = () => useAppSelector(selectIsConnected)
export const useConnectedPort = () => useAppSelector(selectConnectedPort)
export const useMachinePosition = () => useAppSelector(selectMachinePosition)
export const useWorkPosition = () => useAppSelector(selectWorkPosition)
export const useSpindleState = () => useAppSelector(selectSpindleState)
export const useSpindleSpeed = () => useAppSelector(selectSpindleSpeed)
export const useCurrentTool = () => useAppSelector(selectCurrentTool)
export const useFeedrate = () => useAppSelector(selectFeedrate)
export const useRxBufferSize = () => useAppSelector(selectRxBufferSize)
export const usePlannerQueue = () => useAppSelector(selectPlannerQueue)
export const useWorkflowState = () => useAppSelector(selectWorkflowState)
export const useIsJobRunning = () => useAppSelector(selectIsJobRunning)
export const useIsHomed = () => useAppSelector(selectIsHomed)
export const useCurrentWCS = () => useAppSelector(selectCurrentWCS)