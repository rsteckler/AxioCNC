import find from 'lodash/find';
import castArray from 'lodash/castArray';
import isPlainObject from 'lodash/isPlainObject';
import uuid from 'uuid';
import fs from 'fs';
import settings from '../config/settings';
import logger from '../lib/logger';
import config from '../services/configstore';
import monitor from '../services/monitor';
import { getPagingRange } from './paging';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:watchfolders');
const CONFIG_KEY = 'watchFolders';

const getSanitizedRecords = () => {
  const records = castArray(config.get(CONFIG_KEY, []));

  let shouldUpdate = false;
  for (let i = 0; i < records.length; ++i) {
    if (!isPlainObject(records[i])) {
      records[i] = {};
    }

    const record = records[i];

    if (!record.id) {
      record.id = uuid.v4();
      shouldUpdate = true;
    }

    // Defaults
    if (record.enabled === undefined) {
      record.enabled = true;
    }
    if (record.type === undefined) {
      record.type = 'local';
    }
  }

  if (shouldUpdate) {
    log.debug(`update sanitized records: ${JSON.stringify(records)}`);
    config.set(CONFIG_KEY, records, { silent: true });
  }

  return records;
};

// Get all watch folders
export const fetch = (req, res) => {
  const records = getSanitizedRecords();
  const paging = !!req.query.paging;

  if (paging) {
    const { page = 1, pageLength = 10 } = req.query;
    const totalRecords = records.length;
    const [begin, end] = getPagingRange({ page, pageLength, totalRecords });
    const pagedRecords = records.slice(begin, end);

    res.send({
      pagination: {
        page: Number(page),
        pageLength: Number(pageLength),
        totalRecords: Number(totalRecords)
      },
      records: pagedRecords.map(record => {
        const { id, name, type, path, enabled, mtime } = { ...record };
        return { id, name, type, path, enabled, mtime };
      })
    });
  } else {
    res.send({
      records: records.map(record => {
        const { id, name, type, path, enabled, mtime } = { ...record };
        return { id, name, type, path, enabled, mtime };
      })
    });
  }
};

// Create a new watch folder
export const create = (req, res) => {
  const {
    name = '',
    type = 'local',
    path: folderPath = '',
    enabled = true
  } = { ...req.body };

  if (!name) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  if (!folderPath) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "path" parameter must not be empty'
    });
    return;
  }

  // Validate local path exists
  if (type === 'local' && !fs.existsSync(folderPath)) {
    res.status(ERR_BAD_REQUEST).send({
      msg: `The directory "${folderPath}" does not exist`
    });
    return;
  }

  try {
    const records = getSanitizedRecords();
    const record = {
      id: uuid.v4(),
      mtime: new Date().getTime(),
      name: name,
      type: type,
      path: folderPath,
      enabled: !!enabled
    };

    records.push(record);
    config.set(CONFIG_KEY, records);

    // Start watching if enabled
    if (enabled && type === 'local') {
      monitor.addFolder(record.id, folderPath);
    }

    res.send({ id: record.id, mtime: record.mtime });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

// Get a single watch folder
export const read = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  const { mtime, name, type, path, enabled } = { ...record };
  res.send({ id, mtime, name, type, path, enabled });
};

// Update a watch folder
export const update = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  const {
    name = record.name,
    type = record.type,
    path: folderPath = record.path,
    enabled = record.enabled
  } = { ...req.body };

  // Validate local path exists if changing path
  if (type === 'local' && folderPath !== record.path && !fs.existsSync(folderPath)) {
    res.status(ERR_BAD_REQUEST).send({
      msg: `The directory "${folderPath}" does not exist`
    });
    return;
  }

  try {
    const wasEnabled = record.enabled;
    const oldPath = record.path;

    record.mtime = new Date().getTime();
    record.name = String(name || '');
    record.type = String(type || 'local');
    record.path = String(folderPath || '');
    record.enabled = Boolean(enabled);

    config.set(CONFIG_KEY, records);

    // Update monitoring
    if (record.type === 'local') {
      if (!wasEnabled && record.enabled) {
        // Was disabled, now enabled - start watching
        monitor.addFolder(record.id, record.path);
      } else if (wasEnabled && !record.enabled) {
        // Was enabled, now disabled - stop watching
        monitor.removeFolder(record.id);
      } else if (wasEnabled && record.enabled && oldPath !== record.path) {
        // Path changed - restart watching
        monitor.removeFolder(record.id);
        monitor.addFolder(record.id, record.path);
      }
    }

    res.send({ id: record.id, mtime: record.mtime });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

// Delete a watch folder
export const __delete = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  try {
    // Stop watching if it was enabled
    if (record.enabled && record.type === 'local') {
      monitor.removeFolder(record.id);
    }

    const filteredRecords = records.filter(r => r.id !== id);
    config.set(CONFIG_KEY, filteredRecords);

    res.send({ id: record.id });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

// Browse local filesystem (for folder picker)
export const browse = (req, res) => {
  const targetPath = req.query.path || '/';

  try {
    if (!fs.existsSync(targetPath)) {
      res.status(ERR_NOT_FOUND).send({
        msg: 'Path does not exist'
      });
      return;
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      res.status(ERR_BAD_REQUEST).send({
        msg: 'Path is not a directory'
      });
      return;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: require('path').join(targetPath, entry.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.send({
      path: targetPath,
      directories: directories
    });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to browse directory'
    });
  }
};
