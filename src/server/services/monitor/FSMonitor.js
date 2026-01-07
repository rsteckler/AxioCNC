import watch from 'watch';

class FSMonitor {
    root = '';

    monitor = null;

    files = {};

    watch(root) {
      watch.createMonitor(root, (monitor) => {
        this.unwatch();
        this.root = root;
        this.monitor = monitor;
        this.files = { ...monitor.files };

        monitor.on('created', (f, stat) => {
          this.files[f] = stat;
        });
        monitor.on('changed', (f, curr, prev) => {
          this.files[f] = curr;
        });
        monitor.on('removed', (f, stat) => {
          delete this.files[f];
        });
      });
    }

    unwatch() {
      if (this.monitor) {
        this.monitor.stop(); // Stop watching
        this.monitor = null;
      }
      this.files = {};
    }
}

/**
 * MultiMonitor manages multiple FSMonitor instances for watching multiple directories
 */
class MultiMonitor {
  monitors = new Map(); // Map<folderId, { root, monitor, files }>

  /**
   * Add a folder to watch
   * @param {string} id - Unique identifier for this folder
   * @param {string} root - Path to watch
   */
  addFolder(id, root) {
    // Remove existing if any
    this.removeFolder(id);

    const entry = {
      root: root,
      monitor: null,
      files: {}
    };

    watch.createMonitor(root, (monitor) => {
      entry.monitor = monitor;
      entry.files = { ...monitor.files };

      monitor.on('created', (f, stat) => {
        entry.files[f] = stat;
      });
      monitor.on('changed', (f, curr, prev) => {
        entry.files[f] = curr;
      });
      monitor.on('removed', (f, stat) => {
        delete entry.files[f];
      });
    });

    this.monitors.set(id, entry);
  }

  /**
   * Remove a folder from watching
   * @param {string} id - Folder identifier to remove
   */
  removeFolder(id) {
    const entry = this.monitors.get(id);
    if (entry && entry.monitor) {
      entry.monitor.stop();
    }
    this.monitors.delete(id);
  }

  /**
   * Get all monitored folders
   * @returns {Array<{id: string, root: string}>}
   */
  getFolders() {
    return Array.from(this.monitors.entries()).map(([id, entry]) => ({
      id,
      root: entry.root
    }));
  }

  /**
   * Get files from a specific folder
   * @param {string} id - Folder identifier
   * @returns {Object} Map of file paths to stats
   */
  getFilesForFolder(id) {
    const entry = this.monitors.get(id);
    return entry ? entry.files : {};
  }

  /**
   * Get all files across all monitored folders
   * @returns {Object} Map of file paths to stats
   */
  getAllFiles() {
    const allFiles = {};
    for (const entry of this.monitors.values()) {
      Object.assign(allFiles, entry.files);
    }
    return allFiles;
  }

  /**
   * Get the root path for a specific folder
   * @param {string} id - Folder identifier
   * @returns {string|null}
   */
  getRoot(id) {
    const entry = this.monitors.get(id);
    return entry ? entry.root : null;
  }

  /**
   * Stop watching all folders
   */
  unwatchAll() {
    for (const entry of this.monitors.values()) {
      if (entry.monitor) {
        entry.monitor.stop();
      }
    }
    this.monitors.clear();
  }
}

export default FSMonitor;
export { MultiMonitor };
