const { app, BrowserWindow } = require('electron');
const path = require('path');
const createServer = require('./server');
const Store = require('electron-store');

const store = new Store();
console.log('Store initialisé:', store);

// Ajoutez ceci au début du fichier, juste après les imports
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

function createWindow() {
    const win = new BrowserWindow({
        width: 620, // Augmenté de 600 à 620
        height: 550, // Augmenté de 520 à 550
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        resizable: true, // Permet à l'utilisateur de redimensionner la fenêtre si nécessaire
        autoHideMenuBar: true, // Cache la barre de menu par défaut pour gagner de l'espace
        icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon.icns' : process.platform === 'win32' ? 'icon.ico' : 'icon.png')
    });

    const { server } = createServer(store);

    const PORT = 3003; // Assurez-vous que ce port correspond à celui utilisé dans votre client
    server.listen(PORT, () => {
        console.log(`Serveur en écoute sur le port ${PORT}`);
        win.loadURL(`http://localhost:${PORT}`);
    });
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