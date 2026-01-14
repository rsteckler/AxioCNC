/**
 * Streams API
 *
 * Provides metadata about camera streams (HLS/MJPEG)
 */
import find from 'lodash/find';
import castArray from 'lodash/castArray';
import config from '../services/configstore';
import {
  ERR_NOT_FOUND,
} from '../constants';

const CAMERAS_CONFIG_KEY = 'cameras';

/**
 * Get camera by ID
 */
const getCameraById = (id) => {
  const cameras = castArray(config.get(CAMERAS_CONFIG_KEY, []));
  return find(cameras, { id: id }) || null;
};

/**
 * GET /api/streams/:id
 * Returns stream metadata (type and source URL)
 */
export const get = (req, res) => {
  const streamId = req.params.id;

  // Get camera by ID
  const camera = getCameraById(streamId);

  if (!camera || !camera.enabled) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Stream not found',
    });
    return;
  }

  const cameraType = camera.type;
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
