---
sidebar_position: 3
title: Zeroing the Workpiece
---

# Zeroing the Workpiece

**Work zero** (work offset origin) is the point your G-code uses as X0 Y0 Z0 for the job. You set it on the workpiece or fixture so the toolpath aligns with your stock.

## What you’ll do

- Choose a reference on the workpiece (corner, center, etc.)
- Set that position as work zero using manual zeroing, a touch plate, edge finder, or another method
- Use **Go to Zero** to rapid back to that point when needed

## When to use it

Set work zero:

- Before every new job
- After changing the workpiece or fixture
- After a tool change, if you re-zero Z (e.g. with a touch plate)

## Set Zero (quick zero)

**Set Zero** sets the **current** machine position as work zero (X0 Y0 Z0, or only the axes you choose).

1. Jog the tool to your reference (e.g. front-left corner of the part, top of stock).
2. Click **Set Zero** (and choose which axes, if the UI offers it).
3. That position is now work zero. The DRO shows 0 (or 0,0,0) at that point.

Use this for manual zeroing. For touch plates or edge finders, use the dedicated zeroing workflows. See [Zeroing methods](./zeroing-methods).

## Go to Zero

**Go to Zero** rapids the tool to the work zero position (X0 Y0 Z0). Use it to return to your origin after jogging away, or to start a run from a known position. Ensure Z is safe (high enough) before rapiding; jog Z up first if needed.

:::warning
Verify clearance before **Go to Zero**. The machine rapids to X0 Y0 Z0. If Z0 is on top of the part, retract Z first.
:::

## Why it matters

Incorrect work zero causes wrong placement of the toolpath: scrap parts, tool damage, or collisions. Always confirm your reference and re-check after changing anything (workpiece, fixture, vise).

## Next steps

- [Zeroing methods](./zeroing-methods) — Touch plate, edge finder, etc.
- [Jogging](./jogging)
- [Settings → Zeroing and Tool Changes](../settings/zeroing-and-tool-changes)
