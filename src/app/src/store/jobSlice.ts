import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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

interface JobState {
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
