import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type MachineStatus = 
  | 'not_connected'
  | 'connected_pre_home'
  | 'connected_post_home'
  | 'alarm'
  | 'running'
  | 'hold'
  | 'error'

interface MachineState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectedPort: string | null
  
  // Machine status
  machineStatus: MachineStatus
  isFlashing: boolean
  isHomed: boolean
  
  // Position state
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  
  // Spindle state
  spindleState: 'M3' | 'M4' | 'M5'
  spindleSpeed: number
  maxSpindleSpeed: number
  
  // Current tool
  currentTool: number | undefined
  
  // Buffer state
  plannerQueueDepth: number
  plannerQueueMax: number
  rxBufferSize: number
  
  // Feedrate
  feedrate: number
  
  // Workflow state
  workflowState: 'idle' | 'running' | 'paused' | null
  isJobRunning: boolean
}

const initialState: MachineState = {
  isConnected: false,
  isConnecting: false,
  connectedPort: null,
  machineStatus: 'not_connected',
  isFlashing: false,
  isHomed: false,
  machinePosition: { x: 0, y: 0, z: 0 },
  workPosition: { x: 0, y: 0, z: 0 },
  spindleState: 'M5',
  spindleSpeed: 0,
  maxSpindleSpeed: 3000,
  currentTool: undefined,
  plannerQueueDepth: 0,
  plannerQueueMax: 15,
  rxBufferSize: 0,
  feedrate: 0,
  workflowState: null,
  isJobRunning: false,
}

const machineSlice = createSlice({
  name: 'machine',
  initialState,
  reducers: {
    setConnectionState: (state, action: PayloadAction<{ isConnected: boolean; connectedPort: string | null }>) => {
      state.isConnected = action.payload.isConnected
      state.connectedPort = action.payload.connectedPort
      if (!action.payload.isConnected) {
        // Reset state on disconnect
        state.machineStatus = 'not_connected'
        state.isHomed = false
        state.spindleState = 'M5'
        state.spindleSpeed = 0
        state.currentTool = undefined
        state.plannerQueueDepth = 0
        state.rxBufferSize = 0
        state.feedrate = 0
        state.workflowState = null
        state.isJobRunning = false
      }
    },
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.isConnecting = action.payload
    },
    setMachineStatus: (state, action: PayloadAction<MachineStatus>) => {
      state.machineStatus = action.payload
    },
    setFlashing: (state, action: PayloadAction<boolean>) => {
      state.isFlashing = action.payload
    },
    setHomed: (state, action: PayloadAction<boolean>) => {
      state.isHomed = action.payload
    },
    setMachinePosition: (state, action: PayloadAction<{ x: number; y: number; z: number }>) => {
      state.machinePosition = action.payload
    },
    setWorkPosition: (state, action: PayloadAction<{ x: number; y: number; z: number }>) => {
      state.workPosition = action.payload
    },
    setSpindleState: (state, action: PayloadAction<'M3' | 'M4' | 'M5'>) => {
      state.spindleState = action.payload
    },
    setSpindleSpeed: (state, action: PayloadAction<number>) => {
      state.spindleSpeed = action.payload
      // Update max if this is higher
      if (action.payload > 0) {
        state.maxSpindleSpeed = Math.max(state.maxSpindleSpeed, action.payload, 3000)
      }
    },
    setMaxSpindleSpeed: (state, action: PayloadAction<number>) => {
      state.maxSpindleSpeed = action.payload
    },
    setCurrentTool: (state, action: PayloadAction<number | undefined>) => {
      state.currentTool = action.payload
    },
    setPlannerQueue: (state, action: PayloadAction<{ depth: number; max: number }>) => {
      state.plannerQueueDepth = action.payload.depth
      state.plannerQueueMax = action.payload.max
    },
    setRxBufferSize: (state, action: PayloadAction<number>) => {
      state.rxBufferSize = action.payload
    },
    setFeedrate: (state, action: PayloadAction<number>) => {
      state.feedrate = action.payload
    },
    setWorkflowState: (state, action: PayloadAction<'idle' | 'running' | 'paused' | null>) => {
      state.workflowState = action.payload
      state.isJobRunning = action.payload === 'running'
    },
  },
})

export const {
  setConnectionState,
  setConnecting,
  setMachineStatus,
  setFlashing,
  setHomed,
  setMachinePosition,
  setWorkPosition,
  setSpindleState,
  setSpindleSpeed,
  setMaxSpindleSpeed,
  setCurrentTool,
  setPlannerQueue,
  setRxBufferSize,
  setFeedrate,
  setWorkflowState,
} = machineSlice.actions

export default machineSlice.reducer
