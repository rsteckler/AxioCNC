---
sidebar_position: 6
title: Zeroing and Tool Changes
---

# Zeroing and Tool Changes

This section covers **zeroing hardware** (the methods you can use to set work zero) and **default setup behavior** (how AxioCNC chooses what to do before a job and at tool changes). You configure both under **Settings**: first add and enable zeroing methods, then set your default choices for work XY zero, work Z zero, and tool changes during a job.

## Overview

- **Zeroing methods** — The hardware and procedures available on your machine: Manual, Touch plate (X, Y, or Z), BitZero (XYZ, XY, or Z), BitSetter, and Custom G-code. You add and configure these in **Settings → Zeroing Methods** (shown in the sidebar as **Zeroing Methods**).
- **Default setup behavior** — Your default choices for three decisions: **Work XY zero**, **Work Z zero**, and **Tool changes during job**. These are configured in **Settings → Default setup behavior** (the section that follows Zeroing Methods). Options in the dropdowns are derived from the zeroing methods you have enabled.

When you start a job from the Setup screen, you can either use these defaults or change them for that job only in the **Set up job** wizard.

---

## Zeroing methods (hardware)

**Settings → Zeroing Methods** configures which zeroing tools and procedures are available (e.g. touch plate, BitZero, BitSetter) and their parameters.

### Adding a method

Click **Add** (or **Add zeroing method**). Choose a type:

- **Manual** — Jog to a reference, then Set Zero. No extra hardware. One Manual method exists by default; you can't add another.
- **Touch plate** — Conductive plate wired to the probe input. You choose **one axis per method**: X, Y, or Z. Set **plate thickness** (mm), **probe feedrate**, **probe distance**, and **require check** (safety prompt). Add separate methods for X, Y, and Z if you use touch plates on multiple axes.
- **BitZero** — Probe-based zeroing. Adding one BitZero creates **three composable methods**: BitZero XYZ, BitZero XY, and BitZero Z. Use them for full XYZ, XY only, or Z only.
- **BitSetter** — Tool-length / Z probe, often used at **tool change** to establish a tool reference.
- **Custom** — User-defined G-code procedure.

### Configuring a method

For each method you can set:

- **Name** — Label (e.g. "Touch Plate (Z)", "BitZero XY").
- **Enabled** — When **on**, the method appears in setup and tool-change options; when **off**, it's hidden.
- **Axes** — For touch plate: X, Y, or Z (one axis per method). For BitZero: each card is fixed to XYZ, XY, or Z.

**Touch plate** also has: plate thickness (mm), probe feedrate, probe distance, and **Require check** (confirmation before probing).

### Editing and deleting

- **Edit** — Open the method card to change name, enabled, axes, and type-specific options.
- **Delete** — Remove the method. Manual cannot be deleted. If **Default setup behavior** uses this method, you'll need to pick another there.

---

## Default setup behavior

**Settings → Default setup behavior** (the section after Zeroing Methods) has three dropdowns. Options are derived from your **enabled** zeroing methods.

### Work XY zero

How to set **X and Y work zero** before running a job.

- **Ask each time** — When you set up a job, you'll be prompted to choose how to set XY zero (e.g. BitZero XY, Touchplate X then Y, or Manual).
- **A specific option** — Always use that choice (e.g. BitZero (XY), Touchplate X then Y, or Manual). Only options for which you have enabled methods appear.

### Work Z zero

How to set **Z work zero** before running a job.

- **Ask each time** — You'll be prompted to choose at job setup (e.g. BitZero Z, Touchplate Z, or Manual).
- **A specific option** — Always use that method for Z zero.

### Tool changes during job

What to do when the program hits **M6** (tool change).

- **Ask each time** — At each M6, you'll be prompted to choose a method (e.g. BitSetter, Touchplate Z, or Manual re-zero Z).
- **A specific method** — Always use that method (e.g. BitSetter to establish tool reference, or Touchplate Z / Manual to re-zero Z).

If you choose **BitSetter** for tool changes, a note explains: **Required:** After you set Z work zero, we will probe the current tool on the BitSetter to establish the job's tool reference. This is needed so tool length is consistent when you change tools during the job.

---

## Set up job flow

From the **Setup** screen you can:

1. **Set up job** — Click **Set up job** in the Job setup panel. This opens the **Set up job** wizard.
2. **Plan for this job** — The first screen shows the plan: Set XY zero (method), Set Z zero (method), Tool changes (policy). You can change any of these for **this job only**; changes are not saved to Settings. If tool changes use BitSetter, the wizard explains that after Z zero you'll probe the current tool on the BitSetter to set the reference.
3. **Continue** — The wizard runs the steps as discrete blocks (e.g. BitZero XY, then Touchplate Z, then BitSetter). When all steps are done, you see **Ready to run** and can close the wizard.
4. **Run (Play)** — If you click **Run** without having set up, the same wizard opens with a pending job start; when you complete the wizard, the job starts.

Quick actions in the Probe panel let you run **individual** zeroing methods (e.g. BitZero XY, Touchplate Z) without going through the full plan. Use those for one-off zeroing; use **Set up job** for a full pre-job sequence.

---

## Next steps

- [Zeroing methods](../machine-control/zeroing-methods) (using zeroing in the UI — jogging, probing, workpiece zero)
- [Zeroing the workpiece](../machine-control/zeroing-workpiece)
- [Setup screen](../workflow/setup-screen)
