# Memory Scanner Server

Ultra-deep memory scanning server for browser games.

## Setup

1. Install Node.js from https://nodejs.org/
2. Open PowerShell in this folder
3. Run: `npm install`
4. Run: `npm start`

Server will start on http://localhost:3333

## Features

- **Ultra-deep scanning**: Up to 100 levels deep
- **Fast processing**: Runs in separate Node.js process
- **Non-blocking**: Browser UI stays responsive
- **Comprehensive**: Scans all properties, prototypes, and symbols

## Usage

1. Start the server: `npm start`
2. Enable "Deep Scan" in the userscript
3. The userscript will automatically use the server if available
4. Falls back to client-side scanning if server is offline

## How it works

The userscript serializes window data and sends it to the server. The server performs ultra-deep scanning (100 levels) and returns filtered results. This keeps your browser responsive during heavy scans.
