import fs from 'fs';
import path from 'path';
import uuid from 'uuid';
import logger from '../lib/logger';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:themes');

// Get the themes directory path (in user home directory)
const getUserHome = () => (process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
const THEMES_DIR = path.resolve(getUserHome(), '.axiocnc', 'themes');

// Get the bundled themes directory (shipped with the app)
// Find project root by looking for the themes/ directory or package.json
// In dev: output/axiocnc/server/api/ -> go up to find themes/ in project root
// In prod: dist/axiocnc/server/api/ -> go up to find themes/ in project root
const findProjectRoot = () => {
  let current = __dirname;
  // Start from __dirname and go up until we find themes/ directory or package.json with themes/
  for (let i = 0; i < 10; i++) {
    const themesDir = path.join(current, 'themes');
    const packageJson = path.join(current, 'package.json');

    // Check if themes directory exists (most reliable indicator of project root)
    if (fs.existsSync(themesDir) && fs.statSync(themesDir).isDirectory()) {
      return current;
    }

    // Also check for package.json and themes/ together
    if (fs.existsSync(packageJson) && fs.existsSync(themesDir)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break; // Reached filesystem root
    }
    current = parent;
  }

  // Fallback: try process.cwd() and go up if needed
  let fallback = process.cwd();
  for (let i = 0; i < 5; i++) {
    const themesDir = path.join(fallback, 'themes');
    if (fs.existsSync(themesDir) && fs.statSync(themesDir).isDirectory()) {
      return fallback;
    }
    const parent = path.dirname(fallback);
    if (parent === fallback) {
      break;
    }
    fallback = parent;
  }

  // Last resort: use process.cwd()
  return process.cwd();
};

const PROJECT_ROOT = findProjectRoot();
const BUNDLED_THEMES_DIR = path.resolve(PROJECT_ROOT, 'themes');

// Ensure themes directory exists
const ensureThemesDir = () => {
  try {
    if (!fs.existsSync(THEMES_DIR)) {
      fs.mkdirSync(THEMES_DIR, { recursive: true });
      log.info(`Created themes directory: ${THEMES_DIR}`);
    }
  } catch (err) {
    log.error(`Failed to create themes directory: ${err.message}`);
  }
};

// Copy bundled themes to user themes directory (only if they don't exist)
const copyBundledThemes = () => {
  try {
    log.info(`Looking for bundled themes at: ${BUNDLED_THEMES_DIR}`);
    log.info(`Project root: ${PROJECT_ROOT}`);
    log.info(`Current working directory: ${process.cwd()}`);

    if (!fs.existsSync(BUNDLED_THEMES_DIR)) {
      log.warn(`No bundled themes directory found at: ${BUNDLED_THEMES_DIR}`);
      return;
    }

    const bundledFiles = fs.readdirSync(BUNDLED_THEMES_DIR);
    log.info(`Found ${bundledFiles.length} files in bundled themes directory`);
    let copiedCount = 0;
    let skippedCount = 0;

    for (const file of bundledFiles) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const srcPath = path.join(BUNDLED_THEMES_DIR, file);
      const destPath = path.join(THEMES_DIR, file);

      // Only copy if destination doesn't exist (don't overwrite user modifications)
      if (!fs.existsSync(destPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
          log.info(`Copied bundled theme: ${file}`);
        } catch (err) {
          log.error(`Failed to copy bundled theme ${file}: ${err.message}`);
        }
      } else {
        skippedCount++;
        log.debug(`Skipped ${file} (already exists)`);
      }
    }

    if (copiedCount > 0) {
      log.info(`Copied ${copiedCount} bundled theme(s) to ${THEMES_DIR}`);
    }
    if (skippedCount > 0) {
      log.info(`Skipped ${skippedCount} theme(s) (already exist)`);
    }
  } catch (err) {
    log.error(`Failed to copy bundled themes: ${err.message}`);
    log.error(err.stack);
  }
};

// Initialize themes directory and copy bundled themes on module load
ensureThemesDir();
copyBundledThemes();

// Validate theme structure
const validateTheme = (theme) => {
  if (!theme || typeof theme !== 'object') {
    return { valid: false, error: 'Theme must be a JSON object' };
  }
  if (!theme.name || typeof theme.name !== 'string') {
    return { valid: false, error: 'Theme must have a "name" string property' };
  }
  if (!theme.light || typeof theme.light !== 'object') {
    return { valid: false, error: 'Theme must have a "light" object with CSS variables' };
  }
  if (!theme.dark || typeof theme.dark !== 'object') {
    return { valid: false, error: 'Theme must have a "dark" object with CSS variables' };
  }
  return { valid: true };
};

