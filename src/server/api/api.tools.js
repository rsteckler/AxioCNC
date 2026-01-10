import find from 'lodash/find';
import castArray from 'lodash/castArray';
import isPlainObject from 'lodash/isPlainObject';
import uuid from 'uuid';
import settings from '../config/settings';
import logger from '../lib/logger';
import config from '../services/configstore';
import { getPagingRange } from './paging';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:tools');
const CONFIG_KEY = 'tools';

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
  }

  if (shouldUpdate) {
    log.debug(`update sanitized records: ${JSON.stringify(records)}`);

    // Pass `{ silent changes }` will suppress the change event
    config.set(CONFIG_KEY, records, { silent: true });
  }

  return records;
};

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
        const { id, mtime, toolId, name, description, diameter, type } = { ...record };
        return { id, mtime, toolId, name, description, diameter, type };
      })
    });
  } else {
    res.send({
      records: records.map(record => {
        const { id, mtime, toolId, name, description, diameter, type } = { ...record };
        return { id, mtime, toolId, name, description, diameter, type };
      })
    });
  }
};

export const create = (req, res) => {
  const { toolId, name, description = '', diameter, type = '' } = { ...req.body };

  if (typeof toolId !== 'number' && typeof toolId !== 'string') {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "toolId" parameter must be a number'
    });
    return;
  }

  // Convert toolId to number if it's a string
  const numericToolId = typeof toolId === 'string' ? parseInt(toolId, 10) : toolId;

  if (Number.isNaN(numericToolId) || numericToolId < 0) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "toolId" parameter must be a non-negative number'
    });
    return;
  }

  if (!name || !name.trim()) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  // Check for duplicate toolId
  const records = getSanitizedRecords();
  const existingTool = find(records, { toolId: numericToolId });
  if (existingTool) {
    res.status(ERR_BAD_REQUEST).send({
      msg: `Tool ID ${numericToolId} already exists`
    });
    return;
  }

  try {
    const record = {
      id: uuid.v4(),
      mtime: new Date().getTime(),
      toolId: numericToolId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      diameter: diameter != null && diameter !== '' ? Number(diameter) : null,
      type: type ? String(type).trim() : ''
    };

    records.push(record);
    // Sort by toolId
    records.sort((a, b) => (a.toolId || 0) - (b.toolId || 0));
    config.set(CONFIG_KEY, records);

    res.send({ id: record.id, mtime: record.mtime });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

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

  const { mtime, toolId, name, description, diameter, type } = { ...record };
  res.send({ id, mtime, toolId, name, description, diameter, type });
};

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
    toolId = record.toolId,
    name = record.name,
    description = record.description,
    diameter = record.diameter,
    type = record.type
  } = { ...req.body };

  // Validate toolId if provided
  if (toolId !== undefined) {
    const numericToolId = typeof toolId === 'string' ? parseInt(toolId, 10) : toolId;

    if (Number.isNaN(numericToolId) || numericToolId < 0) {
      res.status(ERR_BAD_REQUEST).send({
        msg: 'The "toolId" parameter must be a non-negative number'
      });
      return;
    }

    // Check for duplicate toolId (if changed)
    if (numericToolId !== record.toolId) {
      const existingTool = find(records, (r) => r.id !== id && r.toolId === numericToolId);
      if (existingTool) {
        res.status(ERR_BAD_REQUEST).send({
          msg: `Tool ID ${numericToolId} already exists`
        });
        return;
      }
    }
  }

  // Validate name
  const toolName = name != null ? String(name).trim() : record.name;
  if (!toolName) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  try {
    record.mtime = new Date().getTime();
    record.toolId = typeof toolId === 'string' ? parseInt(toolId, 10) : (toolId ?? record.toolId);
    record.name = toolName;
    record.description = description != null ? String(description).trim() : '';
    record.diameter = diameter != null && diameter !== '' ? Number(diameter) : null;
    record.type = type != null ? String(type).trim() : '';

    // Sort by toolId after update
    records.sort((a, b) => (a.toolId || 0) - (b.toolId || 0));
    config.set(CONFIG_KEY, records);

    res.send({ id: record.id, mtime: record.mtime });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};

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
    const filteredRecords = records.filter(record => {
      return record.id !== id;
    });
    config.set(CONFIG_KEY, filteredRecords);

    res.send({ id: record.id });
  } catch (err) {
    log.error(err);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to save ' + JSON.stringify(settings.rcfile)
    });
  }
};
