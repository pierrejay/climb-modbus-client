const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const ModbusRTU = require('modbus-serial');
const { SerialPort } = require('serialport');
const path = require('path');

const CONNECTION_TIMEOUT = 5000; // 5 secondes de timeout

function createServer(store) {
    const expressApp = express();
    const server = http.createServer(expressApp);
    const io = socketIo(server);

    console.log('Initializing server...');

    expressApp.use(express.static(path.join(__dirname, 'public')));

    console.log('HTTP server and Socket.IO created');

    let client = new ModbusRTU();
    let connected = false;
    let connectionType = '';
    let currentRTUPath = '';

    let lastLogType = '';

    function emitLog(socket, type, message) {
        if (lastLogType === 'RX' && type === 'TX') {
            socket.emit('log', '\n');
        }
        socket.emit('log', `${type}: ${message}`);
        lastLogType = type;
    }

    function handleModbusError(socket, error, data) {
        console.error('Modbus error:', error);
        let errorMessage;
        if (error.message.includes('ERR_OUT_OF_RANGE') || error.message.includes('Illegal data value')) {
            if (data.slaveId !== undefined && (data.slaveId < 0 || data.slaveId > 247)) {
                errorMessage = 'Unit/Slave ID out of range';
            } else if (data.address < 0 || data.address > 65535) {
                errorMessage = 'Register out of range';
            } else if (data.value !== undefined && (data.value < 0 || data.value > 65535)) {
                errorMessage = 'Write value out of range';
            } else {
                errorMessage = 'Invalid parameter: Slave ID, register number, or write value is out of range';
            }
        } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
            errorMessage = 'Incorrect IP Address';
        } else if (error.message.includes('Timed out')) {
            errorMessage = 'Timeout';
        } else {
            errorMessage = 'Error: ' + error.message;
        }
        socket.emit('modbusError', { message: errorMessage });
    }

    const createModbusFrame = (unitId, functionCode, address, value, isResponse = false) => {
        const fc = functionCode.toString(16).padStart(2, '0');
        const addr = address.toString(16).padStart(4, '0');
        let frame = '';

        frame += unitId.toString(16).padStart(2, '0');
        frame += fc;

        if (!isResponse) {
            frame += addr;
        } else {
            frame += '02';
        }

        if (!isResponse) {
            switch (parseInt(functionCode)) {
                case 1:
                case 2:
                case 3:
                case 4:
                    frame += '0001';
                    break;
                case 5:
                    frame += value ? 'FF00' : '0000';
                    break;
                case 6:
                    frame += value.toString(16).padStart(4, '0');
                    break;
            }
        } else {
            frame += value.toString(16).padStart(4, '0');
        }

        const crc = calculateCRC(frame);
        frame += crc;

        return frame.toUpperCase().match(/.{2}/g).join(' ');
    };

    function calculateCRC(frame) {
        let crc = 0xFFFF;
        for (let pos = 0; pos < frame.length; pos += 2) {
            crc ^= parseInt(frame.substr(pos, 2), 16);
            for (let i = 8; i !== 0; i--) {
                if ((crc & 0x0001) !== 0) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        return ((crc & 0xff) << 8 | (crc >> 8)).toString(16).padStart(4, '0');
    }

    function crc16(buffer) {
        let crc = 0xFFFF;
        for (let pos = 0; pos < buffer.length; pos++) {
            crc ^= buffer[pos];
            for (let i = 8; i !== 0; i--) {
                if ((crc & 0x0001) !== 0) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        return crc;
    }

    function getCompleteModbusRequest(functionCode, address, quantity) {
        const fc = parseInt(functionCode);
        const buffer = Buffer.alloc(8);
        buffer.writeUInt8(client.getID(), 0);
        buffer.writeUInt8(fc, 1);
        buffer.writeUInt16BE(address, 2);
        buffer.writeUInt16BE(quantity, 4);
        const crc = crc16(buffer.slice(0, 6));
        buffer.writeUInt16LE(crc, 6);
        return buffer.toString('hex').toUpperCase().match(/.{2}/g).join(' ');
    }

    io.on('connection', (socket) => {
        console.log('New WebSocket connection established');

        socket.on('getPorts', async () => {
            try {
                const ports = await SerialPort.list();
                console.log('Available ports:', ports);
                socket.emit('portList', ports.map(port => port.path));
            } catch (error) {
                console.error('Error retrieving ports:', error);
                socket.emit('error', 'Unable to retrieve port list: ' + error.message);
            }
        });

        socket.on('connect_modbus', async (data) => {
            console.log('Attempting Modbus connection with data:', data);
            try {
                const unitId = parseInt(data.slaveId);
                if (isNaN(unitId) || unitId < 0 || unitId > 247) {
                    throw new Error('Unit/Slave ID out of range');
                }

                if (data.mode === 'TCP') {
                    if (!data.address) {
                        throw new Error('Please select IP Address');
                    }
                    const connectionPromise = client.connectTCP(data.address, { port: parseInt(data.port) || 502 });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
                    );
                    await Promise.race([connectionPromise, timeoutPromise]);
                    console.log('TCP connection established');
                    connectionType = 'TCP';
                } else {
                    if (!data.port) {
                        throw new Error('Please select COM Port');
                    }
                    console.log('Attempting serial connection on port:', data.port);
                    await client.connectRTUBuffered(data.port, { 
                        baudRate: parseInt(data.baudRate) || 9600,
                        dataBits: parseInt(data.dataBits) || 8,
                        stopBits: parseInt(data.stopBits) || 1,
                        parity: data.parity || 'none'
                    });
                    console.log('Serial connection established');
                    connectionType = 'RTU';
                    currentRTUPath = data.port;
                    console.log('RTU port path:', currentRTUPath);
                }
                client.setID(unitId);
                client.setTimeout(parseInt(data.timeout) || 1000);
                connected = true;
                socket.emit('connectionStatus', true);
                console.log('Connected to Modbus server with Unit ID:', unitId);
            } catch (error) {
                console.error('Connection error:', error);
                connected = false;
                socket.emit('connectionStatus', false);
                let errorMessage = error.message;
                if (error.code === 'ENOTFOUND') {
                    errorMessage = 'Incorrect IP Address';
                } else if (error.message === 'Connection timeout') {
                    errorMessage = 'Server not responding';
                }
                socket.emit('connectionError', errorMessage);
            }
        });

        socket.on('disconnect_modbus', () => {
            console.log('Modbus disconnection request received');
            if (connected) {
                const disconnectionPromise = new Promise((resolve) => {
                    client.close(() => {
                        connected = false;
                        currentRTUPath = '';
                        resolve();
                    });
                });
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Disconnection timeout')), CONNECTION_TIMEOUT)
                );
                Promise.race([disconnectionPromise, timeoutPromise])
                    .then(() => {
                        socket.emit('connectionStatus', false);
                        console.log('Disconnected from Modbus server');
                    })
                    .catch((error) => {
                        console.error('Error during disconnection:', error);
                        connected = false;
                        currentRTUPath = '';
                        socket.emit('connectionStatus', false);
                        socket.emit('disconnectionError', 'Disconnection failed: server not responding. You are now disconnected.');
                    });
            } else {
                console.log('Already disconnected');
                socket.emit('connectionStatus', false);
            }
        });

        socket.on('read', async (data) => {
            if (!connected) {
                socket.emit('modbusError', { message: 'Not connected to Modbus server' });
                return;
            }

            try {
                let result;
                const address = parseInt(data.address, 10);
                if (isNaN(address) || address < 0 || address > 65535) {
                    throw new Error('ERR_OUT_OF_RANGE');
                }

                console.log(`Attempting to read at address: ${address}, Function Code: ${data.functionCode}`);

                const unitId = client.getID();
                let requestFrame;
                if (connectionType === 'RTU') {
                    requestFrame = getCompleteModbusRequest(data.functionCode, address, 1);
                } else {
                    requestFrame = createModbusFrame(unitId, parseInt(data.functionCode), address, 1);
                }

                emitLog(socket, 'TX', requestFrame);

                switch (data.functionCode) {
                    case '1':
                        result = await client.readCoils(address, 1);
                        break;
                    case '2':
                        result = await client.readDiscreteInputs(address, 1);
                        break;
                    case '3':
                        result = await client.readHoldingRegisters(address, 1);
                        break;
                    case '4':
                        result = await client.readInputRegisters(address, 1);
                        break;
                    default:
                        throw new Error('Unsupported function code');
                }
                console.log('Read result:', result);
                socket.emit('readResult', { 
                    address: address, 
                    value: result.data[0],
                    functionCode: data.functionCode
                });
                const responseFrame = createModbusFrame(unitId, parseInt(data.functionCode), address, result.data[0], true);
                emitLog(socket, 'RX', responseFrame);
            } catch (error) {
                console.error('Read error:', error);
                handleModbusError(socket, error, { slaveId: client.getID(), address: data.address });
            }
        });

        socket.on('write', async (data) => {
            if (!connected) {
                socket.emit('modbusError', { message: 'Not connected to Modbus server' });
                return;
            }

            try {
                let result;
                const address = parseInt(data.address, 10);
                const value = parseInt(data.value, 10);
                if (isNaN(address) || address < 0 || address > 65535 || isNaN(value) || value < 0 || value > 65535) {
                    throw new Error('ERR_OUT_OF_RANGE');
                }

                const unitId = client.getID();
                let requestFrame;
                if (connectionType === 'RTU') {
                    requestFrame = getCompleteModbusRequest(data.functionCode, address, value);
                } else {
                    requestFrame = createModbusFrame(unitId, parseInt(data.functionCode), address, value);
                }

                emitLog(socket, 'TX', requestFrame);

                switch (data.functionCode) {
                    case '5':
                        if (value !== 0 && value !== 1) {
                            throw new Error('The value for Coils must be 0 or 1');
                        }
                        result = await client.writeCoil(address, value === 1);
                        break;
                    case '6':
                        result = await client.writeRegister(address, value);
                        break;
                    default:
                        throw new Error('Unsupported function code');
                }
                socket.emit('writeResult', { address: address, value: value });
                const responseFrame = createModbusFrame(unitId, parseInt(data.functionCode), address, value, true);
                emitLog(socket, 'RX', responseFrame);
            } catch (error) {
                console.error('Write error:', error);
                handleModbusError(socket, error, { slaveId: client.getID(), address: data.address, value: data.value });
            }
        });

        socket.on('getFavorites', () => {
            console.log('Retrieving favorites');
            const favorites = store.get('favorites', []);
            console.log('Favorites retrieved:', favorites);
            socket.emit('favoritesList', favorites);
        });

        socket.on('addFavorite', (favorite) => {
            console.log('Adding a favorite:', favorite);
            const favorites = store.get('favorites', []);
            favorites.push(favorite);
            store.set('favorites', favorites);
            console.log('Favorites updated:', favorites);
            socket.emit('favoritesList', favorites);
        });

        socket.on('removeFavorite', (index) => {
            console.log('Removing favorite at index:', index);
            const favorites = store.get('favorites', []);
            favorites.splice(index, 1);
            store.set('favorites', favorites);
            console.log('Favorites updated:', favorites);
            socket.emit('favoritesList', favorites);
        });

        socket.on('getFavorite', (index) => {
            console.log('Retrieving favorite at index:', index);
            const favorites = store.get('favorites', []);
            if (index >= 0 && index < favorites.length) {
                const favorite = favorites[index];
                console.log('Favorite retrieved:', favorite);
                socket.emit('favoriteDetails', favorite);
            } else {
                console.error('Invalid favorite index:', index);
                socket.emit('error', 'Favorite not found');
            }
        });

        socket.on('update_modbus_parameters', (data) => {
            console.log('Updating Modbus parameters:', data);
            if (connected) {
                client.setTimeout(data.timeout);
                if (connectionType === 'RTU') {
                    console.log('Current RTU port path:', currentRTUPath);
                    if (!currentRTUPath) {
                        console.error('Error: RTU port path is undefined');
                        socket.emit('error', 'Failed to update RTU parameters: RTU port path is undefined');
                        socket.emit('parameterUpdateStatus', { success: false, message: 'Failed to update RTU parameters: RTU port path is undefined' });
                        return;
                    }
                    client.close(() => {
                        console.log('Reconnecting to RTU with new parameters');
                        client.connectRTUBuffered(currentRTUPath, {
                            baudRate: data.baudRate,
                            dataBits: data.dataBits,
                            stopBits: data.stopBits,
                            parity: data.parity
                        }).then(() => {
                            console.log('RTU parameters updated successfully');
                            socket.emit('parameterUpdateStatus', { success: true, message: 'RTU parameters updated successfully' });
                        }).catch((error) => {
                            console.error('Error updating RTU parameters:', error);
                            socket.emit('error', 'Failed to update RTU parameters: ' + error.message);
                            socket.emit('parameterUpdateStatus', { success: false, message: 'Failed to update RTU parameters: ' + error.message });
                        });
                    });
                } else {
                    console.log('TCP parameters updated successfully');
                    socket.emit('parameterUpdateStatus', { success: true, message: 'TCP parameters updated successfully' });
                }
            } else {
                console.log('Not connected, parameters will be applied on next connection');
                socket.emit('parameterUpdateStatus', { success: false, message: 'Not connected, parameters will be applied on next connection' });
            }
        });

    });

    return { expressApp, server, io };
}

module.exports = createServer;