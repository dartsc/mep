# ULTRA-DEEP MEMORY SCANNER

## Quick Start (Windows)

1. **Double-click `start-server.bat`**
   - First time: Installs dependencies automatically
   - Starts server on http://localhost:3333
   - Keep this window open!

2. **Enable Deep Scan in userscript**
   - Check "Deep Scan" checkbox
   - Click "Search"
   - Server automatically handles ultra-deep scanning (100 levels!)

## How It Works

### Client-Side (Fast)
- Normal scan: 8 levels deep, 1-2 seconds
- Runs in browser

### Server-Side (Ultra-Deep)
- Deep scan: 100 levels deep, 5-20 seconds
- Runs in Node.js (much faster than browser)
- Scans all prototypes, symbols, non-enumerable properties
- Keeps browser UI responsive

### Automatic Fallback
- If server is offline → uses client-side deep scan (25 levels)
- No errors, seamless experience

## Features

✅ **100-level deep scanning** - finds values buried deep in object graphs  
✅ **Fast** - server processes data much faster than browser  
✅ **Non-blocking** - browser stays responsive  
✅ **Automatic** - just check "Deep Scan" box  
✅ **Fallback** - works without server (reduced depth)  

## Server Commands

```powershell
# Start server
npm start

# Start with auto-restart on code changes
npm run dev

# Manual start
node scan-server.js
```

## Troubleshooting

### "Server unavailable" message
- Make sure `start-server.bat` is running
- Check http://localhost:3333/health in browser
- Restart the server

### Port 3333 already in use
- Close other programs using port 3333
- Or edit `scan-server.js` and change `PORT = 3333` to another number
- Also update `SERVER_URL` in userscript

### Scan takes too long
- Reduce `maxDepth` in scan-server.js (line 105)
- Default is 100, try 50 for faster scans

## Performance

| Mode | Depth | Time | Objects Scanned |
|------|-------|------|-----------------|
| Normal (Client) | 8 | 1-2s | ~10,000 |
| Deep (Client) | 25 | 5-15s | ~50,000 |
| Deep (Server) | 100 | 5-20s | ~500,000 |

Server mode scans 10x deeper while staying nearly as fast!

## What Gets Scanned

- All custom `window` globals (game objects)
- `localStorage` and `sessionStorage`
- All object properties (enumerable + non-enumerable)
- Prototype chains
- Symbol properties
- Canvas contexts (if present)

## Safety

- Skips read-only getters (prevents errors)
- Skips browser internals (webkit, chrome, HTML*, etc)
- Circular reference detection
- Abort capability (stop scan anytime)

---

**Pro Tip**: Start the server once and leave it running. Use it for all your gaming sessions!
