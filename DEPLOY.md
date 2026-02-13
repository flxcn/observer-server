# Quick Deployment Guide - Railway

## 🚀 Deploy in 10 Minutes

### Step 1: Prepare Repository

```bash
cd /Users/fc1892/Documents/GitHub/google-ai-overview/server

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial server setup"

# Create GitHub repo (if not exists)
# Go to github.com/new and create a new repository
# Then:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/princeton-study-server.git
git push -u origin main
```

### Step 2: Deploy to Railway

1. **Sign Up**: Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create New Project**:
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Authorize Railway to access your GitHub
   - Select your `princeton-study-server` repository

3. **Add PostgreSQL**:
   - In the project view, click **"New"**
   - Select **"Database"** → **"PostgreSQL"**
   - Railway automatically creates and links it

4. **Generate Domain**:
   - Click on your service (not the database)
   - Go to **"Settings"** tab
   - Scroll to **"Domains"** section
   - Click **"Generate Domain"**
   - Copy the URL (e.g., `https://princeton-study-production.up.railway.app`)

### Step 3: Update Extension

Edit `src/history-viewer.ts` line 32:

```typescript
const EXPORT_SERVER_URL = 'https://YOUR-RAILWAY-APP.up.railway.app/api/export-history';
```

Rebuild extension:
```bash
cd /Users/fc1892/Documents/GitHub/google-ai-overview
npm run build
cp -r dist/* "safari/Google AI Overview Study/extension/"
```

### Step 4: Test

Test the deployment:
```bash
curl https://YOUR-RAILWAY-APP.up.railway.app/health
```

You should see:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-02-13T12:34:56.789Z"
}
```

## ✅ Done!

Your server is now live and ready to receive data from the extension.

## 📊 Monitor Your Server

**View Logs:**
- Railway Dashboard → Your Service → Deployments → Click active deployment

**View Stats:**
- Visit: `https://YOUR-RAILWAY-APP.up.railway.app/api/stats`

**View Database:**
- Railway Dashboard → PostgreSQL → Data tab

## 🆘 Troubleshooting

**Build Failed?**
- Check Railway logs
- Ensure `package.json` is correct
- Ensure Node.js version is 18+

**Database Connection Error?**
- Railway automatically sets `DATABASE_URL`
- Wait 1-2 minutes after adding PostgreSQL
- Redeploy if needed

**Extension Can't Connect?**
- Check CORS is enabled (it is by default)
- Verify URL is correct (include `/api/export-history`)
- Check Railway deployment status

## 💰 Costs

Railway free tier includes $5 credit/month.

For a small study (100 participants, weekly exports):
- Cost: ~$2-3/month
- Well within free tier

Monitor usage: Railway Dashboard → Project → Usage

## 📈 Next Steps

1. **Enable Backups**: Railway Dashboard → PostgreSQL → Backups
2. **Monitor Usage**: Check Railway usage tab weekly
3. **Export Data**: See README.md for SQL queries
4. **Scale if Needed**: Upgrade Railway plan if you exceed free tier

## 🔗 Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Server Logs: Railway → Service → Deployments
- Database: Railway → PostgreSQL → Data
- Documentation: Full docs in README.md
