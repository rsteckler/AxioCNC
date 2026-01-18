import fs from 'fs';
import path from 'path';
import logger from '../lib/logger';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:workfiles');

const getUserHome = () => (process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
const WORKFILES_DIR = path.resolve(getUserHome(), '.axiocnc', 'workfiles');

// Ensure workfiles directory exists
const ensureWorkfilesDir = () => {
  try {
    if (!fs.existsSync(WORKFILES_DIR)) {
      fs.mkdirSync(WORKFILES_DIR, { recursive: true });
      log.info(`Created workfiles directory: ${WORKFILES_DIR}`);
    }
  } catch (err) {
    log.error(`Failed to create workfiles directory: ${err.message}`);
  }
};

// Initialize workfiles directory on module load
ensureWorkfilesDir();

// Parse G-code file to extract metadata
const parseGcodeMetadata = (gcode) => {
  const lines = gcode.split('\n').filter(line => line.trim().length > 0);
  const toolPattern = /\bT(\d+)\b/gi;
  const toolIds = new Set();
  let match;

  while ((match = toolPattern.exec(gcode)) !== null) {
    toolIds.add(parseInt(match[1], 10));
  }

  return {
    lines: lines.length,
    tools: Array.from(toolIds).sort((a, b) => a - b)
  };
};

// Get file metadata (size, mtime, parsed info)
const getFileMetadata = (filename) => {
  const filePath = path.join(WORKFILES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  let metadata = {
    filename,
    size: stat.size,
    mtime: stat.mtime.getTime()
  };

  // Pre-parse G-code file to extract metadata
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseGcodeMetadata(content);
    metadata = {
      ...metadata,
      ...parsed
    };
  } catch (err) {
    log.warn(`Failed to parse metadata for ${filename}: ${err.message}`);
  }

  return metadata;
};

// List all workfiles
export const list = (req, res) => {
  try {
    ensureWorkfilesDir();

    const files = fs.readdirSync(WORKFILES_DIR)
      .filter(file => {
        const filePath = path.join(WORKFILES_DIR, file);
        const stat = fs.statSync(filePath);
        return stat.isFile();
      })
      .map(filename => getFileMetadata(filename))
      .filter(meta => meta !== null)
      .sort((a, b) => b.mtime - a.mtime); // Sort by modified time, newest first

    res.send({ files });
  } catch (err) {
    log.error(`Failed to list workfiles: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to list workfiles'
    });
  }
};

// Upload/save a workfile
export const upload = (req, res) => {
  const { name, gcode } = req.body;

  if (!name) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'File name is required'
    });
    return;
  }

  if (!gcode) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'G-code content is required'
    });
    return;
  }

  // Sanitize filename to prevent directory traversal
  const filename = path.basename(name);
  if (filename !== name || filename.includes('..')) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Invalid file name'
    });
    return;
  }

  try {
    ensureWorkfilesDir();

    const filePath = path.join(WORKFILES_DIR, filename);
    fs.writeFileSync(filePath, gcode, 'utf8');

    const metadata = getFileMetadata(filename);

    log.info(`Uploaded workfile: ${filename}`);
    res.send(metadata);
  } catch (err) {
    log.error(`Failed to upload workfile: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to upload workfile'
    });
  }
};

// Read workfile content
export const read = (req, res) => {
  const filename = req.params.filename || req.query.filename;

  if (!filename) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'File name is required'
    });
    return;
  }

  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || filename.includes('..')) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Invalid file name'
    });
    return;
  }

  const filePath = path.join(WORKFILES_DIR, safeFilename);

  try {
    if (!fs.existsSync(filePath)) {
      res.status(ERR_NOT_FOUND).send({
        msg: 'File not found'
      });
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const metadata = getFileMetadata(safeFilename);

    res.send({
      filename: safeFilename,
      gcode: content,
      ...metadata
    });
  } catch (err) {
    log.error(`Failed to read workfile: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to read workfile'
    });
  }
};
