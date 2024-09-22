console.log('Client script loaded and executed');

// Ajoutez ce code au début du fichier, après les déclarations de variables existantes
const themeToggle = document.getElementById('themeToggle');
let isDarkMode = false;

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDarkMode);
}

// Charger le thème préféré de l'utilisateur depuis le stockage local
isDarkMode = localStorage.getItem('darkMode') === 'true';
if (isDarkMode) {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️';
}

themeToggle.addEventListener('click', toggleTheme);

let socket;
try {
    console.log('Attempting to connect to WebSocket server...');
    socket = io(window.location.origin);
    console.log('Socket object created:', socket);
} catch (error) {
    console.error('Error creating WebSocket connection:', error);
}


if (socket) {
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
}

const modeSelect = document.getElementById('modeSelect');
const addressInput = document.getElementById('addressInput');
const portSelect = document.getElementById('portSelect');
const tcpPortInput = document.getElementById('tcpPortInput');
const slaveIdInput = document.getElementById('slaveIdInput');
const connectButton = document.getElementById('connectButton');
const terminal = document.getElementById('terminal');
const favoritesSelect = document.getElementById('favoritesSelect');
const addFavoriteButton = document.getElementById('addFavoriteButton');
const removeFavoriteButton = document.getElementById('removeFavoriteButton');

let connected = false;

function disconnectIfConnected() {
    if (connected) {
        console.log('Disconnecting due to connection parameter change');
        socket.emit('disconnect_modbus');
    }
}

function updateInputFields() {
    disconnectIfConnected();
    const tcpLabels = document.querySelectorAll('.tcp-label');
    const rtuLabels = document.querySelectorAll('.rtu-label');
    
    if (modeSelect.value === 'RTU') {
        addressInput.style.display = 'none';
        portSelect.style.display = 'inline-block';
        tcpPortInput.style.display = 'none';
        document.getElementById('rtuSettings').style.display = 'block';
        tcpLabels.forEach(label => label.style.display = 'none');
        rtuLabels.forEach(label => label.style.display = 'inline-block');
        console.log('Requesting port list');
        socket.emit('getPorts');
    } else {
        addressInput.style.display = 'inline-block';
        addressInput.placeholder = 'IP Address';
        portSelect.style.display = 'none';
        tcpPortInput.style.display = 'inline-block';
        document.getElementById('rtuSettings').style.display = 'none';
        tcpLabels.forEach(label => label.style.display = 'inline-block');
        rtuLabels.forEach(label => label.style.display = 'none');
    }
}

modeSelect.addEventListener('change', updateInputFields);

addressInput.addEventListener('input', disconnectIfConnected);
portSelect.addEventListener('change', disconnectIfConnected);
tcpPortInput.addEventListener('input', disconnectIfConnected);
slaveIdInput.addEventListener('input', disconnectIfConnected);

updateInputFields();

socket.on('portList', (ports) => {
    console.log('Port list received:', ports);
    portSelect.innerHTML = '<option value="">Select a port</option>';
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port;
        option.textContent = port;
        portSelect.appendChild(option);
    });
});

connectButton.addEventListener('click', () => {
    console.log('Connect button clicked');
    if (!connected) {
        const mode = modeSelect.value;
        const address = addressInput.value.trim();
        const port = mode === 'TCP' ? tcpPortInput.value.trim() : portSelect.value;
        const slaveId = slaveIdInput.value.trim();
        const timeout = parseInt(document.getElementById('timeout').value) || 1000;

        if (mode === 'TCP' && !address) {
            alert('Please enter an IP address');
            return;
        }

        if (mode === 'RTU' && !port) {
            alert('Please select a COM port');
            return;
        }

        if (!slaveId || isNaN(parseInt(slaveId))) {
            alert('Please enter a valid Slave/Unit ID');
            return;
        }

        const connectionData = {
            mode: mode,
            address: mode === 'TCP' ? address : undefined,
            port: port,
            slaveId: slaveId,
            timeout: timeout,
            baudRate: parseInt(document.getElementById('baudRate').value),
            dataBits: parseInt(document.getElementById('dataBits').value),
            parity: document.getElementById('parity').value,
            stopBits: parseInt(document.getElementById('stopBits').value)
        };
        console.log('Connection data:', connectionData);
        socket.emit('connect_modbus', connectionData);
        console.log('Modbus connection event emitted');
    } else {
        console.log('Modbus disconnection requested');
        socket.emit('disconnect_modbus');
        console.log('Modbus disconnection event emitted');
    }
});

