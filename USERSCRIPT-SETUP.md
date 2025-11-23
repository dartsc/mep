# Memory Editor Userscript Setup

## Step 1: Deploy to Vercel

Follow the instructions in `VERCEL-DEPLOY.md` to deploy your server to Vercel.

After deployment, you'll get a URL like: `https://your-project-name.vercel.app`

## Step 2: Update Userscript

Open `memoryeditor.userscript.js` and find this line (around line 17):

```javascript
const SERVER_URL = 'https://your-project.vercel.app';
```

Replace `https://your-project.vercel.app` with your actual Vercel deployment URL.

## Step 3: Install Tampermonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/) extension for your browser
2. Click the Tampermonkey icon → Dashboard
3. Click the "+" tab to create a new script
4. Copy and paste the entire contents of `memoryeditor.userscript.js`
5. Save (Ctrl+S or File → Save)

## Step 4: Use It

1. Visit any website (like a browser game)
2. Press **Ctrl+Shift+M** to open the Memory Editor
3. The editor will automatically use your Vercel server for deep scans

## Features

- **Deep Scan**: Uses server-side scanning for thorough memory analysis
- **Fast Scan**: Client-side scanning for quick searches
- **Auto Fallback**: If Vercel server is unavailable, automatically falls back to client-side scanning
- **Cross-Origin**: Works on any website thanks to Tampermonkey's GM_xmlhttpRequest

## Troubleshooting

### "Server unavailable" message
- Check that your Vercel deployment is running
- Visit `https://your-project.vercel.app/health` in your browser to verify
- Make sure you updated the SERVER_URL in the userscript

### Userscript not loading
- Check Tampermonkey dashboard to ensure it's enabled
- Refresh the webpage
- Press Ctrl+Shift+M to toggle the GUI

### Deep scan not working
- The userscript will automatically fall back to client-side scanning
- Check browser console (F12) for error messages
- Ensure `@connect` directives in userscript header match your domain
