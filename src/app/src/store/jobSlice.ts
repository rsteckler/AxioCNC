import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
}

const initialState: JobState = {}

const jobSlice = createSlice({
  name: 'job',
  initialState,
  reducers: {
    setJobState: (state, action: PayloadAction<Partial<JobState>>) => {
      return { ...state, ...action.payload }
    },
    clearJobState: () => {
      return initialState
    },
  },
})

export const { setJobState, clearJobState } = jobSlice.actions

export default jobSlice.reducer
