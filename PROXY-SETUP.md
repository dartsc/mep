# Local Python Proxy Setup

## What This Does

The Python proxy server acts as a bridge between your userscript and the Vercel server:

```
Userscript → Local Python (localhost:8080) → Vercel (https://mep-lyart.vercel.app)
```

**Why?** Tampermonkey has message size limits, but a local Python server doesn't!

## Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or just double-click `start-proxy.bat` (it will install automatically)

### 2. Start the Proxy Server

**Option A: Double-click**
- Just double-click `start-proxy.bat`

**Option B: Command Line**
```bash
python proxy-server.py
```

You should see:
```
🚀 Starting Memory Scanner Proxy Server
📡 Vercel Server: https://mep-lyart.vercel.app
🌐 Local Server: http://localhost:8080
```

### 3. Use the Userscript

1. Make sure the proxy server is running (step 2)
2. Install the userscript in Tampermonkey (it's already configured to use localhost:8080)
3. Visit any website and press **Ctrl+Shift+M**
4. Click "Deep Scan" and scan for values!

## How It Works

1. **Userscript** collects memory data (can be huge!)
2. **Local Python proxy** receives it (no size limits!)
3. **Python proxy** forwards to Vercel server
4. **Vercel** does the heavy scanning
5. **Results** flow back: Vercel → Python → Userscript → You!

## Advantages

✅ **No message size limits** - Python can handle gigabytes  
✅ **Fast local connection** - Userscript → Python is instant  
✅ **Powerful server scanning** - Vercel does the deep work  
✅ **Easy debugging** - See all requests in Python console  

## Endpoints

- `GET http://localhost:8080/health` - Check if proxy is running
- `POST http://localhost:8080/scan` - Send memory scan data

## Troubleshooting

**"Connection refused" error?**
- Make sure the proxy server is running (double-click `start-proxy.bat`)

**"Module not found" error?**
- Run: `pip install -r requirements.txt`

**Firewall blocking?**
- Allow Python through your firewall (it only listens on localhost:8080)

**Still getting errors?**
- Check the Python console for detailed error messages
- Make sure port 8080 isn't already in use

## Testing

Test the proxy manually:
```bash
curl http://localhost:8080/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Local proxy server is running",
  "vercel_server": "https://mep-lyart.vercel.app"
}
```
