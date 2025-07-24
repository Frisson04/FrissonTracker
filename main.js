const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');


let mainWindow, settingsWindow, connectWindow, helpWindow, aboutWindow;
const CONFIG_PATH = path.join(app.getPath('userData'), 'tracker-config.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 960,
autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
	  devTools: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    mainWindow.webContents.send('config-updated', config);
  });
  
  ipcMain.on('to-main-console', (event, data) => {
  console.log('[Renderer Console]', data);
});

ipcMain.on('room-info', (event, roomInfo) => {
  console.log('[Room Info]', roomInfo);
});

ipcMain.on('slot-data', (event, slotData) => {
  console.log('[Slot Data]', slotData);
  mainWindow?.webContents.send('slot-data-update', slotData);
  settingsWindow?.webContents.send('slot-data-update', slotData);
});
ipcMain.on('open-external-with-size', (event, url) => {
    const externalWindow = new BrowserWindow({
        width: 1280,
        height: 960,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    externalWindow.loadURL(url);
});
ipcMain.on('open-window', (_, type) => {
  const config = {
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      devTools: false
    },
    focusable: true,
    modal: false
  };

  if (type === 'settings') {
    if (settingsWindow) return settingsWindow.focus();
    settingsWindow = new BrowserWindow({ ...config, width: 1200, height: 960 });
    settingsWindow.loadFile('settings.html');
    settingsWindow.on('closed', () => settingsWindow = null);
  }
  else if (type === 'connect') {
    if (connectWindow) return connectWindow.focus();
    connectWindow = new BrowserWindow({ ...config, width: 500, height: 400 });
    connectWindow.loadFile('connect.html');
    connectWindow.on('closed', () => connectWindow = null);
  }
  else if (type === 'help') {
    if (helpWindow) return helpWindow.focus();
    helpWindow = new BrowserWindow({ ...config, width: 1200, height: 960 });
    helpWindow.loadFile('help.html');
    helpWindow.on('closed', () => helpWindow = null);
  }
  else if (type === 'about') {
    if (aboutWindow) return aboutWindow.focus();
    aboutWindow = new BrowserWindow({ ...config, width: 950, height: 1150 });
    aboutWindow.loadFile('About.html');
    aboutWindow.on('closed', () => aboutWindow = null);
  }
});

  ipcMain.on('config-changed', () => {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    mainWindow.webContents.send('config-updated', config);
    if (settingsWindow) {
      settingsWindow.webContents.send('config-updated', config);
    }
  });
  
 ipcMain.handle('toggle-edit-mode', async () => {
  const trackerWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'));
  if (trackerWindow) {
    return await trackerWindow.webContents.executeJavaScript('toggleEditMode()');
  }
  return false;
});
ipcMain.handle('get-full-config', async () => {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    
    
    const mainWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'));
    if (mainWindow) {
        const positions = await mainWindow.webContents.executeJavaScript('captureCurrentPositions()');
        config.categoryPositions = positions;
        

        config.isEditMode = await mainWindow.webContents.executeJavaScript('editMode');
    }
    
    return config;
});
ipcMain.handle('get-window-size', () => {
  return {
    width: mainWindow.getSize()[0],
    height: mainWindow.getSize()[1]
  };
});

ipcMain.handle('set-window-size', (_, size) => {
  mainWindow.setSize(size.width, size.height);
});
ipcMain.on('update-tracker-positions', (_, positions) => {
    const trackerWindow = BrowserWindow.getAllWindows().find(
        w => w.webContents.getURL().includes('index.html')
    );
    if (trackerWindow) {
        trackerWindow.webContents.send('apply-new-positions', positions);
    }
});

ipcMain.handle('get-config', () => {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            const defaultConfig = { 
                gridColumns: 4,  
                categories: [], 
                items: [] 
            };
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig));
            return defaultConfig;
        }
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
        if (config.gridColumns === undefined) {
            config.gridColumns = 4;
        }
        return config;
    } catch (e) {
        console.error("Config error:", e);
        return { 
            gridColumns: 4,
            categories: [], 
            items: [] 
        };
    }
});

ipcMain.handle('save-config', (_, config) => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error("Save error:", e);
        return false;
    }
});

  ipcMain.on('connect-data', (_, data) => {
    mainWindow.webContents.send('connect-data', data);
    if (connectWindow) connectWindow.close();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());