# ✅ Deployment Complete!

## Production URLs

**Main Production URL:** `https://mep-lyart.vercel.app`

**Alternative URLs:**
- `https://mep-dawye28s-projects.vercel.app`
- `https://mep-git-main-dawye28s-projects.vercel.app`

## Endpoints

✅ **Health Check:** `GET https://mep-lyart.vercel.app/health`
- Returns: `{"status":"ok","timestamp":...,"message":"Memory Scanner Server is running on Vercel"}`

✅ **Memory Scan:** `POST https://mep-lyart.vercel.app/scan`
- Accepts: JSON payload with memory data
- Returns: Scanned matches

## Userscript Configuration

The userscript (`memoryeditor.userscript.js`) is already configured to use:
```javascript
const SERVER_URL = 'https://mep-lyart.vercel.app';
```

## Installation

1. **Install Tampermonkey**
   - Chrome: https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/
   - Edge: https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd

2. **Install the Userscript**
   - Open Tampermonkey Dashboard
   - Click "+" to create new script
   - Copy entire contents of `memoryeditor.userscript.js`
   - Paste and save (Ctrl+S)

3. **Use It**
   - Visit any website
   - Press **Ctrl+Shift+M** to open Memory Editor
   - Deep scans automatically use the Vercel server!

## Features

- ✅ Server-side deep scanning (bypasses browser memory limits)
- ✅ CORS enabled (works on any website)
- ✅ Automatic fallback to client-side if server unavailable
- ✅ 60-second timeout for large scans
- ✅ Supports exact, range, fuzzy, increased/decreased searches

## Testing

Both endpoints are verified working:

```bash
# Health check
curl https://mep-lyart.vercel.app/health

# Test scan
curl -X POST https://mep-lyart.vercel.app/scan \
  -H "Content-Type: application/json" \
  -d '{"data":"{}","searchValue":"123","searchType":"exact","includeStrings":false}'
```

## Notes

- The server uses Vercel's serverless functions (Node.js runtime)
- Each function call has a max execution time of 10 seconds (Hobby plan) or 60 seconds (Pro plan)
- CORS is enabled for all origins
- The userscript uses `GM_xmlhttpRequest` to bypass CSP restrictions
