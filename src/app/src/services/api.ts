import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Types for API responses
export interface Controller {
  port: string
  controllerType: string
  baudrate: number
}

export interface ControllersResponse {
  controllers: Controller[]
}

export interface AppState {
  allowAnonymousUsageDataCollection?: boolean
  controller?: {
    ignoreErrors?: boolean
  }
  [key: string]: unknown
}

export interface VersionInfo {
  current: string
  latest?: string
  lastUpdate?: string
}

// RTK Query API definition
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      // Get token from localStorage if available
      const token = localStorage.getItem('cncjs-token')
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ['Controllers', 'GCode', 'State', 'Version'],
  endpoints: (builder) => ({
    // Get active controllers
    getControllers: builder.query<ControllersResponse, void>({
      query: () => '/controllers',
      providesTags: ['Controllers'],
    }),

    // Get app state (settings)
    getState: builder.query<AppState, { key?: string } | void>({
      query: (params) => ({
        url: '/state',
        params: params && 'key' in params ? { key: params.key } : undefined,
      }),
      providesTags: ['State'],
    }),

    // Update app state (settings)
    // Backend expects: POST /api/state with body as object
    // e.g., { allowAnonymousUsageDataCollection: true }
    // For nested keys use dot notation: { 'controller.ignoreErrors': true }
    setState: builder.mutation<{ err: boolean }, Record<string, unknown>>({
      query: (data) => ({
        url: '/state',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['State'],
    }),

    // Get version info
    getVersion: builder.query<VersionInfo, void>({
      query: () => '/version/latest',
      providesTags: ['Version'],
    }),

    // Sign in - returns token and session info
    // If no users configured, returns { enabled: false, token: '...' } - no login needed
    signIn: builder.mutation<{ enabled: boolean; token: string; name: string }, { token?: string; name?: string; password?: string }>({
      query: (credentials) => ({
        url: '/signin',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
})

export const {
  useGetControllersQuery,
  useGetStateQuery,
  useSetStateMutation,
  useGetVersionQuery,
  useSignInMutation,
} = api

