# Development Preferences & Decisions

This document captures design decisions, UI preferences, and architectural choices made during the frontend modernization. Use this as a reference for consistency across the codebase.

---

## Design System

### Color & Theming

- **Primary Accent**: Orange (`hsl(24 95% 53%)` light, `hsl(24 95% 63%)` dark)
- **Available Accents**: Orange, Blue, Green, Purple, Red, Zinc
- **Theme Modes**: Light, Dark, System (auto-detect)
- **CSS Variables**: All colors defined as HSL values in CSS variables for easy theming

### Typography

- **Section Headers**: 2xl (1.5rem), font-bold
- **Field Labels**: Base size, font-medium
- **Descriptions**: text-sm, text-muted-foreground
- **Monospace**: Used for values, commands, technical content (font-mono)

### Spacing & Layout

- **Settings Page**: Single-scroll with sticky left navigation
- **Section Spacing**: `mt-10 mb-8` between sections via Separator
- **Field Spacing**: `space-y-6` between settings fields
- **Max Content Width**: `max-w-3xl` for main content area

---

## UI Patterns

### Section Headers

- Left accent border (4px primary color) with padding-left
- Large bold title with optional description below
- Separator line at section end (except last section)

```tsx
<div className="pl-4 border-l-4 border-primary">
  <h2 className="text-2xl font-bold">{title}</h2>
  <p className="text-sm text-muted-foreground mt-1">{description}</p>
</div>
```

### Settings Fields

- Use `SettingsField` component for consistency
- `horizontal` prop for toggle switches (label left, control right)
- Tooltips for advanced/technical explanations
- Descriptions should be user-friendly, tooltips can be technical

### Forms & Inputs

- **Auto-save**: Use debounced save (500ms) - no explicit save buttons
- **Save Indicator**: Show "Saving..." / "Saved" badge in header
- **Validation**: Inline, non-blocking where possible

### Buttons

- **Primary**: Used for main actions (Export, Add, etc.)
- **Outline**: Secondary actions, toggles
- **Destructive**: Delete, Reset operations (with confirmation dialog)
- **Ghost**: Navigation, subtle actions

### Confirmation Dialogs

- Use `AlertDialog` for destructive actions
- Clear title stating the action
- Description explaining consequences
- Cancel + Confirm buttons

---

## Setup Dashboard Patterns

### Panel Layout

- **Two-column layout**: Left 33% for control panels, Right 66% for visualizer/tools
- **Sortable panels**: Use `@dnd-kit` (not react-grid-layout) for sortable lists
- **Auto-sizing**: Panels size to their content, no fixed heights
- **Collapsible**: Accordion controls on panel headers with rotating chevron

### Drag & Drop

- **Drag handle**: Only the grip icon initiates drag (6-dot `GripVertical`)
- **Drag overlay**: Show full panel clone at 96% scale (`scale-[0.96]`)
- **Drop indicator**: Dashed primary-color border where item will land, don't highlight target panel

### Scrollbars

- **Library**: Use `overlayscrollbars-react` for custom styling
- **Style**: Minimal pill thumb, no arrows, transparent track
- **Tool Library**: Always visible scrollbar, wheel converts to horizontal scroll
- **Left column**: Auto-hide after 400ms

### Jog Control

- **XY/Z spacing**: Large gap (`gap-24` = 96px) between XY pad and Z controls to prevent accidental clicks
- **Diagonals**: Include all 8 directions in XY pad
- **Modes**: Toggle between Steps (button grid) and Analog (virtual joystick)
- **Distance/Speed**: Discrete-step sliders with tick labels, not button rows
- **Analog joystick**: Circle for XY (drag thumb), vertical slider for Z (auto-centers on release)

### Tool Library

- **Sections**: "In Use" and "Available" with left accent borders
- **Horizontal scroll**: Mouse wheel scrolls horizontally
- **Cards**: Show tool number, name, diameter, type, and description

### Visualizer Panel

