import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { SystemSettings } from '../../../shared/schemas/settings'

// Types for API responses
export interface Controller {
  port: string
  controllerType: string
  baudrate: number
}

export interface ControllersResponse {
  controllers: Controller[]
}

// Re-export SystemSettings type for convenience
export type { SystemSettings }

// Type for partial settings updates
export type PartialSettings = Partial<SystemSettings> & {
  controller?: Partial<SystemSettings['controller']>
  machine?: Partial<SystemSettings['machine']>
  connection?: Partial<SystemSettings['connection']>
  camera?: Partial<SystemSettings['camera']>
  zeroingMethods?: Partial<SystemSettings['zeroingMethods']>
  zeroingStrategies?: Partial<SystemSettings['zeroingStrategies']>
  joystick?: Partial<SystemSettings['joystick']>
  appearance?: Partial<SystemSettings['appearance']>
}

// Extensions are schemaless - can store any JSON
export type Extensions = Record<string, unknown>

export interface VersionInfo {
  current: string
  latest?: string
  lastUpdate?: string
}

// =============================================================================
// CRUD Resource Types (Users, Commands, Events, Macros)
// =============================================================================

export interface UserAccount {
  id: string
  name: string
  password?: string
  enabled: boolean
  mtime?: number
}

export interface UserAccountsResponse {
  records: UserAccount[]
  pagination?: {
    page: number
    pageLength: number
    totalRecords: number
  }
}

export interface Command {
  id: string
  title: string
  commands: string
  enabled: boolean
  mtime?: number
}

export interface CommandsResponse {
  records: Command[]
  pagination?: {
    page: number
    pageLength: number
    totalRecords: number
  }
}

export interface EventHandler {
  id: string
  event: string
  trigger: string
  commands: string
  enabled: boolean
  mtime?: number
}

export interface EventsResponse {
  records: EventHandler[]
  pagination?: {
    page: number
    pageLength: number
    totalRecords: number
  }
}

export interface Macro {
  id: string
  name: string
  description?: string
  content: string
  mtime?: number
}

export interface MacrosResponse {
  records: Macro[]
  pagination?: {
    page: number
    pageLength: number
    totalRecords: number
  }
}

export interface WatchFolder {
  id: string
  name: string
  type: 'local' | 'google-drive'
  path: string
  enabled: boolean
  mtime?: number
}

export interface WatchFoldersResponse {
  records: WatchFolder[]
  pagination?: {
    page: number
    pageLength: number
    totalRecords: number
  }
}

export interface BrowseDirectoryResponse {
  path: string
  directories: { name: string; path: string }[]
}

// Custom Theme types
export interface ThemeCSSVariables {
  '--background'?: string
  '--foreground'?: string
  '--card'?: string
  '--card-foreground'?: string
  '--popover'?: string
  '--popover-foreground'?: string
  '--primary'?: string
  '--primary-foreground'?: string
  '--secondary'?: string
  '--secondary-foreground'?: string
  '--muted'?: string
  '--muted-foreground'?: string
  '--accent'?: string
  '--accent-foreground'?: string
  '--destructive'?: string
  '--destructive-foreground'?: string
  '--border'?: string
  '--input'?: string
  '--ring'?: string
  [key: string]: string | undefined
}

export interface CustomThemeMeta {
  id: string
  name: string
  author?: string | null
  version?: string | null
  description?: string | null
  filename?: string
}

export interface CustomThemeDefinition extends CustomThemeMeta {
  light: ThemeCSSVariables
  dark: ThemeCSSVariables
}

export interface ThemesResponse {
  themes: CustomThemeMeta[]
}

