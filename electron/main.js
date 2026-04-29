const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let checkingForUpdate = false;
let manualUpdateCheck = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (checkingForUpdate) return;
            manualUpdateCheck = true;
            checkingForUpdate = true;
            autoUpdater.checkForUpdates().catch((err) => {
              checkingForUpdate = false;
              manualUpdateCheck = false;
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Update check failed',
                message: `Could not check for updates: ${err.message}`,
              });
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    checkingForUpdate = true;
  });

  autoUpdater.on('update-not-available', () => {
    checkingForUpdate = false;
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No update available',
        message: `Class Sorter ${app.getVersion()} is the latest version.`,
      });
    }
  });

  autoUpdater.on('update-available', () => {
    checkingForUpdate = false;
    manualUpdateCheck = false;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update available',
      message: 'A new version of Class Sorter is downloading in the background.',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: 'A new version has been downloaded. Restart to apply the update.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  createWindow();
  buildMenu();

  if (app.isPackaged) {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
