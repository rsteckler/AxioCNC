/**
 * Streams API
 *
 * Provides metadata about camera streams (HLS/MJPEG)
 */
import config from '../services/configstore';
import {
  ERR_NOT_FOUND,
} from '../constants';

const CAMERA_CONFIG_KEY = 'camera';

/**
 * Get camera (single camera only)
 */
const getCamera = () => {
  const camera = config.get(CAMERA_CONFIG_KEY, null);
  return camera && typeof camera === 'object' ? camera : null;
};

/**
 * GET /api/streams/:id
 * Returns stream metadata (type and source URL)
 */
export const get = (req, res) => {
  // Get the single camera (id parameter is ignored)
  const camera = getCamera();

  if (!camera || !camera.enabled) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Stream not found',
    });
    return;
  }

  const cameraType = camera.type;
  const streamId = camera.id; // Use camera's ID for stream paths
  let streamType = null;
  let streamSrc = null;

  if (cameraType === 'rtsp') {
    // RTSP stream converted to HLS via MediaMTX
    streamType = 'hls';
    streamSrc = `/streams/${streamId}/index.m3u8`;
  } else if (cameraType === 'mjpeg') {
    // MJPEG stream proxied through Node
    streamType = 'mjpeg';
    streamSrc = `/streams/${streamId}/mjpeg`;
  } else {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Stream type not supported',
    });
    return;
  }

  res.send({
    type: streamType,
    src: streamSrc,
  });
};
