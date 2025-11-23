# Deploy to Vercel

This server has been configured for Vercel deployment.

## Files Created

- `vercel.json` - Vercel configuration
- `api/scan.js` - Serverless function for memory scanning
- `api/health.js` - Health check endpoint

## Deployment Steps

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Deploy to Vercel:
   ```bash
   vercel
   ```

3. Follow the prompts to link/create your project

## Endpoints

Once deployed, your endpoints will be:
- `POST https://your-project.vercel.app/scan` - Memory scan endpoint
- `GET https://your-project.vercel.app/health` - Health check

## Local Testing

The original `scan-server.js` still works for local development:
```bash
npm start
```

## Notes

- The serverless functions in `api/` folder are used by Vercel
- CORS is enabled on all endpoints
- The original Express server (`scan-server.js`) remains for local development
