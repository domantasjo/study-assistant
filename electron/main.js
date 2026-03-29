const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Polyfill DOMMatrix for pdf-parse / pdfjs-dist on Windows (Node has no DOMMatrix).
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      this.is2D = true; this.isIdentity = true;
    }
    multiply() { return new globalThis.DOMMatrix(); }
    translate() { return new globalThis.DOMMatrix(); }
    scale() { return new globalThis.DOMMatrix(); }
    rotate() { return new globalThis.DOMMatrix(); }
    rotateAxisAngle() { return new globalThis.DOMMatrix(); }
    skewX() { return new globalThis.DOMMatrix(); }
    skewY() { return new globalThis.DOMMatrix(); }
    flipX() { return new globalThis.DOMMatrix(); }
    flipY() { return new globalThis.DOMMatrix(); }
    inverse() { return new globalThis.DOMMatrix(); }
    transformPoint(p) { return p || { x: 0, y: 0 }; }
    toFloat32Array() { return new Float32Array(16); }
    toFloat64Array() { return new Float64Array(16); }
    toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
  };
}
let Pinecone = null;

let mainWindow;
let pineconeClient = null;

const isDev = process.env.NODE_ENV === 'development';

// Ensure only one instance runs at a time and the lock is properly released on exit.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    titleBarStyle: 'default',
    backgroundColor: '#FDF2F8',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle file selection
ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Handle reading PDF file
ipcMain.handle('read-pdf', async (event, filePath) => {
  let parser = null;

  try {
    const { PDFParse } = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);

    parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();

    return {
      success: true,
      text: data.text,
      numPages: data.total,
      fileName: path.basename(filePath),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore parser cleanup failures.
      }
    }
  }
});

const getPineconeClient = () => {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized.');
  }
  return pineconeClient;
};

ipcMain.handle('pinecone:init', async (event, apiKey) => {
  if (!apiKey) {
    throw new Error('Pinecone API key is required.');
  }

  if (!Pinecone) {
    // Load Pinecone lazily to keep Electron bootstrap minimal and stable.
    ({ Pinecone } = require('@pinecone-database/pinecone'));
  }

  pineconeClient = new Pinecone({ apiKey });
  return true;
});

ipcMain.handle('pinecone:setup-index', async (event, config) => {
  const { indexName, dimension, metric, spec } = config || {};
  const pinecone = getPineconeClient();

  try {
    const description = await pinecone.describeIndex(indexName);
    const currentDimension = description?.dimension;

    if (currentDimension && currentDimension !== dimension) {
      // Existing index has incompatible vectors (e.g., older embedding model).
      // Recreate it so queries/upserts use the same dimension.
      await pinecone.deleteIndex(indexName);

      // Wait until index deletion is observable before re-creating.
      let deleted = false;
      for (let i = 0; i < 30 && !deleted; i += 1) {
        try {
          await pinecone.describeIndex(indexName);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch {
          deleted = true;
        }
      }

      await pinecone.createIndex({
        name: indexName,
        dimension,
        metric,
        spec,
      });

      let ready = false;
      while (!ready) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const recreated = await pinecone.describeIndex(indexName);
        ready = recreated.status?.ready || false;
      }
    }
  } catch (error) {
    await pinecone.createIndex({
      name: indexName,
      dimension,
      metric,
      spec,
    });

    let ready = false;
    while (!ready) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const description = await pinecone.describeIndex(indexName);
      ready = description.status?.ready || false;
    }
  }

  return true;
});

ipcMain.handle('pinecone:upsert', async (event, payload) => {
  const { indexName, records } = payload || {};
  const pinecone = getPineconeClient();
  const index = pinecone.index(indexName);
  await index.upsert({ records });
  return true;
});

ipcMain.handle('pinecone:query', async (event, payload) => {
  const { indexName, vector, topK, filter } = payload || {};
  const pinecone = getPineconeClient();
  const index = pinecone.index(indexName);
  return index.query({
    vector,
    topK,
    includeMetadata: true,
    filter,
  });
});

ipcMain.handle('pinecone:deleteMany', async (event, payload) => {
  const { indexName, filter } = payload || {};
  const pinecone = getPineconeClient();
  const index = pinecone.index(indexName);
  await index.deleteMany({ filter });
  return true;
});

// Secure API key storage in userData (never exposed in renderer bundle)
const getKeysFilePath = () => path.join(app.getPath('userData'), 'keys.json');

ipcMain.handle('keys:get', async () => {
  try {
    const filePath = getKeysFilePath();
    if (fs.existsSync(filePath)) {
      const stored = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (stored.openaiKey || stored.pineconeKey) return stored;
    }
    // Seed from keys-default.json bundled at build time
    const defaultsPath = path.join(__dirname, 'keys-default.json');
    let openaiKey = '';
    let pineconeKey = '';
    if (fs.existsSync(defaultsPath)) {
      try {
        const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
        openaiKey = defaults.openaiKey || '';
        pineconeKey = defaults.pineconeKey || '';
      } catch {}
    }
    if (openaiKey || pineconeKey) {
      fs.writeFileSync(filePath, JSON.stringify({ openaiKey, pineconeKey }, null, 2), { mode: 0o600 });
    }
    return { openaiKey, pineconeKey };
  } catch {
    return { openaiKey: '', pineconeKey: '' };
  }
});

ipcMain.handle('keys:set', async (event, { openaiKey, pineconeKey }) => {
  const filePath = getKeysFilePath();
  fs.writeFileSync(filePath, JSON.stringify({ openaiKey, pineconeKey }, null, 2), { mode: 0o600 });
  return true;
});

// Handle saving data locally
ipcMain.handle('save-data', async (event, key, data) => {
  const userDataPath = app.getPath('userData');
  const filePath = path.join(userDataPath, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return true;
});

// Handle loading data
ipcMain.handle('load-data', async (event, key) => {
  const userDataPath = app.getPath('userData');
  const filePath = path.join(userDataPath, `${key}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }
  return null;
});

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto updater error:', err);
  });

  autoUpdater.checkForUpdates();
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
