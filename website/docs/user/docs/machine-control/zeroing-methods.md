---
sidebar_position: 4
title: Zeroing Methods
---

# Zeroing Methods

AxioCNC supports several ways to set work zero: manual, touch plate, edge finder, BitZero, BitSetter, and custom. Choose the method that matches your hardware and workflow.

## Overview

| Method | Typical use | Axes |
|--------|-------------|------|
| **Manual** | Jog to a reference, then Set Zero | X, Y, Z |
| **Touch plate** | Electrical touch plate; one axis per method | X, Y, or Z |
| **Edge finder** | Mechanical edge finder | X, Y |
| **BitZero** | Contact-based probe for XYZ | X, Y, Z |
| **BitSetter** | Tool-length / Z probe; often used at **tool change** | Z |
| **Custom** | User-defined procedure | Configurable |

**BitSetter** is aimed at **tool changes**: you touch off each tool to set its length. Configure it under **Settings → Zeroing and Tool Changes** (**Tool changes during job**) in the **Tool changes during job** dropdown.

## Manual zeroing

1. Jog the tool to your reference (e.g. corner of part, top of stock).
2. Use **Set Zero** for the axes you need (X, Y, and/or Z).
3. Work zero is set. No extra hardware.

## Touch plate zeroing

1. Attach a conductive touch plate to the workpiece or table. Connect it to the controller’s probe input.
2. In **Settings → Zeroing Methods**, add or edit a **Touch Plate** method. Set **Plate thickness** (e.g. mm).
3. In Setup, use **Set up job** or the Probe panel’s quick action for your touch plate (X, Y, or Z). Follow the prompts: the tool moves until it touches the plate, then that axis’s zero is set using the plate thickness.

:::warning
Spindle must be **off** when probing. Ensure the touch plate is wired correctly and the probe input is configured in firmware.
:::

## Edge finder zeroing

1. Use a mechanical edge finder in the spindle. Jog to the edge (X or Y).
2. Use the edge-finder zeroing workflow (if available) or manual **Set Zero** after positioning. The workflow may use a known edge-finder diameter to compute the edge position.

## BitZero zeroing

BitZero-style probes provide a known reference (e.g. corner block). Use the BitZero zeroing workflow to set X, Y, and Z from that reference. Configure the method in **Settings → Zeroing Methods** and follow the on-screen steps.

## BitSetter (tool change)

BitSetter is used when you **change tools**: you touch off each new tool to set its length (Z). Configure it under **Settings → Zeroing and Tool Changes** (**Tool changes during job**). When the job hits an M6, you’re prompted to change the tool and run the BitSetter procedure before resuming.

## Choosing a method

- **Manual** — No hardware; good for quick setup when a visual reference is enough.
- **Touch plate** — Fast, repeatable Z (and optionally XY). Common for wood and aluminum.
- **Edge finder** — Accurate X/Y edges; manual Z or touch plate for Z.
- **BitZero** — Full XYZ from a fixed reference.
- **BitSetter** — Tool-length at tool change; use with BitZero or similar for initial zero.

## Next steps

- [Zeroing the workpiece](./zeroing-workpiece)
- [Settings → Zeroing and Tool Changes](../settings/zeroing-and-tool-changes)
- [Jogging](./jogging)
