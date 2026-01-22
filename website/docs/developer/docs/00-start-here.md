---
id: 00-start-here
sidebar_position: 0
title: Start Here
---

# Start Here

AxioCNC is a web-based interface for CNC controllers (Grbl, Marlin, Smoothie, TinyG) built on a Node.js/Express backend with a modern React 18 + TypeScript + Vite frontend. The project prioritizes **stability and predictability** for long-running CNC jobs, with a focus on preventing costly mistakes through careful UI design and reliable G-code execution.

**Tech Stack:**
- **Backend:** Node.js 18+, Express.js, Socket.IO, Winston logging
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Redux Toolkit
- **Desktop:** Electron (bundles server + web frontend)
- **Testing:** tap (Test Anything Protocol) for server tests
- **Build:** Yarn workspaces monorepo, Babel (server), Vite (web)

## Who This Is For

This documentation is for **open-source contributors** who want to:
- Fix bugs or add features
- Understand the codebase architecture
- Set up a local development environment
- Submit pull requests

**If you're an AxioCNC user looking for installation guides, usage help, or general documentation, go to [axiocnc.com/docs](https://axiocnc.com/docs).** These dev docs are for contributors, not end users.

## Quick Links

- **[Getting Set Up](./01-getting-set-up.md)** - Clone, install, run locally
- **[Contributing](./08-contributing.md)** - PR process and guidelines
- **[Architecture](./04-architecture.md)** - System design and mental model
- **[API Reference](./12-reference.md#api-reference)** - REST API documentation
- **[Releases](./09-release-process.md)** - Versioning and release process

## Project Principles

### 1. Stability First

:::danger
This code controls dangerous machines of people you will never meet.
:::

Bugs can cause:
- Machine crashes (uncontrolled movement)
- Tool breakage
- Workpiece damage
- Personal injury

**Protected code areas** require extra care when modifying. See [Making Changes Safely](./07-making-changes-safely.md#protected-code).

### 2. Easy Installation

Customers should be able to install and run AxioCNC with minimal friction:
- Native installers for Linux, Windows, macOS
- Raspberry Pi packages (ARM32/ARM64)
- Single command startup
- Clear error messages

### 3. Intuitive Workflow

The interface should:
- Follow the workflow of most CNC jobs (setup → run → monitor)
- Allow any workflow possible (flexible, not prescriptive)
- Prevent accidental actions (spaced controls, confirmations)
- Provide clear feedback (status, progress, errors)

## What's Next?

1. **[Get Set Up](./01-getting-set-up.md)** - Install dependencies and run the app locally
2. **[Repository Map](./02-repository-map.md)** - Understand the codebase structure
3. **[Day-1 Workflow](./03-day-1-workflow.md)** - Learn the development loop