// Ajoutez cette ligne au début du fichier, juste après les autres déclarations de variables
const style = document.createElement('style');
style.textContent = `
    .error-text {
        color: red;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

// Remplacez le gestionnaire d'événements 'error' existant par celui-ci
socket.on('modbusError', (data) => {
    console.error('Modbus error:', data.message);
    document.querySelectorAll('.result').forEach(resultSpan => {
        if (resultSpan.querySelector('.loading')) {
            if (data.message.includes('Timeout')) {
                resultSpan.innerHTML = '<span class="timeout">Timeout</span>';
            } else {
                resultSpan.innerHTML = '<span class="error-text">Error</span>';
            }
        }
    });
    if (data.message !== 'Timeout') {
        alert(data.message);
    }
});

document.querySelectorAll('.modbus-row').forEach(row => {
    const readButton = row.querySelector('.readButton');
    const writeButton = row.querySelector('.writeButton');
    const registerInput = row.querySelector('.registerInput');
    const valueInput = row.querySelector('.valueInput');
    const resultSpan = row.querySelector('.result');

    function showLoading() {
        resultSpan.innerHTML = '<div class="loading"></div>';
    }

    function hideLoading() {
        resultSpan.innerHTML = '';
    }

    readButton.addEventListener('click', () => {
        if (!connected) {
            alert('Please connect to a Modbus server first');
            return;
        }
        const functionCode = row.querySelector('.register-name').textContent.includes('Coils') ? '1' :
                             row.querySelector('.register-name').textContent.includes('Discrete Inputs') ? '2' :
                             row.querySelector('.register-name').textContent.includes('Input Registers') ? '4' : '3';
        const address = parseInt(registerInput.value, 10);
        if (isNaN(address) || address < 0) {
            alert('Invalid register address');
            return;
        }
        console.log(`Sending read request: Register ${address}, Function Code ${functionCode}`);
        showLoading();
        socket.emit('read', {
            functionCode: functionCode,
            address: address
        });
    });

    if (writeButton) {
        writeButton.addEventListener('click', () => {
            if (!connected) {
                alert('Please connect to a Modbus server first');
                return;
            }
            const functionCode = row.querySelector('.register-name').textContent.includes('Coils') ? '5' : '6';
            const address = parseInt(registerInput.value, 10);
            let value = parseInt(valueInput.value, 10);
            if (isNaN(address) || address < 0 || isNaN(value)) {
                alert('Invalid register address or value');
                return;
            }
            if (functionCode === '5' && (value !== 0 && value !== 1)) {
                alert('Coil value must be 0 or 1');
                return;
            }
            console.log(`Sending write request: Register ${address}, Value ${value}, Function Code ${functionCode}`);
            showLoading();
            socket.emit('write', {
                functionCode: functionCode,
                address: address,
                value: value
            });
        });
    }
});

socket.on('connectionStatus', (status) => {
    console.log('Connection status received:', status);
    connected = status;
    connectButton.textContent = connected ? 'Disconnect' : 'Connect';
    if (connected) {
        connectButton.classList.add('disconnectButton');
    } else {
        connectButton.classList.remove('disconnectButton');
    }
    // Pas besoin d'appeler updateUIAfterDisconnection ici
});

socket.on('connectionError', (errorMessage) => {
    console.error('Connection error:', errorMessage);
    alert('Connection error: ' + errorMessage);
    // Réinitialiser l'état de connexion et l'interface utilisateur
    connected = false;
    connectButton.textContent = 'Connect';
    connectButton.classList.remove('disconnectButton');
    updateUIAfterDisconnection();
});

socket.on('disconnectionError', (errorMessage) => {
    console.error('Disconnection error:', errorMessage);
    alert(errorMessage);
    // Réinitialiser l'état de connexion et l'interface utilisateur
    connected = false;
    connectButton.textContent = 'Connect';
    connectButton.classList.remove('disconnectButton');
    updateUIAfterDisconnection();
});

function updateUIAfterDisconnection() {
    document.querySelectorAll('.result').forEach(resultSpan => {
        resultSpan.textContent = '';
    });
    terminal.innerHTML = '';
    connected = false;
}

socket.on('readResult', (data) => {
    console.log('Read result received:', data);
    const rows = document.querySelectorAll('.modbus-row');
    let row;
    switch(data.functionCode) {
        case '1': row = rows[0]; break;
        case '2': row = rows[1]; break;
        case '4': row = rows[2]; break;
        case '3': row = rows[3]; break;
        default: console.error('Unrecognized function code:', data.functionCode); return;
    }
    if (row) {
        const resultSpan = row.querySelector('.result');
        resultSpan.textContent = `${data.value}`;
    } else {
        console.error('Corresponding row not found for function code:', data.functionCode);
    }
});

socket.on('writeResult', (data) => {
    const functionCode = data.functionCode === '5' ? 1 : 4;  // 5 for Coils, 6 for Holding Registers
    const row = document.querySelector(`.modbus-row:nth-child(${functionCode})`);
    if (row) {
        const resultSpan = row.querySelector('.result');
        resultSpan.textContent = `${data.value}`;
    }
});

socket.on('log', (message) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (message === '\n') {
        terminal.innerHTML = '<br>' + terminal.innerHTML;
    } else {
        const logEntry = `[${timestamp}] ${message}`;
        terminal.innerHTML = logEntry + '<br>' + terminal.innerHTML;
    }
    if (terminal.innerHTML.split('<br>').length > 100) {
        terminal.innerHTML = terminal.innerHTML.split('<br>').slice(0, 100).join('<br>');
    }
});

// Modifiez la fonction stopLoading comme suit
function stopLoading() {
    document.querySelectorAll('.result').forEach(resultSpan => {
        if (resultSpan.querySelector('.loading')) {
            resultSpan.innerHTML = '<span class="error-text">Error</span>';
        }
    });
}

function updateFavoritesList(favorites) {
    console.log('Updating favorites list:', favorites);
    favoritesSelect.innerHTML = '<option value="">Favorites</option>';
    favorites.forEach((favorite, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = favorite.name;
        favoritesSelect.appendChild(option);
    });
}

socket.on('favoritesList', updateFavoritesList);

socket.emit('getFavorites');

addFavoriteButton.addEventListener('click', () => {
    console.log('Add favorite button clicked');
    createCustomPrompt('Enter a name for this favorite:', (name) => {
        if (name) {
            const newFavorite = {
                name: name,
                mode: modeSelect.value,
                address: addressInput.value,
                port: modeSelect.value === 'TCP' ? tcpPortInput.value : portSelect.value,
                slaveId: slaveIdInput.value,
                baudRate: document.getElementById('baudRate').value,
                dataBits: document.getElementById('dataBits').value,
                parity: document.getElementById('parity').value,
                stopBits: document.getElementById('stopBits').value,
                timeout: document.getElementById('timeout').value
            };
            console.log('New favorite to add:', newFavorite);
            socket.emit('addFavorite', newFavorite);
        }
    });
});

removeFavoriteButton.addEventListener('click', () => {
    console.log('Remove favorite button clicked');
    const selectedIndex = favoritesSelect.value;
    if (selectedIndex !== '') {
        if (confirm('Are you sure you want to delete this favorite?')) {
            console.log('Removing favorite at index:', selectedIndex);
            socket.emit('removeFavorite', parseInt(selectedIndex));
        }
    } else {
        console.log('No favorite selected for deletion');
        alert('Please select a favorite to delete.');
    }
});

const originalEmit = socket.emit;
socket.emit = function() {
    console.log('Event emitted:', arguments[0], arguments[1]);
    return originalEmit.apply(socket, arguments);
};

console.log('Add favorite button:', addFavoriteButton);
console.log('Remove favorite button:', removeFavoriteButton);

function createCustomPrompt(message, callback) {
    const promptContainer = document.createElement('div');
    promptContainer.style.position = 'fixed';
    promptContainer.style.top = '50%';
    promptContainer.style.left = '50%';
    promptContainer.style.transform = 'translate(-50%, -50%)';
    promptContainer.style.backgroundColor = 'var(--container-bg)';
    promptContainer.style.color = 'var(--text-color)';
    promptContainer.style.padding = '20px';
    promptContainer.style.border = '1px solid var(--input-border)';
    promptContainer.style.borderRadius = '6px';
    promptContainer.style.zIndex = '1000';
    promptContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

    const promptMessage = document.createElement('p');
    promptMessage.textContent = message;
    promptContainer.appendChild(promptMessage);

    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.style.width = '100%';
    promptInput.style.marginBottom = '10px';
    promptInput.style.padding = '5px';
    promptInput.style.border = '1px solid var(--input-border)';
    promptInput.style.borderRadius = '3px';
    promptInput.style.backgroundColor = 'var(--bg-color)';
    promptInput.style.color = 'var(--text-color)';
    promptContainer.appendChild(promptInput);

    const promptButtons = document.createElement('div');
    promptButtons.style.display = 'flex';
    promptButtons.style.justifyContent = 'flex-end';
    promptButtons.style.gap = '10px';
    promptContainer.appendChild(promptButtons);

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.padding = '5px 10px';
    okButton.style.backgroundColor = 'var(--button-bg)';
    okButton.style.color = 'white';
    okButton.style.border = 'none';
    okButton.style.borderRadius = '3px';
    okButton.style.cursor = 'pointer';
    okButton.addEventListener('click', () => {
        const value = promptInput.value;
        document.body.removeChild(promptContainer);
        callback(value);
    });
    promptButtons.appendChild(okButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '5px 10px';
    cancelButton.style.backgroundColor = 'var(--button-bg)';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '3px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(promptContainer);
        callback(null);
    });
    promptButtons.appendChild(cancelButton);

    document.body.appendChild(promptContainer);
    promptInput.focus();
}

function loadFavoriteSettings(favorite) {
    modeSelect.value = favorite.mode;
    if (favorite.mode === 'TCP') {
        addressInput.value = favorite.address;
        tcpPortInput.value = favorite.port;
    } else {
        portSelect.value = favorite.port;
        document.getElementById('baudRate').value = favorite.baudRate;
        document.getElementById('dataBits').value = favorite.dataBits;
        document.getElementById('parity').value = favorite.parity;
        document.getElementById('stopBits').value = favorite.stopBits;
        document.getElementById('timeout').value = favorite.timeout;
    }
    slaveIdInput.value = favorite.slaveId;
    updateInputFields();
}

favoritesSelect.addEventListener('change', (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex !== '') {
        socket.emit('getFavorite', parseInt(selectedIndex));
    }
});

socket.on('favoriteDetails', (favorite) => {
    console.log('Favorite details received:', favorite);
    loadFavoriteSettings(favorite);
});

function updateConnectionParameters() {
    if (connected) {
        const timeout = parseInt(document.getElementById('timeout').value) || 1000;
        const updateData = {
            timeout: timeout,
            baudRate: parseInt(document.getElementById('baudRate').value),
            dataBits: parseInt(document.getElementById('dataBits').value),
            parity: document.getElementById('parity').value,
            stopBits: parseInt(document.getElementById('stopBits').value)
        };
        console.log('Updating connection parameters:', updateData);
        socket.emit('update_modbus_parameters', updateData);
    }
}

document.getElementById('timeout').addEventListener('change', updateConnectionParameters);
document.getElementById('baudRate').addEventListener('change', updateConnectionParameters);
document.getElementById('dataBits').addEventListener('change', updateConnectionParameters);
document.getElementById('parity').addEventListener('change', updateConnectionParameters);
document.getElementById('stopBits').addEventListener('change', updateConnectionParameters);

socket.on('parameterUpdateStatus', (status) => {
    if (status.success) {
        console.log('Parameters updated successfully:', status.message);
    } else {
        console.error('Failed to update parameters:', status.message);
        alert('Failed to update parameters: ' + status.message);
    }
});

socket.on('outOfRangeError', (data) => {
    console.error('Out of range error:', data.message);
    alert(data.message);
    stopLoading();
});

socket.on('operationError', () => {
    stopLoading();
});