export interface ThemesPathResponse {
  path: string
  exists: boolean
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
  tagTypes: ['Controllers', 'GCode', 'Settings', 'Extensions', 'Version', 'Themes', 'Users', 'Commands', 'Events', 'Macros', 'WatchFolders'],
  endpoints: (builder) => ({
    // Get active controllers
    getControllers: builder.query<ControllersResponse, void>({
      query: () => '/controllers',
      providesTags: ['Controllers'],
    }),

    // ==========================================================================
    // System Settings (Zod-validated)
    // ==========================================================================

    // Get all system settings with defaults applied
    getSettings: builder.query<SystemSettings, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    // Update system settings (partial update)
    // Validates against Zod schema, rejects unknown keys
    setSettings: builder.mutation<{ err: boolean }, PartialSettings>({
      query: (data) => ({
        url: '/settings',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Settings'],
    }),

    // Reset settings to defaults
    resetSettings: builder.mutation<{ err: boolean; settings: SystemSettings }, void>({
      query: () => ({
        url: '/settings',
        method: 'DELETE',
      }),
      invalidatesTags: ['Settings'],
    }),

    // ==========================================================================
    // Extensions (schemaless, for widgets/plugins)
    // ==========================================================================

    // Get extension data
    getExtensions: builder.query<Extensions, { key?: string } | void>({
      query: (params) => ({
        url: '/extensions',
        params: params && 'key' in params ? { key: params.key } : undefined,
      }),
      providesTags: ['Extensions'],
    }),

    // Set extension data
    setExtensions: builder.mutation<{ err: boolean }, { key?: string; data: Record<string, unknown> }>({
      query: ({ key, data }) => ({
        url: '/extensions',
        method: 'POST',
        params: key ? { key } : undefined,
        body: data,
      }),
      invalidatesTags: ['Extensions'],
    }),

    // Delete extension data
    deleteExtensions: builder.mutation<{ err: boolean }, { key: string }>({
      query: ({ key }) => ({
        url: '/extensions',
        method: 'DELETE',
        params: { key },
      }),
      invalidatesTags: ['Extensions'],
    }),

    // ==========================================================================
    // Version
    // ==========================================================================

    // Get version info
    getVersion: builder.query<VersionInfo, void>({
      query: () => '/version/latest',
      providesTags: ['Version'],
    }),

    // ==========================================================================
    // Authentication
    // ==========================================================================

    // Sign in - returns token and session info
    // If no users configured, returns { enabled: false, token: '...' } - no login needed
    signIn: builder.mutation<{ enabled: boolean; token: string; name: string }, { token?: string; name?: string; password?: string }>({
      query: (credentials) => ({
        url: '/signin',
        method: 'POST',
        body: credentials,
      }),
    }),

    // ==========================================================================
    // Themes (file-based custom themes)
    // ==========================================================================

    getThemes: builder.query<ThemesResponse, void>({
      query: () => '/themes',
      providesTags: ['Themes'],
    }),

    getTheme: builder.query<CustomThemeDefinition, string>({
      query: (id) => `/themes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Themes', id }],
    }),

    getThemesPath: builder.query<ThemesPathResponse, void>({
      query: () => '/themes/path',
    }),

    createTheme: builder.mutation<{ err: null; id: string; filename: string }, CustomThemeDefinition>({
      query: (theme) => ({
        url: '/themes',
        method: 'POST',
        body: theme,
      }),
      invalidatesTags: ['Themes'],
    }),

    updateTheme: builder.mutation<{ err: null }, { id: string; updates: Partial<CustomThemeDefinition> }>({
      query: ({ id, updates }) => ({
        url: `/themes/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Themes', id }, 'Themes'],
    }),

    deleteTheme: builder.mutation<{ err: null }, string>({
      query: (id) => ({
        url: `/themes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Themes'],
    }),

    // ==========================================================================
    // Users CRUD
    // ==========================================================================

    getUsers: builder.query<UserAccountsResponse, void>({
      query: () => '/users',
      providesTags: (result) =>
        result
          ? [...result.records.map(({ id }) => ({ type: 'Users' as const, id })), { type: 'Users', id: 'LIST' }]
          : [{ type: 'Users', id: 'LIST' }],
    }),

    createUser: builder.mutation<{ id: string; mtime: number }, Omit<UserAccount, 'id' | 'mtime'>>({
      query: (user) => ({
        url: '/users',
        method: 'POST',
        body: user,
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    updateUser: builder.mutation<{ id: string; mtime: number }, { id: string; updates: Partial<UserAccount> & { oldPassword?: string; newPassword?: string } }>({
      query: ({ id, updates }) => ({
        url: `/users/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),

    deleteUser: builder.mutation<{ id: string }, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    // ==========================================================================
    // Commands CRUD
    // ==========================================================================

    getCommands: builder.query<CommandsResponse, void>({
      query: () => '/commands',
      providesTags: (result) =>
        result
          ? [...result.records.map(({ id }) => ({ type: 'Commands' as const, id })), { type: 'Commands', id: 'LIST' }]
          : [{ type: 'Commands', id: 'LIST' }],
    }),

    createCommand: builder.mutation<{ id: string; mtime: number }, Omit<Command, 'id' | 'mtime'>>({
      query: (command) => ({
        url: '/commands',
        method: 'POST',
        body: command,
      }),
      invalidatesTags: [{ type: 'Commands', id: 'LIST' }],
    }),

    updateCommand: builder.mutation<{ id: string; mtime: number }, { id: string; updates: Partial<Command> }>({
      query: ({ id, updates }) => ({
        url: `/commands/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Commands', id }, { type: 'Commands', id: 'LIST' }],
    }),

    deleteCommand: builder.mutation<{ id: string }, string>({
      query: (id) => ({
        url: `/commands/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Commands', id: 'LIST' }],
    }),

    // ==========================================================================
    // Events CRUD
    // ==========================================================================

    getEvents: builder.query<EventsResponse, void>({
      query: () => '/events',
      providesTags: (result) =>
        result
          ? [...result.records.map(({ id }) => ({ type: 'Events' as const, id })), { type: 'Events', id: 'LIST' }]
          : [{ type: 'Events', id: 'LIST' }],
    }),

    createEvent: builder.mutation<{ id: string; mtime: number }, Omit<EventHandler, 'id' | 'mtime'>>({
      query: (event) => ({
        url: '/events',
        method: 'POST',
        body: event,
      }),
      invalidatesTags: [{ type: 'Events', id: 'LIST' }],
    }),

    updateEvent: builder.mutation<{ id: string; mtime: number }, { id: string; updates: Partial<EventHandler> }>({
      query: ({ id, updates }) => ({
        url: `/events/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Events', id }, { type: 'Events', id: 'LIST' }],
    }),

    deleteEvent: builder.mutation<{ id: string }, string>({
      query: (id) => ({
        url: `/events/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Events', id: 'LIST' }],
    }),

    // ==========================================================================
    // Macros CRUD
    // ==========================================================================

    getMacros: builder.query<MacrosResponse, void>({
      query: () => '/macros',
      providesTags: (result) =>
        result
          ? [...result.records.map(({ id }) => ({ type: 'Macros' as const, id })), { type: 'Macros', id: 'LIST' }]
          : [{ type: 'Macros', id: 'LIST' }],
    }),

    createMacro: builder.mutation<{ id: string; mtime: number }, Omit<Macro, 'id' | 'mtime'>>({
      query: (macro) => ({
        url: '/macros',
        method: 'POST',
        body: macro,
      }),
      invalidatesTags: [{ type: 'Macros', id: 'LIST' }],
    }),

    updateMacro: builder.mutation<{ id: string; mtime: number }, { id: string; updates: Partial<Macro> }>({
      query: ({ id, updates }) => ({
        url: `/macros/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Macros', id }, { type: 'Macros', id: 'LIST' }],
    }),

    deleteMacro: builder.mutation<{ id: string }, string>({
      query: (id) => ({
        url: `/macros/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Macros', id: 'LIST' }],
    }),

    // ==========================================================================
    // Watch Folders CRUD
    // ==========================================================================

    getWatchFolders: builder.query<WatchFoldersResponse, void>({
      query: () => '/watchfolders',
      providesTags: (result) =>
        result
          ? [...result.records.map(({ id }) => ({ type: 'WatchFolders' as const, id })), { type: 'WatchFolders', id: 'LIST' }]
          : [{ type: 'WatchFolders', id: 'LIST' }],
    }),

    createWatchFolder: builder.mutation<{ id: string; mtime: number }, Omit<WatchFolder, 'id' | 'mtime'>>({
      query: (folder) => ({
        url: '/watchfolders',
        method: 'POST',
        body: folder,
      }),
      invalidatesTags: [{ type: 'WatchFolders', id: 'LIST' }],
    }),

    updateWatchFolder: builder.mutation<{ id: string; mtime: number }, { id: string; updates: Partial<WatchFolder> }>({
      query: ({ id, updates }) => ({
        url: `/watchfolders/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'WatchFolders', id }, { type: 'WatchFolders', id: 'LIST' }],
    }),

    deleteWatchFolder: builder.mutation<{ id: string }, string>({
      query: (id) => ({
        url: `/watchfolders/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'WatchFolders', id: 'LIST' }],
    }),

    browseDirectory: builder.query<BrowseDirectoryResponse, string>({
      query: (path) => ({
        url: '/watchfolders/browse',
        params: { path },
      }),
    }),
  }),
})

export const {
  useGetControllersQuery,
  // Settings
  useGetSettingsQuery,
  useSetSettingsMutation,
  useResetSettingsMutation,
  // Extensions
  useGetExtensionsQuery,
  useSetExtensionsMutation,
  useDeleteExtensionsMutation,
  // Themes
  useGetThemesQuery,
  useGetThemeQuery,
  useGetThemesPathQuery,
  useCreateThemeMutation,
  useUpdateThemeMutation,
  useDeleteThemeMutation,
  // Users
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  // Commands
  useGetCommandsQuery,
  useCreateCommandMutation,
  useUpdateCommandMutation,
  useDeleteCommandMutation,
  // Events
  useGetEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  // Macros
  useGetMacrosQuery,
  useCreateMacroMutation,
  useUpdateMacroMutation,
  useDeleteMacroMutation,
  // Watch Folders
  useGetWatchFoldersQuery,
  useCreateWatchFolderMutation,
  useUpdateWatchFolderMutation,
  useDeleteWatchFolderMutation,
  useBrowseDirectoryQuery,
  useLazyBrowseDirectoryQuery,
  // Other
  useGetVersionQuery,
  useSignInMutation,
} = api
