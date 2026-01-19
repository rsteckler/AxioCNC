---
sidebar_position: 2
title: Getting Started
---
# Getting Started

Quick setup guide for local development.

## Prerequisites

- Node.js >= 18
- Yarn (v3.3.1 included in repo)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd AxioCNC
   ```

2. **Setup grbl-sim (optional)**
   
   If you don't have a physical CNC machine, use grbl-sim for testing:
   
   ```bash
   yarn dev:grblsim:clone    # Clone grbl-sim repository
   yarn dev:grblsim:fixup    # Apply bug fixes
   yarn dev:grblsim:build    # Build grbl-sim
   yarn dev:grblsim:run      # Start grbl-sim (in separate terminal)
   ```
   
   > **Note:** Skip this step if you're connecting to a real machine.

3. **Start the development servers**
   
   > **Note:** Dependencies are automatically installed when you run these commands if needed.
   
   Open two terminals:
   
   **Terminal 1 - Backend:**
   ```bash
   yarn dev:start-server
   ```
   Backend runs on port 8000.
   
   **Terminal 2 - Frontend:**
   ```bash
   yarn dev:start-app
   ```
   Frontend runs on port 5173.

4. **Access the application**
   
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Troubleshooting

- **Servers won't start**: Dependencies are installed automatically, but if you encounter issues, run `yarn install` manually.
- **Connection issues**: Ensure the backend is running on port 8000 before starting the frontend.
- **grbl-sim issues**: Run `yarn dev:grblsim:clean` to reset, then repeat the setup steps.

## Next Steps

- Read [`development.md`](./development.md) for development workflow details
- Check [`aidocs/overview.md`](../aidocs/overview.md) for project architecture
- Review [`aidocs/dev_prefs.md`](../aidocs/dev_prefs.md) for coding conventions
