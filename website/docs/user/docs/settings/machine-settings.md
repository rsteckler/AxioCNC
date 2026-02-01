---
sidebar_position: 5
title: Machine
---

# Machine Settings

**Settings → Machine** defines your machine name, work area, homing corner, and behavior options.

## Machine preset

**Machine preset** — Choose a preset to fill **Work area dimensions** and **Homing position** automatically, or **Custom / Manual entry** to type them yourself. Presets are grouped by manufacturer.

## Machine name

**Machine name** — Label for your machine (e.g. “My CNC Router”). Shown in the UI where relevant.

## Work area dimensions

**Work area dimensions** — Size of the usable workspace in **mm**:

- **Width (X)** — X travel.
- **Depth (Y)** — Y travel.
- **Height (Z)** — Z travel.

These define the workpiece envelope in the visualizer and help with bounds checking.

## Homing position

**Homing position** — Corner the machine moves to when homed. The UI shows four options: **Front left**, **Front right**, **Back left**, **Back right**. Choose the one that matches your limit switches and workflow. When homed, the machine is at that corner with X=0, Y=0 (and Z at max height, typically).

## Controller behavior

- **Auto-switch to Monitor when jobs start** — When **on**, starting a job from Setup switches the UI to the Monitor tab. When **off**, you stay on the current tab.
- **Tool spinup delay** — When **on**, AxioCNC waits before motion after **Start** or **Resume**, so the spindle can reach speed. Set **Delay time** (seconds) below. Turn **off** if you don’t use a spindle or don’t need a delay.

## Next steps

- [Connection](./connection-settings)
- [Zeroing and Tool Changes](./zeroing-and-tool-changes)
- [Setting home](../machine-control/setting-home)
