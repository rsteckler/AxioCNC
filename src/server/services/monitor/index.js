import fs from 'fs';
import path from 'path';
import minimatch from 'minimatch';
import FSMonitor, { MultiMonitor } from './FSMonitor';

// Legacy single-folder monitor (for backwards compatibility)
const monitor = new FSMonitor();

// Multi-folder monitor for new watch folders feature
const multiMonitor = new MultiMonitor();

// =============================================================================
// Legacy single-folder API (for backwards compatibility with --watch-directory)
// =============================================================================

const start = ({ watchDirectory }) => {
  monitor.watch(watchDirectory);
};

const stop = () => {
  monitor.unwatch();
};

const getFiles = (searchPath) => {
  const root = path.normalize(monitor.root);
  const files = Object.keys(monitor.files);
  const pattern = path.join(root, searchPath, '*');

  if (!root || pattern.indexOf(root) !== 0) {
    return [];
  }

  return minimatch
    .match(files, pattern, { matchBase: true })
    .map(file => {
      const stat = monitor.files[file] || {};

      return {
        name: path.basename(file),
        type: (function() {
          if (stat.isFile()) {
            return 'f';
          }
          if (stat.isDirectory()) {
            return 'd';
          }
          if (stat.isBlockDevice()) {
            return 'b';
          }
          if (stat.isCharacterDevice()) {
            return 'c';
          }
          if (stat.isSymbolicLink()) {
            return 'l';
          }
          if (stat.isFIFO()) {
            return 'p';
          }
          if (stat.isSocket()) {
            return 's';
          }
          return '';
        }()),
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime
      };
    });
};

const readFile = (file, callback) => {
  const root = monitor.root;
  file = path.join(root, file);

  fs.readFile(file, 'utf8', callback);
};

// =============================================================================
// Multi-folder API (for new watch folders feature)
// =============================================================================

/**
 * Add a folder to the multi-folder monitor
 * @param {string} id - Unique folder identifier
 * @param {string} folderPath - Path to watch
 */
const addFolder = (id, folderPath) => {
  multiMonitor.addFolder(id, folderPath);
};

/**
 * Remove a folder from the multi-folder monitor
 * @param {string} id - Folder identifier
 */
const removeFolder = (id) => {
  multiMonitor.removeFolder(id);
};

/**
 * Get all monitored folders
 * @returns {Array<{id: string, root: string}>}
 */
const getFolders = () => {
  return multiMonitor.getFolders();
};

/**
 * Get files from a specific watch folder
 * @param {string} id - Folder identifier
 * @param {string} searchPath - Relative path within the folder
 * @returns {Array} List of file info objects
 */
const getFilesFromFolder = (id, searchPath = '') => {
  const root = multiMonitor.getRoot(id);
  if (!root) {
    return [];
  }

  const files = Object.keys(multiMonitor.getFilesForFolder(id));
  const pattern = path.join(root, searchPath, '*');

  if (pattern.indexOf(root) !== 0) {
    return [];
  }

  return minimatch
    .match(files, pattern, { matchBase: true })
    .map(file => {
      const stat = multiMonitor.getFilesForFolder(id)[file] || {};

      return {
        name: path.basename(file),
        path: file,
        relativePath: path.relative(root, file),
        type: (function() {
          if (stat.isFile && stat.isFile()) {
 return 'f';
}
          if (stat.isDirectory && stat.isDirectory()) {
 return 'd';
}
          if (stat.isBlockDevice && stat.isBlockDevice()) {
 return 'b';
}
          if (stat.isCharacterDevice && stat.isCharacterDevice()) {
 return 'c';
}
          if (stat.isSymbolicLink && stat.isSymbolicLink()) {
 return 'l';
}
          if (stat.isFIFO && stat.isFIFO()) {
 return 'p';
}
          if (stat.isSocket && stat.isSocket()) {
 return 's';
}
          return '';
        }()),
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime
      };
    });
};

/**
 * Get files from all watch folders
 * @returns {Array} List of file info objects with folder info
 */
const getAllFilesFromFolders = () => {
  const folders = multiMonitor.getFolders();
  const allFiles = [];

  for (const { id, root } of folders) {
    const files = getFilesFromFolder(id);
    allFiles.push(...files.map(f => ({ ...f, folderId: id, folderRoot: root })));
  }

  return allFiles;
};

/**
 * Read a file from a specific watch folder
 * @param {string} id - Folder identifier
 * @param {string} file - Relative file path
 * @param {Function} callback - Callback(err, data)
 */
const readFileFromFolder = (id, file, callback) => {
  const root = multiMonitor.getRoot(id);
  if (!root) {
    callback(new Error('Folder not found'));
    return;
  }

  const fullPath = path.join(root, file);

  // Security: ensure the resolved path is within the root
  if (!fullPath.startsWith(root)) {
    callback(new Error('Invalid path'));
    return;
  }

  fs.readFile(fullPath, 'utf8', callback);
};

/**
 * Stop all multi-folder monitors
 */
const stopAll = () => {
  multiMonitor.unwatchAll();
};

export default {
  // Legacy API
  start,
  stop,
  getFiles,
  readFile,

  // Multi-folder API
  addFolder,
  removeFolder,
  getFolders,
  getFilesFromFolder,
  getAllFilesFromFolders,
  readFileFromFolder,
  stopAll
};
