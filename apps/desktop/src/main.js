import fs from 'node:fs';
import path from 'node:path';
import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  powerSaveBlocker,
  screen,
  shell,
} from 'electron';
import Store from 'electron-store';
import chalk from 'chalk';
import mkdirp from 'mkdirp';

// Resolve bundle root that contains server + web assets
// Packaged: <resources>/axiocnc
// Dev:      <repo>/build/<platform>-<arch>/axiocnc
function getBundleRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'axiocnc');
  }
  // This file is transpiled to apps/desktop/dist/main.js in dev
  // __dirname => <repo>/apps/desktop/dist
  const repoRoot = path.resolve(__dirname, '../../..');
  const platform = process.platform === 'win32'
    ? 'win'
    : process.platform === 'darwin'
      ? 'mac'
      : 'linux';
  const arch = process.arch;
  return path.join(repoRoot, 'build', `${platform}-${arch}`, 'axiocnc');
}

// Read apps/desktop/package.json in dev; packaged reads packaged app package.json
function getDesktopPackageJson() {
  if (app.isPackaged) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(app.getAppPath(), 'package.json'));
  }
  const desktopRoot = path.resolve(__dirname, '..'); // apps/desktop (from apps/desktop/dist)
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(path.join(desktopRoot, 'package.json'));
}

// Load menu templates:
// Dev:      apps/desktop/dist/electron-app/menu-template
// Packaged: <appPath>/dist/electron-app/menu-template
function getMenuTemplates() {
  if (app.isPackaged) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(app.getAppPath(), 'dist', 'electron-app', 'menu-template'));
  }
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(path.join(__dirname, 'electron-app', 'menu-template'));
}

// Load launchServer from bundleRoot/server/cli.js
function getLaunchServer(bundleRoot) {
  const cliPath = path.join(bundleRoot, 'server', 'cli.js');
  if (!fs.existsSync(cliPath)) {
    throw new Error(`Missing server cli.js at: ${cliPath}`);
  }

  // Ensure relative requires inside server code behave predictably
  try {
    process.chdir(bundleRoot);
  } catch (e) {
    console.warn(`Warning: could not chdir to ${bundleRoot}`, e);
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(cliPath);

  // Your cli.js: module.exports = launchServer (a function)
  if (typeof mod === 'function') {
    return mod;
  }

  throw new Error(`server/cli.js did not export a function: ${cliPath}`);
}

const pkg = getDesktopPackageJson();

const {
  createApplicationMenuTemplate,
  inputMenuTemplate,
  selectionMenuTemplate,
} = getMenuTemplates();

let mainWindow = null;
let powerId = 0;
const store = new Store();

// Single instance lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

// Create the user data directory if it does not exist
const userDataPath = app.getPath('userData');
mkdirp.sync(userDataPath);

function getBrowserWindowOptions() {
  const defaultOptions = {
    width: 1440,
    height: 900,
    minHeight: 708,
    minWidth: 1024,
    show: false,
    title: `${pkg.name} ${pkg.version}`,
    useContentSize: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    }
  };

  const lastOptions = store.get('bounds');

  let windowOptions = {};
  if (lastOptions) {
    const display = screen.getDisplayMatching(lastOptions);

    if (display.id === lastOptions.id) {
      windowOptions = {
        ...windowOptions,
        ...lastOptions,
      };
    } else {
      const workArea = display.workArea;

      const width = Math.max(Math.min(lastOptions.width, workArea.width), 360);
      const height = Math.max(Math.min(lastOptions.height, workArea.height), 240);
      const x = workArea.x + (workArea.width - width) / 2;
      const y = workArea.y + (workArea.height - height) / 2;

      windowOptions = {
        id: display.id,
        x,
        y,
        width,
        height,
      };
    }
  } else {
    const display = screen.getPrimaryDisplay();
    const { x, y, width } = display.workArea;
    const nx = x + (width - 1440) / 2;
    windowOptions = {
      id: display.id,
      x: nx,
      y,
      center: true,
    };
  }

  return Object.assign({}, defaultOptions, windowOptions);
}

const showMainWindow = async () => {
  const bundleRoot = getBundleRoot();

  // Validate expected bundle structure with helpful errors
  const expected = [
    { p: bundleRoot, label: 'bundle root' },
    { p: path.join(bundleRoot, 'server', 'cli.js'), label: 'server cli.js' },
    { p: path.join(bundleRoot, 'app'), label: 'web app bundle directory' },
  ];

  for (const item of expected) {
    if (!fs.existsSync(item.p)) {
      console.error(chalk.red(`Bundle validation failed: missing ${item.label} at ${item.p}`));
      if (!app.isPackaged) {
        console.error(chalk.yellow('Dev mode: run yarn build:all and then package script.'));
      } else {
        console.error(chalk.yellow('Packaged mode: ensure electron-builder extraResources includes dist/axiocnc -> resources/axiocnc.'));
      }
      throw new Error(`Missing ${item.label}: ${item.p}`);
    }
  }

  const launchServer = getLaunchServer(bundleRoot);

  const browserWindowOptions = getBrowserWindowOptions();
  const browserWindow = new BrowserWindow(browserWindowOptions);
  mainWindow = browserWindow;
  powerId = powerSaveBlocker.start('prevent-display-sleep');

  const res = await launchServer();
  const { address, port, mountPoints } = { ...res };
  if (!(address && port)) {
    console.error('Unable to start the server at ' + chalk.cyan(`http://${address}:${port}`));
    return;
  }

  const applicationMenu = Menu.buildFromTemplate(createApplicationMenuTemplate({ address, port, mountPoints }));
  const inputMenu = Menu.buildFromTemplate(inputMenuTemplate);
  const selectionMenu = Menu.buildFromTemplate(selectionMenuTemplate);
  Menu.setApplicationMenu(applicationMenu);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('context-menu', (event, props) => {
    const { selectionText, isEditable } = props;
    if (isEditable) {
      inputMenu.popup(mainWindow);
    } else if (selectionText && String(selectionText).trim() !== '') {
      selectionMenu.popup(mainWindow);
    }
  });

  const webContentsSession = mainWindow.webContents.session;
  webContentsSession.setProxy({ proxyRules: 'direct://' })
    .then(() => {
      const url = `http://${address}:${port}`;
      mainWindow.loadURL(url);
    })
    .catch(err => {
      console.log('err', err.message);
    });

  if (process.platform === 'win32') {
    mainWindow.show();
  } else {
    mainWindow.on('ready-to-show', () => {
      mainWindow.show();
    });
  }

  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const options = {
      id: display.id,
      ...bounds,
    };

    store.set('bounds', options);
    mainWindow.webContents.send('save-and-close');

    mainWindow = null;
  });

  ipcMain.handle('read-user-config', () => {
    let content = '{}';
    const configPath = path.join(userDataPath, 'cnc.json');
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf8');
    }
    return content;
  });

  ipcMain.handle('write-user-config', (event, content) => {
    const configPath = path.join(userDataPath, 'cnc.json');
    fs.writeFileSync(configPath, content ?? '{}');
  });
};

// Increase V8 heap size of the main process in production
if (process.arch === 'x64') {
  const memoryLimit = 1024 * 4; // 4GB
  app.commandLine.appendSwitch('--js-flags', `--max-old-space-size=${memoryLimit}`);
}

app.commandLine.appendSwitch('ignore-gpu-blacklist');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('--no-sandbox');
}

app.on('activate', async () => {
  if (!mainWindow) {
    await showMainWindow();
  }
});

app.on('window-all-closed', () => {
  powerSaveBlocker.stop(powerId);
  app.quit();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.whenReady().then(showMainWindow);
