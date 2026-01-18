import MediaMTXManager from './MediaMTXManager';

const mediamtxManager = new MediaMTXManager();

const start = () => {
  mediamtxManager.start();
};

const stop = () => {
  mediamtxManager.stop();
};

const reload = () => {
  mediamtxManager.reload();
};

const getHttpPort = () => {
  return mediamtxManager.getHttpPort();
};

const getStreamPath = (cameraId) => {
  return mediamtxManager.getStreamPath(cameraId);
};

export default {
  start,
  stop,
  reload,
  getHttpPort,
  getStreamPath,
  manager: mediamtxManager // Expose manager for advanced usage
};
