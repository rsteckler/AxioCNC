---
id: 11-troubleshooting
sidebar_position: 11
title: Troubleshooting / FAQ
---

# Troubleshooting / FAQ

Common errors, fixes, and how to report bugs.

## Common Errors and Fixes

### Serial Port Permission Denied

**Error:** `Error: EACCES: permission denied, open '/dev/ttyUSB0'`

**Fix (Linux):**
```bash
sudo usermod -a -G dialout $USER
# Log out and back in (or reboot)
groups $USER  # Should list "dialout"
```

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::8000`

**Fix:**
```bash
# Linux/macOS
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Build Fails on First Run

**Error:** Various compilation errors (Babel, Vite, etc.)

**Fix:**
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
yarn install
```

### FakeTTY / GRBL Sim Not in Port List

**Problem:** After `yarn dev:grblsim:setup`, fakeTTY doesn't appear in machine port dropdown.

**Fix:**
```bash
yarn dev:grblsim:enable
```
This adds fakeTTY to `~/.axiocnc/config.json`. Restart the server afterward.

### GRBL Simulator Won't Start

**Error:** Simulator exits immediately or build errors.

**Fix:**
```bash
yarn dev:grblsim:clean
yarn dev:grblsim:setup
```

### Tests Fail with "Cannot find module" or Babel Errors

**Fix:**
```bash
yarn install
yarn test:test
```
Tests use `@babel/register`; ensure deps are installed.

### Lint or Typecheck Failures

**Fix:**
```bash
yarn test:lint
yarn test:typecheck
```
Address reported issues. Use `yarn test:lint:eslint-debug` if ESLint is unclear.

## Where Logs Live

- **Server (dev):** Console output of `yarn dev:start-server`
- **Frontend:** Browser DevTools console (F12)
- **Production:** `~/.axiocnc/logs/` (if file logging is enabled)
- **MediaMTX:** `~/.axiocnc/mediamtx/logs/`

:::caution Placeholder
**Placeholder:** File logging for the main server is not fully documented yet. Console-only by default.
:::

## How to Report a Bug

1. **Search [Issues](https://github.com/rsteckler/AxioCNC/issues)** to see if it's already reported.
2. **Open a new issue** with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, AxioCNC version, controller type)
   - Relevant logs or screenshots

## How to Provide a Reproducer

- **Minimal steps** — Smallest set of actions that trigger the bug
- **G-code file** — If it's job-specific, attach a minimal `.gcode` (or describe it)
- **Config** — Redact secrets, but mention non-default settings (e.g. port, baud rate, controller)
- **Logs** — Paste relevant console/server logs (no secrets)

## FAQ

**Q: Will this work with my controller?**  
A: AxioCNC supports Grbl, Marlin, Smoothie, and TinyG/g2core. If your controller runs one of these, it should work.

**Q: Can I use this on a Raspberry Pi?**  
A: Yes. Use the ARM32 (armhf) or ARM64 .deb packages. See [README](https://github.com/rsteckler/AxioCNC#raspberry-pi) and install docs.

**Q: Does it need internet?**  
A: No. Once installed, it runs locally. Updates, docs, and telemetry (if any) may use the network.

**Q: Multiple users / machines?**  
A: Multiple browsers can connect to the same server. Multi-machine setup is per your deployment (e.g. multiple instances, configs).

**Q: Where is config stored?**  
A: `~/.axiocnc/config.json` and related runtime data under `~/.axiocnc/`. See [Architecture](./04-architecture.md#runtime-folder-axiocnc).

## Next Steps

- **[Getting Set Up](./01-getting-set-up.md)** — Dev environment setup
- **[Contributing](./08-contributing.md)** — Submitting fixes via PR
