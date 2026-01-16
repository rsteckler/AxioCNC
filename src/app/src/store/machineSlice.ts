import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { MachineReadinessStatus } from '@/types/machine'
import type { MachineStatus } from '@/services/api'

interface MachineState {
  // Connection state (UI-specific, not from backend)
  isConnecting: boolean
  isFlashing: boolean
  
  // Backend status - single source of truth
  backendStatus: MachineStatus | null
  
  // Computed/derived fields (for convenience and performance)
  // These are computed from backendStatus but cached for performance
  machineStatus: MachineReadinessStatus
  maxSpindleSpeed: number // Tracks max seen, not from backend
}

const initialState: MachineState = {
  isConnecting: false,
  isFlashing: false,
  backendStatus: null,
  machineStatus: 'not_connected',
  maxSpindleSpeed: 3000,
}

const machineSlice = createSlice({
  name: 'machine',
  initialState,
  reducers: {
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload
    },
    setFlashing: (state, action: PayloadAction<boolean>) => {
      state.isFlashing = action.payload
    },
    setBackendStatus: (state, action: PayloadAction<MachineStatus | null>) => {
      state.backendStatus = action.payload
      // Update computed machineStatus from backend
      if (action.payload) {
        state.machineStatus = action.payload.machineStatus
      } else {
        state.machineStatus = 'not_connected'
      }
    },
    setMaxSpindleSpeed: (state, action: PayloadAction<number>) => {
      state.maxSpindleSpeed = action.payload
    },
    // Legacy actions for backwards compatibility - these now update backendStatus
    setConnectionState: (state, action: PayloadAction<{ isConnected: boolean; connectedPort: string | null }>) => {
      if (!action.payload.isConnected) {
        // Reset backend status on disconnect
        state.backendStatus = null
        state.machineStatus = 'not_connected'
      }
      // Note: isConnected and connectedPort are now computed from backendStatus
    },
    setMachineStatus: (state, action: PayloadAction<MachineReadinessStatus>) => {
      // Update machineStatus, but also update backendStatus if it exists
      state.machineStatus = action.payload
      if (state.backendStatus) {
        state.backendStatus.machineStatus = action.payload
      }
    },
  },
})

export const {
  setConnecting,
  setFlashing,
  setBackendStatus,
  setMaxSpindleSpeed,
  // Legacy actions for backwards compatibility
  setConnectionState,
  setMachineStatus,
} = machineSlice.actions

export default machineSlice.reducer
