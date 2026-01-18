# Docker Usage Guide

This guide covers running AxioCNC in Docker, including volume mounts, serial port passthrough, and port configuration.

## Quick Start

### Basic Run

**Using buildx (recommended):**
```bash
# Build with buildx
docker buildx build --load -t axiocnc:latest .

# Run the container
docker run -d -p 8000:8000 --name axiocnc axiocnc:latest
```

**Using traditional docker build (fallback):**
```bash
# Enable BuildKit for cache mounts (recommended)
export DOCKER_BUILDKIT=1

# Build
docker build -t axiocnc:latest .

# Run the container
docker run -d -p 8000:8000 --name axiocnc axiocnc:latest
```

**Note:** We recommend using `docker buildx build` for better performance and multi-platform support. See [Building the Image](#building-the-image) for more details.

The web interface will be available at `http://localhost:8000`.

### Using Pre-built Image (from GHCR)

```bash
docker pull ghcr.io/rsteckler/axiocnc:latest
docker run -d -p 8000:8000 --name axiocnc ghcr.io/rsteckler/axiocnc:latest
```

---

## Port Configuration

### HTTP Port (Default: 8000)

The AxioCNC server listens on port 8000 by default. You can change this using the `--port` flag:

```bash
docker run -d -p 8080:8080 \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest \
  --port 8080 --host 0.0.0.0 --allow-remote-access
```

**Note:** Always use `--host 0.0.0.0` when running in Docker to allow external connections.

### Port Mapping

Use Docker's `-p` flag to map container ports to host ports:

```bash
# Map host port 8000 to container port 8000 (default)
docker run -p 8000:8000 axiocnc:latest

# Map host port 8080 to container port 8000
docker run -p 8080:8000 axiocnc:latest

# Map host port 8000 to container port 8000 (both UDP and TCP if needed)
docker run -p 8000:8000/tcp axiocnc:latest
```

### MediaMTX HTTP Port

MediaMTX runs as a sidecar process inside the container on port 8888 (internal, loopback only). This port is **not exposed externally** - MediaMTX streams are accessed through the main server's reverse proxy at `/api/streams/{cameraId}/index.m3u8`.

You do **not** need to map port 8888. The MediaMTX HTTP port is internal to the container and accessed by the Node.js server only.

---

## Serial Port Passthrough

AxioCNC requires access to serial devices (e.g., `/dev/ttyUSB0`, `/dev/ttyACM0`) to communicate with CNC controllers.

### Linux: Specific Device Passthrough (Recommended)

Pass through individual serial devices using the `--device` flag:

```bash
# Single serial device
docker run -d -p 8000:8000 \
  --device=/dev/ttyUSB0 \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest

# Multiple serial devices
docker run -d -p 8000:8000 \
  --device=/dev/ttyUSB0 \
  --device=/dev/ttyACM0 \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

**Find available serial devices:**
```bash
ls -l /dev/ttyUSB* /dev/ttyACM*  # List available serial ports
```

### Alternative: Privileged Mode (Not Recommended)

Using `--privileged` gives the container full access to all devices but is a security risk:

```bash
docker run -d -p 8000:8000 \
  --privileged \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

**Why not recommended:**
- Gives container root-level access to the host
- Bypasses Docker's security isolation
- Only use if specific device passthrough doesn't work

### Permission Issues

If you encounter permission errors accessing serial devices:

1. **Add your user to the `dialout` group** (on the host):
   ```bash
   sudo usermod -a -G dialout $USER
   # Log out and back in for changes to take effect
   ```

2. **Verify group membership:**
   ```bash
   groups $USER  # Should show "dialout" in the list
   ```

3. **Check device permissions:**
   ```bash
   ls -l /dev/ttyUSB0  # Should show read/write permissions for dialout group
   ```

---

## Volume Mounts

### User Data Directory (Recommended)

Mount the user data directory to persist settings, MediaMTX config/logs, job history, and uploaded files:

```bash
docker run -d -p 8000:8000 \
  -v ~/.axiocnc:/root/.axiocnc \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

**What's persisted:**
- Settings (`~/.axiocnc/.cncrc`)
- MediaMTX config (`~/.axiocnc/mediamtx/mediamtx.yml`)
- MediaMTX logs (`~/.axiocnc/mediamtx/logs/`)
- Job history (`~/.axiocnc/jobhistory.json`)
- Custom themes (`~/.axiocnc/themes/`)
- Uploaded G-code files (if stored in user data directory)

**Note:** The container runs as root (UID 0) by default, so the user data directory inside the container is `/root/.axiocnc`. Mount your host's `~/.axiocnc` to this path.

### Custom Mount Points

```bash
# Use a custom host directory
docker run -d -p 8000:8000 \
  -v /path/on/host:/root/.axiocnc \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest

# Mount only MediaMTX config/logs
docker run -d -p 8000:8000 \
  -v ~/.axiocnc/mediamtx:/root/.axiocnc/mediamtx \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

---

## Environment Variables

### NODE_ENV

Set to `production` for optimized performance:

```bash
docker run -d -p 8000:8000 \
  -e NODE_ENV=production \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

**Note:** The Dockerfile already sets `NODE_ENV=production` by default, but you can override it.

### Other Environment Variables

The server CLI accepts command-line arguments rather than environment variables. See the [Command-Line Options](#command-line-options) section below.

---

## Command-Line Options

You can override the default CMD arguments when running the container:

```bash
# Change port and host
docker run -d -p 8080:8080 \
  ghcr.io/rsteckler/axiocnc:latest \
  --port 8080 --host 0.0.0.0 --allow-remote-access

# Enable verbose logging
docker run -d -p 8000:8000 \
  ghcr.io/rsteckler/axiocnc:latest \
  --verbose --allow-remote-access

# Specify controller type
docker run -d -p 8000:8000 \
  ghcr.io/rsteckler/axiocnc:latest \
  --controller Grbl --allow-remote-access
```

**Available options:**
- `--port <port>` - Set listen port (default: 8000)
- `--host <host>` - Set listen address (default: 0.0.0.0)
- `--allow-remote-access` - Allow remote access (required for Docker)
- `--verbose` - Increase verbosity (-v, -vv, -vvv)
- `--controller <type>` - Specify controller: Grbl|Marlin|Smoothie|TinyG|g2core
- `--config <filename>` - Set config file (default: ~/.cncrc)

See `docker run ghcr.io/rsteckler/axiocnc:latest --help` for full option list.

---

## Complete Examples

### Basic Usage

```bash
docker run -d \
  --name axiocnc \
  -p 8000:8000 \
  ghcr.io/rsteckler/axiocnc:latest
```

### With Serial Port and Volume Mount

```bash
docker run -d \
  --name axiocnc \
  -p 8000:8000 \
  -v ~/.axiocnc:/root/.axiocnc \
  --device=/dev/ttyUSB0 \
  ghcr.io/rsteckler/axiocnc:latest
```

### Custom Port

```bash
docker run -d \
  --name axiocnc \
  -p 8080:8080 \
  ghcr.io/rsteckler/axiocnc:latest \
  --port 8080 --host 0.0.0.0 --allow-remote-access
```

### Using Docker Compose

See `docker-compose.yml` for a complete example. Run with:

```bash
docker-compose up -d
```

Stop with:

```bash
docker-compose down
```

### Multiple Serial Devices

```bash
docker run -d \
  --name axiocnc \
  -p 8000:8000 \
  -v ~/.axiocnc:/root/.axiocnc \
  --device=/dev/ttyUSB0 \
  --device=/dev/ttyACM0 \
  --device=/dev/ttyUSB1 \
  ghcr.io/rsteckler/axiocnc:latest
```

---

## MediaMTX Considerations

### Config and Logs Location

MediaMTX stores its configuration and logs in the user data directory:

- **Config:** `~/.axiocnc/mediamtx/mediamtx.yml`
- **Logs:** `~/.axiocnc/mediamtx/logs/mediamtx-process.log`

### Persisting MediaMTX Data

To persist MediaMTX config and logs across container restarts, mount the user data directory:

```bash
docker run -d -p 8000:8000 \
  -v ~/.axiocnc:/root/.axiocnc \
  --name axiocnc \
  ghcr.io/rsteckler/axiocnc:latest
```

This ensures MediaMTX configuration is preserved when the container is recreated.

### MediaMTX Binary

The MediaMTX binary is included in the Docker image (located in `vendor/mediamtx/` in the build context). The binary is selected based on the target platform/architecture during the Docker build.

---

## Health Check

The Dockerfile includes a health check that verifies the server is responding:

```bash
# Check container health status
docker ps  # Shows health status in STATUS column

# Inspect health check details
docker inspect --format='{{.State.Health.Status}}' axiocnc

# View health check logs
docker inspect --format='{{json .State.Health}}' axiocnc | jq
```

The health check:
- Checks `/api` endpoint (returns 401 when healthy)
- Runs every 30 seconds
- Has a 3-second timeout
- Waits 10 seconds before first check (start period)
- Retries 3 times before marking as unhealthy

---

## Troubleshooting

### Serial Port Permission Issues

**Problem:** Container cannot access `/dev/ttyUSB0`

**Solution:**
1. Verify device exists: `ls -l /dev/ttyUSB0`
2. Check host permissions: Ensure your user is in the `dialout` group
3. Use `--device` flag (not `--privileged` unless necessary)
4. Check container logs: `docker logs axiocnc`

### Port Conflicts

**Problem:** Port 8000 is already in use

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :8000

# Use a different port
docker run -d -p 8080:8000 ghcr.io/rsteckler/axiocnc:latest \
  --port 8000 --host 0.0.0.0 --allow-remote-access
```

### Volume Mount Issues

**Problem:** Settings not persisting after container restart

**Solution:**
1. Verify volume mount: `docker inspect axiocnc | grep -A 10 Mounts`
2. Check host directory permissions: `ls -ld ~/.axiocnc`
3. Ensure directory exists: `mkdir -p ~/.axiocnc`

### Container Won't Start

**Problem:** Container exits immediately

**Solution:**
```bash
# Check logs
docker logs axiocnc

# Run interactively to see errors
docker run -it --rm ghcr.io/rsteckler/axiocnc:latest

# Check if health check is failing
docker inspect --format='{{json .State.Health}}' axiocnc
```

### MediaMTX Not Starting

**Problem:** MediaMTX process fails to start

**Solution:**
1. Check MediaMTX logs: `cat ~/.axiocnc/mediamtx/logs/mediamtx-process.log`
2. Verify config file exists: `cat ~/.axiocnc/mediamtx/mediamtx.yml`
3. Check container logs: `docker logs axiocnc | grep -i mediamtx`

---

## Building the Image

### Prerequisites

**Docker buildx is required** for optimal builds. It's included with Docker Desktop and Docker Engine 20.10+.

Enable BuildKit (required for buildx features):
```bash
# Set environment variable (add to ~/.bashrc or ~/.zshrc for persistence)
export DOCKER_BUILDKIT=1

# Or use inline
DOCKER_BUILDKIT=1 docker build ...
```

Check if buildx is available:
```bash
docker buildx version
```

If buildx is not installed:
```bash
# Create and use a new builder instance
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap
```

### Build from Source

```bash
# Basic build with buildx (uses BuildKit features)
docker buildx build -t axiocnc:latest .

# Build with custom tag
docker buildx build -t ghcr.io/rsteckler/axiocnc:v1.10.112 .

# Build and load into local Docker (for immediate use)
docker buildx build --load -t axiocnc:latest .
```

**Note:** The `--load` flag is required when building with `docker buildx build` if you want to use the image locally with `docker run`. Without `--load`, the image is stored in the buildx builder cache only.

### Multi-Platform Builds

Buildx supports multi-architecture builds. Build for multiple platforms:

```bash
# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  -t ghcr.io/rsteckler/axiocnc:latest \
  --push .

# Build for specific architecture only
docker buildx build \
  --platform linux/arm64 \
  -t axiocnc:arm64 \
  --load .
```

**Supported platforms:**
- `linux/amd64` - x86_64 (Intel/AMD)
- `linux/arm64` - ARM64 (Raspberry Pi 4, Apple Silicon)
- `linux/arm/v7` - ARMv7 (Raspberry Pi 3 and older)

**Note:** Multi-platform builds require pushing to a registry (`--push`) or exporting to a specific format. They cannot be loaded directly into local Docker.

### Build Cache

The Dockerfile uses BuildKit cache mounts for faster rebuilds:

```bash
# Build with cache (automatically used with BuildKit)
docker buildx build --load -t axiocnc:latest .

# Build without cache (clean build)
docker buildx build --no-cache --load -t axiocnc:latest .
```

Cache mounts speed up:
- Yarn package installation (cached between builds)
- npm/yarn cache directories

### Build Arguments (Future)

If needed in the future, you can pass build arguments:

```bash
docker buildx build \
  --build-arg NODE_VERSION=18 \
  --load \
  -t axiocnc:latest .
```

### Build Cache

The Dockerfile is optimized for layer caching:
- Package files (`package.json`, `yarn.lock`) are copied first
- Dependencies are installed before source code is copied
- Source code changes don't invalidate dependency layers

---

## Image Size

The final image size should be approximately:
- **Build stage:** ~1-2 GB (includes build tools)
- **Runtime stage:** ~300-500 MB (production dependencies only)

To reduce image size further:
- Use `node:18-alpine` instead of `node:18-slim` (smaller, but may have compatibility issues with native modules)
- Remove unnecessary files in `.dockerignore`
- Use multi-stage builds (already implemented)

---

## Security Considerations

### Non-Root User (Future Enhancement)

The current Dockerfile runs as root for simplicity. For production deployments, consider:

1. Creating a non-root user in the Dockerfile
2. Adjusting file permissions accordingly
3. Using `USER` directive to run as non-root

**Note:** Serial port access may require root or specific group membership. Test thoroughly if running as non-root.

### Network Security

- Use Docker networks to isolate containers
- Only expose necessary ports
- Use reverse proxy (nginx, Traefik) for HTTPS/SSL termination

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [AxioCNC Project Repository](https://github.com/rsteckler/axiocnc)
- [MediaMTX Documentation](https://github.com/bluenviron/mediamtx)

---

## Support

For issues, questions, or contributions:
- GitHub Issues: [AxioCNC Issues](https://github.com/rsteckler/axiocnc/issues)
- Project Documentation: See `docs/` directory
