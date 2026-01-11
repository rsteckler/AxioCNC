# CNCjs Frontend Modernization

## Project Intent

This project is a modernization effort for [CNCjs](https://github.com/cncjs/cncjs), a web-based interface for CNC controllers. The goal is to replace the legacy frontend with a modern, maintainable stack while preserving full feature parity with the original application.

## Why Modernize?

The legacy frontend uses an older toolchain (Webpack, older React patterns, Stylus CSS) that makes development and maintenance challenging. The new frontend leverages modern tooling for:

- **Better Developer Experience** - Hot module replacement, TypeScript, modern React patterns
- **Improved Performance** - Vite's fast builds, optimized bundles
- **Maintainability** - Component-based architecture, type safety, modern state management
- **Accessibility** - Built on Radix UI primitives with proper ARIA support
- **Theming** - Native dark/light mode with customizable accent colors

## Modern Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui + Radix UI |
| State Management | Redux Toolkit (RTK) |
| API Layer | RTK Query |
| Real-time | Socket.IO (v2 client for backend compatibility) |

## Project Structure

```
src/
├── app/                    # New modern frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── routes/         # Page components
│   │   ├── services/       # API and Socket.IO services
│   │   └── store/          # Redux store configuration
│   └── public/             # Static assets
├── app-legacy/             # Original frontend (preserved)
└── server/                 # Express + Socket.IO backend (unchanged)
```

## Feature Parity Reference

See [`docs/frontend-features.md`](../docs/frontend-features.md) for a comprehensive enumeration of all legacy frontend features that need to be implemented in the new frontend. This document serves as the checklist for achieving feature parity.

## Development

### Running the Application

```bash
# Terminal 1: Start the backend server
yarn start-server-dev

# Terminal 2: Start the new frontend dev server
cd src/app && yarn dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API/Socket.IO requests to the backend on port 8000.

### Building

```bash
# Development build (outputs to output/axiocnc/app)
cd src/app && yarn build:dev

# Production build (outputs to dist/axiocnc/app)
cd src/app && yarn build
```

## Current Progress

### Completed
- [x] Project scaffolding with Vite + React + TypeScript
- [x] Tailwind CSS + shadcn/ui component library setup
- [x] Redux Toolkit + RTK Query configuration
- [x] Socket.IO service with JWT authentication
- [x] Theme provider (light/dark/system + accent colors)
- [x] Settings page UI (General, Appearance, Machine, Joystick, User Accounts, Commands, Events, About)
- [x] Backend decoupling (serves static frontend, no template rendering)
- [x] i18n setup with bundled English, lazy-loaded other languages

### In Progress
- [ ] Main workspace/control interface
- [ ] G-code viewer and visualizer
- [ ] Widget system
- [ ] Full API integration for all settings

### Pending
- [ ] All widgets from legacy app
- [ ] Keyboard shortcuts
- [ ] File management
- [ ] Macro system
- [ ] Complete i18n coverage

## Related Documentation

- [`docs/frontend-features.md`](../docs/frontend-features.md) - Complete feature enumeration
- [`aidocs/dev_prefs.md`](./dev_prefs.md) - Development preferences and decisions