// Read all theme files from the themes directory
const getThemes = () => {
  ensureThemesDir();

  const themes = [];

  try {
    const files = fs.readdirSync(THEMES_DIR);

    for (const file of files) {
      if (!file.endsWith('.json')) {
 continue;
}

      try {
        const filePath = path.join(THEMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const theme = JSON.parse(content);

        // Use filename (without extension) as id if not present
        if (!theme.id) {
          theme.id = path.basename(file, '.json');
        }

        const validation = validateTheme(theme);
        if (validation.valid) {
          themes.push({
            id: theme.id,
            name: theme.name,
            author: theme.author || null,
            version: theme.version || null,
            description: theme.description || null,
            filename: file,
          });
        } else {
          log.warn(`Invalid theme file ${file}: ${validation.error}`);
        }
      } catch (err) {
        log.warn(`Failed to read theme file ${file}: ${err.message}`);
      }
    }
  } catch (err) {
    log.error(`Failed to read themes directory: ${err.message}`);
  }

  return themes;
};

// Fetch all themes (metadata only)
export const fetch = (req, res) => {
  try {
    const themes = getThemes();
    res.send({ themes });
  } catch (err) {
    log.error(`Error fetching themes: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to fetch themes'
    });
  }
};

// Read a specific theme (full content including CSS variables)
export const read = (req, res) => {
  const id = req.params.id;

  try {
    ensureThemesDir();

    // Try to find the theme file
    const files = fs.readdirSync(THEMES_DIR);
    let themeFile = null;

    for (const file of files) {
      if (!file.endsWith('.json')) {
 continue;
}

      // Match by id or filename
      if (file === `${id}.json`) {
        themeFile = file;
        break;
      }

      try {
        const filePath = path.join(THEMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const theme = JSON.parse(content);
        if (theme.id === id) {
          themeFile = file;
          break;
        }
      } catch (err) {
        // Skip invalid files
      }
    }

    if (!themeFile) {
      res.status(ERR_NOT_FOUND).send({ msg: 'Theme not found' });
      return;
    }

    const filePath = path.join(THEMES_DIR, themeFile);
    const content = fs.readFileSync(filePath, 'utf8');
    const theme = JSON.parse(content);

    // Ensure id is set
    if (!theme.id) {
      theme.id = path.basename(themeFile, '.json');
    }

    res.send(theme);
  } catch (err) {
    log.error(`Error reading theme ${id}: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to read theme'
    });
  }
};

// Create/upload a new theme
export const create = (req, res) => {
  const theme = req.body;

  // Validate theme structure
  const validation = validateTheme(theme);
  if (!validation.valid) {
    res.status(ERR_BAD_REQUEST).send({ msg: validation.error });
    return;
  }

  try {
    ensureThemesDir();

    // Generate id if not provided
    if (!theme.id) {
      theme.id = uuid.v4();
    }

    // Sanitize id for filename (remove special chars)
    const safeId = theme.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeId}.json`;
    const filePath = path.join(THEMES_DIR, filename);

    // Check if theme already exists
    if (fs.existsSync(filePath)) {
      res.status(ERR_BAD_REQUEST).send({
        msg: 'A theme with this ID already exists'
      });
      return;
    }

    // Write theme file
    fs.writeFileSync(filePath, JSON.stringify(theme, null, 2), 'utf8');

    log.info(`Created theme: ${filename}`);

    res.send({
      err: null,
      id: theme.id,
      filename: filename
    });
  } catch (err) {
    log.error(`Error creating theme: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to create theme'
    });
  }
};

// Update an existing theme
export const update = (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  try {
    ensureThemesDir();

    // Find the theme file
    const files = fs.readdirSync(THEMES_DIR);
    let themeFile = null;

    for (const file of files) {
      if (!file.endsWith('.json')) {
 continue;
}

      if (file === `${id}.json`) {
        themeFile = file;
        break;
      }

      try {
        const filePath = path.join(THEMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const theme = JSON.parse(content);
        if (theme.id === id) {
          themeFile = file;
          break;
        }
      } catch (err) {
        // Skip invalid files
      }
    }

    if (!themeFile) {
      res.status(ERR_NOT_FOUND).send({ msg: 'Theme not found' });
      return;
    }

    const filePath = path.join(THEMES_DIR, themeFile);
    const content = fs.readFileSync(filePath, 'utf8');
    const existingTheme = JSON.parse(content);

    // Merge updates
    const updatedTheme = {
      ...existingTheme,
      ...updates,
      id: existingTheme.id, // Preserve original id
    };

    // Validate updated theme
    const validation = validateTheme(updatedTheme);
    if (!validation.valid) {
      res.status(ERR_BAD_REQUEST).send({ msg: validation.error });
      return;
    }

    // Write updated theme
    fs.writeFileSync(filePath, JSON.stringify(updatedTheme, null, 2), 'utf8');

    log.info(`Updated theme: ${themeFile}`);

    res.send({ err: null });
  } catch (err) {
    log.error(`Error updating theme ${id}: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to update theme'
    });
  }
};

// Delete a theme
export const __delete = (req, res) => {
  const id = req.params.id;

  try {
    ensureThemesDir();

    // Find the theme file
    const files = fs.readdirSync(THEMES_DIR);
    let themeFile = null;

    for (const file of files) {
      if (!file.endsWith('.json')) {
 continue;
}

      if (file === `${id}.json`) {
        themeFile = file;
        break;
      }

      try {
        const filePath = path.join(THEMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const theme = JSON.parse(content);
        if (theme.id === id) {
          themeFile = file;
          break;
        }
      } catch (err) {
        // Skip invalid files
      }
    }

    if (!themeFile) {
      res.status(ERR_NOT_FOUND).send({ msg: 'Theme not found' });
      return;
    }

    const filePath = path.join(THEMES_DIR, themeFile);
    fs.unlinkSync(filePath);

    log.info(`Deleted theme: ${themeFile}`);

    res.send({ err: null });
  } catch (err) {
    log.error(`Error deleting theme ${id}: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to delete theme'
    });
  }
};

// Get the themes directory path (for documentation/info purposes)
export const getPath = (req, res) => {
  res.send({
    path: THEMES_DIR,
    exists: fs.existsSync(THEMES_DIR)
  });
};
