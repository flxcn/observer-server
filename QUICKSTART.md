# 🚀 Railway Deployment - Quick Start

Complete server for collecting browsing history data. Deploy in ~10 minutes.

## What You Have

```
server/
├── server.js           # Main Express server with PostgreSQL
├── package.json        # Dependencies (Express, pg, cors)
├── .env.example        # Environment variables template
├── .gitignore         # Git exclusions
├── test-endpoint.sh   # Test script
├── README.md          # Full documentation
├── DEPLOY.md          # Step-by-step deployment guide
└── QUICKSTART.md      # This file
```

## Prerequisites

- GitHub account
- 5 minutes

## Deploy Now

### 1. Push to GitHub (2 minutes)

```bash
cd server

# Initialize git
git init
git add .
git commit -m "Initial server setup"

# Push to GitHub
# First create a new repo at github.com/new
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/princeton-study-server.git
git push -u origin main
```

### 2. Deploy on Railway (3 minutes)

1. Go to **[railway.app](https://railway.app)**
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose `princeton-study-server`
6. Click **"New"** → **"Database"** → **"PostgreSQL"**
7. Go to your service → **"Settings"** → **"Domains"** → **"Generate Domain"**
8. Copy your URL: `https://XXXXX.up.railway.app`

### 3. Update Extension (2 minutes)

Edit `src/history-viewer.ts` line 32:
```typescript
const EXPORT_SERVER_URL = 'https://XXXXX.up.railway.app/api/export-history';
```

Build:
```bash
cd ..  # Back to extension root
npm run build
cp -r dist/* "safari/Google AI Overview Study/extension/"
```

### 4. Test (1 minute)

```bash
curl https://XXXXX.up.railway.app/health
```

Expected:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

## ✅ Done!

Your server is live and collecting data.

## View Data

**Statistics:**
```
https://XXXXX.up.railway.app/api/stats
```

**Database:**
- Railway Dashboard → PostgreSQL → Data tab

**Logs:**
- Railway Dashboard → Service → Deployments

## Files You Need to Know

- **`server.js`** - Main server code (you probably don't need to edit this)
- **`DEPLOY.md`** - Detailed deployment guide
- **`README.md`** - Full documentation including database schema and queries

## Costs

Railway free tier: **$5/month credit**

Your usage for a typical study:
- ~100 participants
- Weekly exports
- **Cost: $2-3/month** ✅ Well within free tier

## Support

- **Railway Issues?** → [railway.app/help](https://railway.app/help)
- **Server Issues?** → Check logs in Railway Dashboard
- **Extension Issues?** → Check browser console

## Security Note

Data is:
- ✅ Encrypted in transit (HTTPS)
- ✅ Stored in PostgreSQL with Railway's security
- ✅ Private (only you have access)

Ensure IRB compliance for your study.