- **Tabs**: "3D View" and "Console" with vertical separator between tabs
- **Console**: Dark terminal style (zinc-950 bg), colored output:
  - Commands (`>`) in blue
  - `ok` responses in green
  - Errors in red
  - Info/timestamps in gray
- **Command input**: Bottom of console with `>` prompt

### Probe Panel

- **Strategy list**: Show available probe strategies with descriptions
- **Run buttons**: Each strategy has a Run button
- **Settings**: Strategy parameters configured in Settings screen, not in panel

---

## Architecture Decisions

### Single Machine Configuration

Instead of multiple machine profiles, we use a single machine configuration displayed directly in settings. This simplifies the UX for the majority of users who have one machine.

**Machine settings include:**
- Machine name
- Work area limits (X/Y/Z min/max with visual cards)
- Controller behavior (Continue on Error toggle)

### Consolidated Sections

- **General** includes Settings Backup (Import/Export/Reset) - no separate Workspace section
- **Machine** includes Controller behavior - no separate Controller section

### Settings Organization

1. **General** - Language, Analytics, Settings Backup
2. **Appearance** - Theme, Accent Color
3. **Machine** - Name, Limits, Controller behavior
4. **Joystick** - Gamepad configuration, button mappings
5. **User Accounts** - Account management
6. **Commands** - Custom G-code commands
7. **Events** - Event-triggered commands
8. **About** - Version info, links

---

## Component Preferences

### Avoid

- Horizontal rules between fields within a section (use spacing instead)
- Pill-shaped headers (look like buttons)
- JSON preview boxes (too technical for settings UI)
- Multiple save buttons (use auto-save)

### Prefer

- Left accent borders for section delineation
- Separator lines between sections
- Inline controls aligned right for toggles
- Cards for grouped related inputs (like axis limits)
- Color-coded elements where semantic (X=red, Y=green, Z=blue for axes)

---

## Code Style

### Component Organization

```
routes/
└── Settings/
    ├── index.tsx           # Main page component with state
    ├── SettingsNav.tsx     # Navigation sidebar
    ├── SettingsSection.tsx # Reusable section wrapper
    ├── SettingsField.tsx   # Reusable field wrapper
    └── sections/           # Individual section components
        ├── index.ts        # Exports
        ├── GeneralSection.tsx
        ├── MachineSection.tsx
        └── ...
```

### State Management

- **Local UI state**: `useState` for form values
- **Server state**: RTK Query for API data
- **Derived state**: Compute in render, don't duplicate
- **Debounced saves**: `useDebouncedCallback` hook

### Naming Conventions

- **Handlers**: `handle{Action}` (e.g., `handleLanguageChange`)
- **Callbacks from props**: `on{Action}` (e.g., `onLanguageChange`)
- **State setters**: `set{State}` (e.g., `setLanguage`)
- **Boolean state**: `is{State}` or descriptive (e.g., `isSaving`, `allowAnalytics`)

---

## Backend Integration

### API Endpoints

- All API calls go through RTK Query (`src/app/src/services/api.ts`)
- Base URL: `/api`
- Auth: Bearer token in Authorization header
- Token stored in `localStorage` as `cncjs-token`

### Socket.IO

- Using Socket.IO v2 client for compatibility with backend
- Connection requires JWT token in query params
- Singleton service pattern (`src/app/src/services/socket.ts`)

### State Persistence

- Settings saved via `POST /api/state` with partial updates
- Backend merges with existing state
- Controller settings nested under `controller.exception.ignoreErrors`

---

## Build & Development

### Commands

```bash
# Backend
yarn start-server-dev          # Start backend on port 8000

# Frontend
cd src/app && npm run dev      # Vite dev server on port 5173
cd src/app && npm run build    # Production build
cd src/app && npm run build:dev # Development build
```

### Output Directories

- **Development**: `output/cncjs/app`
- **Production**: `dist/cncjs/app`

### Proxy Configuration

Vite proxies `/api` and `/socket.io` to the backend during development.

