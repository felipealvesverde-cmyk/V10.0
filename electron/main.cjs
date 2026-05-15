const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const SCHEMA_VERSION = '11.2.0';

async function ensureLeadJourneyTree(folderPath) {
  const dirs = ['database', 'backups', 'uploads', 'exports', 'config', 'migrations', 'recovery'];
  await fs.mkdir(folderPath, { recursive: true });
  for (const dir of dirs) await fs.mkdir(path.join(folderPath, dir), { recursive: true });
}

function safeFileName(fileName) {
  const name = String(fileName || 'leadjourney-db.json').replace(/[\\/:*?"<>|]/g, '-');
  return name.endsWith('.json') ? name : `${name}.json`;
}

const RD_CRM_TICK_INTERVAL_MS = 5 * 60 * 1000;
let rdCrmTickHandle = null;

function startRdCrmTick(targetWindow) {
  if (rdCrmTickHandle) clearInterval(rdCrmTickHandle);
  rdCrmTickHandle = setInterval(() => {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('leadjourney:rd-crm-tick');
    }
  }, RD_CRM_TICK_INTERVAL_MS);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  startRdCrmTick(win);
  win.on('closed', () => {
    if (rdCrmTickHandle) { clearInterval(rdCrmTickHandle); rdCrmTickHandle = null; }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('leadjourney:select-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha a pasta local do banco LeadJourney',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, message: 'Seleção de pasta cancelada.' };
  const folderPath = result.filePaths[0];
  await ensureLeadJourneyTree(folderPath);
  return { ok: true, path: folderPath, label: path.basename(folderPath), message: `Pasta local vinculada: ${folderPath}` };
});

ipcMain.handle('leadjourney:test-folder', async (_event, payload = {}) => {
  const folderPath = payload.folderPath;
  if (!folderPath) return { ok: false, message: 'Informe ou escolha uma pasta local.' };
  try {
    await ensureLeadJourneyTree(folderPath);
    const testFile = path.join(folderPath, 'config', '.leadjourney-write-test');
    await fs.writeFile(testFile, new Date().toISOString(), 'utf8');
    await fs.rm(testFile, { force: true });
    return { ok: true, message: `Pasta pronta para gravação: ${folderPath}` };
  } catch (error) {
    return { ok: false, message: `Falha ao acessar pasta: ${error.message}` };
  }
});

ipcMain.handle('leadjourney:save-snapshot', async (_event, payload = {}) => {
  const folderPath = payload.folderPath;
  if (!folderPath) return { ok: false, message: 'Nenhuma pasta local definida.' };
  try {
    await ensureLeadJourneyTree(folderPath);
    const fileName = safeFileName(payload.fileName);
    const snapshot = { ...(payload.snapshot || {}), schemaVersion: SCHEMA_VERSION };
    const json = JSON.stringify(snapshot, null, 2);
    const databaseFile = path.join(folderPath, 'database', fileName);
    const previousFile = path.join(folderPath, 'recovery', `previous-${fileName}`);

    try {
      const existing = await fs.readFile(databaseFile, 'utf8');
      await fs.writeFile(previousFile, existing, 'utf8');
    } catch (_) {}

    await fs.writeFile(databaseFile, json, 'utf8');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(folderPath, 'backups', `leadjourney-${stamp}.json`);
    await fs.writeFile(backupFile, json, 'utf8');

    const manifest = {
      app: 'LeadScore Journey',
      schemaVersion: SCHEMA_VERSION,
      savedAt: snapshot.exportedAt || new Date().toISOString(),
      databaseFile,
      backupFile,
      summary: snapshot.summary || {},
      integrity: snapshot.integrity || null
    };
    await fs.writeFile(path.join(folderPath, 'config', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    await fs.writeFile(path.join(folderPath, 'config', 'last-save.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const migrationEntry = { at: manifest.savedAt, schemaVersion: SCHEMA_VERSION, file: databaseFile };
    const migrationFile = path.join(folderPath, 'migrations', 'migration-history.json');
    let history = [];
    try { history = JSON.parse(await fs.readFile(migrationFile, 'utf8')); } catch (_) {}
    history.push(migrationEntry);
    await fs.writeFile(migrationFile, JSON.stringify(history.slice(-100), null, 2), 'utf8');

    return { ok: true, path: databaseFile, backupPath: backupFile, folderPath, folderLabel: path.basename(folderPath), schemaVersion: SCHEMA_VERSION, message: `Dados salvos em ${databaseFile}` };
  } catch (error) {
    return { ok: false, message: `Falha ao gravar banco local: ${error.message}` };
  }
});

ipcMain.handle('leadjourney:read-snapshot', async (_event, payload = {}) => {
  const folderPath = payload.folderPath;
  if (!folderPath) return { ok: false, message: 'Nenhuma pasta local definida.' };
  try {
    const fileName = safeFileName(payload.fileName);
    const databaseFile = path.join(folderPath, 'database', fileName);
    let sourceFile = databaseFile;
    let text;
    try {
      text = await fs.readFile(databaseFile, 'utf8');
    } catch (error) {
      const previousFile = path.join(folderPath, 'recovery', `previous-${fileName}`);
      text = await fs.readFile(previousFile, 'utf8');
      sourceFile = previousFile;
    }
    const snapshot = JSON.parse(text);
    return { ok: true, snapshot, path: sourceFile, folderPath, folderLabel: path.basename(folderPath), schemaVersion: snapshot.schemaVersion || snapshot.version || 'unknown', message: `Dados carregados de ${sourceFile}` };
  } catch (error) {
    return { ok: false, message: `Falha ao ler banco local: ${error.message}` };
  }
});

ipcMain.handle('leadjourney:get-default-folder', async () => {
  const folderPath = path.join(app.getPath('documents'), 'LeadJourney');
  return { ok: true, path: folderPath, label: 'LeadJourney', message: folderPath };
});
