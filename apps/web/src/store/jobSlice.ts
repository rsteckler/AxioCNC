import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface JobStats {
  totalDistance?: { x: number; y: number; z: number; total: number }
  cuttingDistance?: { x: number; y: number; z: number; total: number }
  transitionDistance?: { x: number; y: number; z: number; total: number }
  retractDistance?: { x: number; y: number; z: number; total: number }
  toolStats?: {
    [toolNumber: number]: {
      toolNumber: number
      distance: { x: number; y: number; z: number; total: number }
      time: number
    }
  }
  currentTool?: number
  toolStartTime?: number
  position?: { x: number; y: number; z: number }
  modalState?: {
    motion?: string
    spindle?: string
    distance?: string
    units?: string
  }
}

interface JobCompletionState {
  reason: 'completed' | 'stopped' | 'reset' | 'error' | 'unload' | 'connection_lost' | 'connection_reset' | 'unknown' | null
  timestamp: number | null
  wasSuccessful: boolean
  senderState: {
    received: number
    total: number
    finishTime: number
    name: string
  } | null
}

export interface JobState {
  name?: string
  size?: number
  total?: number
  sent?: number
  received?: number
  elapsedTime?: number
  remainingTime?: number
  nextM6ToolNumber?: number
  remainingTimeToNextM6?: number
  jobId?: string | null
  m6Indices?: number[]
  m6ToolNumbers?: number[]
  stats?: JobStats
  completion: JobCompletionState
}

const initialCompletionState: JobCompletionState = {
  reason: null,
  timestamp: null,
  wasSuccessful: false,
  senderState: null,
}

const initialState: JobState = {
  completion: initialCompletionState,
}

const jobSlice = createSlice({
  name: 'job',
  initialState,
  reducers: {
    setJobState: (state, action: PayloadAction<Partial<Omit<JobState, 'completion'>>>) => {
      return { ...state, ...action.payload }
    },
    setJobCompletion: (state, action: PayloadAction<Partial<JobCompletionState>>) => {
      state.completion = { ...state.completion, ...action.payload }
    },
    clearJobState: () => {
      return initialState
    },
    clearJobCompletion: (state) => {
      state.completion = initialCompletionState
    },
  },
})

export const { setJobState, setJobCompletion, clearJobState, clearJobCompletion } = jobSlice.actions

export default jobSlice.reducer
