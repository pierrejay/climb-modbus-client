const { app, BrowserWindow } = require('electron');
const path = require('path');
const createServer = require('./server');
const Store = require('electron-store');
const net = require('net');

const store = new Store();
console.log('Store initialisé:', store);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORTS = [3003, 3004, 3005, 3006, 3007]; // Liste des ports à essayer

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function findAvailablePort() {
    for (const port of PORTS) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error('Aucun port disponible trouvé');
}

async function createWindow() {
    const win = new BrowserWindow({
        width: 620,
        height: 550,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon.icns' : process.platform === 'win32' ? 'icon.ico' : 'icon.png')
    });

    try {
        const PORT = await findAvailablePort();
        const { server } = createServer(store);

        server.listen(PORT, () => {
            console.log(`Serveur en écoute sur le port ${PORT}`);
            win.loadURL(`http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Erreur lors du démarrage du serveur:', error);
        app.quit();
    }
}

app.whenReady().then(createWindow);

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