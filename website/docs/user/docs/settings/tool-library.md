---
sidebar_position: 10
title: Tool Library
---

# Tool Library Settings

**Settings → Tool Library** stores tools (endmills, drills, etc.) with **tool ID**, **name**, **description**, **diameter**, and **type**. The tool library links your CAM tool list to what you use on the machine, so you know exactly which tool to load.

## Overview

- Add tools that match your CAM setup (by **tool ID** or name).
- Use **human-readable names** (e.g. “1/4 inch flat endmill”) instead of only “T4”.
- See **diameter**, **type**, and **description** in the UI during setup and tool changes.

## Adding a tool

Click **Add** (or **Add tool**). Enter:

- **Tool ID** — Number or identifier (e.g. 1, 2, T4). Should match CAM if you use tool numbers.
- **Name** — Short label (e.g. “1/4\" flat endmill”).
- **Description** — Optional details.
- **Diameter** — Tool diameter.
- **Diameter unit** — **mm** or **inches**.
- **Type** — e.g. endmill, drill, etc., if the UI offers types.

## Editing a tool

Open the tool in the list and change any of the fields above, then save.

## Deleting a tool

Use the delete control for that tool. This only removes it from the library; it doesn’t change G-code or job history.

## Tool list display

The tool library is shown as a list or table. Use it in **Setup** and during **tool changes** (M6) to see which tool to load and its specs.

## Next steps

- [Zeroing and Tool Changes](./zeroing-and-tool-changes) (tool change zeroing)
- [Setup screen](../workflow/setup-screen) and [Monitor screen](../workflow/monitor-screen)
