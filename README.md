# climb - Simple Modbus Client

climb is a versatile lightweight Modbus client application that supports both TCP and RTU protocols. It provides an intuitive interface for interacting with Modbus devices, allowing users to read and write data easily.

climb is a Web application that can be run using Node.js or Electron.

## Features

- Support for Modbus TCP and RTU protocols
- Read and write operations for Coils, Discrete Inputs, Input Registers, and Holding Registers
- Dynamic COM port detection for RTU connections
- Configurable connection parameters (baud rate, data bits, parity, stop bits, timeout)
- Favorites system to save and quickly load connection configurations
- Real-time logging of Modbus frames (TX/RX)
- Cross-platform compatibility (Windows, macOS, Linux)

## Running the Application

### Using Node.js

1. Ensure you have Node.js installed on your system.
2. Navigate to the project directory in your terminal.
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   node server.js
   ```
5. Open a web browser and go to `http://localhost:3000` (default port, or the port specified in the console output).

### Using Electron

1. Ensure you have Node.js and npm installed on your system.
2. Navigate to the project directory in your terminal.
3. Install dependencies:
   ```
   npm install
   ```
4. Start the Electron app:
   ```
   npm start
   ```

### Building Electron Executable

To create a distributable package for your platform:

1. Install dependencies if you haven't already:
   ```
   npm install
   ```
2. Run the build command:
   ```
   npm run make
   ```
3. The packaged application will be available in the `out` directory.

## Requirements

- Node.js (v14.0.0 or later recommended)
- npm (usually comes with Node.js)

## License

[MIT License](LICENSE)

## Contributing

Contributions welcome!