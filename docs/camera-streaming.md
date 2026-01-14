# Camera Streaming Architecture

## Goal

User pastes a single "camera URL" (RTSP or HTTP MJPEG) + optional credentials into the app. The app returns a browser-playable stream URL and renders it.

## Constraints / Priorities

- **Must be easy for end-user**: paste URL → works
- **Keep code lean**: minimal complexity, maintainable
- **Keep CPU low**: prefer transmux (copy) not transcode
- **Prefer stream pipeline in a separate process** where feasible
- **Realtime latency not important**: acceptable delays are fine

## Approach

### RTSP Streams

RTSP → MediaMTX sidecar → HLS (m3u8 + fMP4 segments)

- RTSP streams are processed through a MediaMTX sidecar service
- MediaMTX converts RTSP to HLS format (m3u8 playlist + fMP4 segments)
- HLS is natively supported in Safari and can be used in other browsers with hls.js

### MJPEG Streams

MJPEG (HTTP Basic Auth) → Node proxy route → `<img src=...>` (or optionally `<video>` later)

- MJPEG streams are proxied through a Node.js route
- Supports HTTP Basic Authentication for credentials
- Rendered as a simple `<img>` tag (progressive JPEG stream)
- Future: could optionally use `<video>` for better control

## Unified Namespace and Metadata Endpoint

### Stream Metadata API

```
GET /streams/:id
```

Returns:
```json
{
  "type": "hls" | "mjpeg",
  "src": "/streams/:id/index.m3u8" | "/streams/:id/mjpeg"
}
```

This provides a unified way to access streams regardless of their underlying type, with the frontend choosing the appropriate rendering method based on the `type` field.

## Data Model (Persisted)

### CameraConfig

Persisted camera configuration stored in the database/state:

```typescript
interface CameraConfig {
  id: string                    // Unique identifier
  name: string                  // User-friendly name
  inputUrl: string              // rtsp://… or http://… (original URL)
  username?: string             // Optional authentication
  password?: string             // Optional authentication
  type?: 'rtsp' | 'mjpeg'      // Optional; computed from inputUrl
  enabled: boolean              // Whether stream is active
  createdAt: Date              // Timestamp
  updatedAt: Date              // Timestamp
}
```

The `type` field can be computed from the `inputUrl` (starts with `rtsp://` → `rtsp`, starts with `http://` or `https://` → `mjpeg`).

## Frontend Implementation

### HLS Streams (`type: 'hls'`)

- Use `<video>` element
- For Safari: native HLS support
- For other browsers: use hls.js library as fallback
- Stream URL: `/streams/:id/index.m3u8`

### MJPEG Streams (`type: 'mjpeg'`)

- Use `<img>` element
- Stream URL: `/streams/:id/mjpeg`
- Browser automatically handles progressive JPEG stream rendering

## Implementation Phases

This document serves as the specification for Step 0 (documentation phase). Future steps will implement:

1. Backend stream processing infrastructure (MediaMTX integration, MJPEG proxy)
2. Database schema and API endpoints for CameraConfig
3. Frontend UI for adding/editing camera configurations
4. Frontend streaming components (HLS player, MJPEG viewer)
5. Stream management and lifecycle (start/stop, health monitoring)
