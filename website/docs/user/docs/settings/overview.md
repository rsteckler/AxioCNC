---
sidebar_position: 1
title: Settings Overview
---

# Settings Overview

Settings control how AxioCNC connects to your machine, how the UI looks, and how zeroing, macros, and other features behave. Open **Settings** from the gear icon in the main UI.

## Accessing settings

Click the **Settings** (gear) icon. The settings page opens with a sidebar of sections. Scroll or click a section to jump to it.

## Settings categories

Settings are grouped in the order they appear in the sidebar:

| Section | Purpose |
|--------|---------|
| **General** | Language, watch folders, import/export, reset |
| **Appearance** | Theme, accent color, custom themes |
| **Connection** | Serial port, baud rate, controller type, DTR/RTS |
| **Machine** | Name, limits, homing corner, auto-switch, tool spinup |
| **Zeroing Methods** | Touch plate, BitZero, BitSetter, etc. |
| **Default setup behavior** | Work XY zero, work Z zero, tool changes during job |
| **Camera** | IP camera URL, auth, display options |
| **Joystick** | Gamepad enable, mappings, analog settings |
| **Tool Library** | Tools and tool definitions |
| **Macros** | G-code macros |
| **Events** | Event handlers (e.g. on job start) |
| **Advanced** | Debug, show advanced (if enabled) |
| **About** | Version, updates, usage data, links |

## Auto-save

Most settings **auto-save** as you change them. A “Saving…” / “Saved” indicator appears. You don’t need to click a Save button.

## Import and export

- **Export** — **Settings → General → Settings backup → Export**. Downloads a JSON file with settings, macros, events, tools, cameras, watch folders.
- **Import** — **Import** in the same area. Select a previously exported JSON file. This **replaces** current settings (after you confirm). Camera passwords are not stored in exports; re-enter them after import.

## Reset to defaults

**Settings → General → Reset to Defaults** restores factory defaults. You must type **reset** to confirm. Use **Export** first if you want to keep a backup.

## Next steps

- [General](./general-settings), [Connection](./connection-settings), [Machine](./machine-settings)
- [Zeroing and Tool Changes](./zeroing-and-tool-changes)
- [Joystick](./joystick-settings), [Tool Library](./tool-library), [Macros](./macros)
