# Princeton Study Data Collection Server

Server for collecting browsing history data from the Princeton Search Engine Engagement Study extension.

## Features

- ✅ Handles large JSON payloads (100MB+)
- ✅ PostgreSQL database for data storage
- ✅ Automatic database initialization
- ✅ Batch insertion for performance
- ✅ Transaction support for data integrity
- ✅ CORS enabled for browser extensions
- ✅ Health check endpoints
- ✅ Statistics dashboard

## Database Schema

### Tables

1. **participants** - Tracks unique participants
   - `id` - Serial primary key
   - `participant_id` - Unique participant identifier
   - `first_seen` - First export timestamp
   - `last_seen` - Most recent export timestamp
   - `total_exports` - Number of exports from this participant

2. **history_exports** - Tracks each export event
   - `id` - Serial primary key
   - `participant_id` - Foreign key to participants
   - `export_timestamp` - When participant triggered export
   - `entry_count` - Number of history entries
   - `received_at` - When server received the data

3. **history_entries** - Individual browsing history records
   - `id` - Serial primary key
   - `export_id` - Foreign key to history_exports
   - `url` - Full URL
   - `title` - Page title
   - `last_visit_time` - Most recent visit timestamp
   - `visit_count` - Total visits to this URL
   - `typed_count` - Times URL was typed directly

## Deployment to Railway

### Step 1: Push to GitHub

```bash
cd server
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your repository (you may need to grant Railway access)
6. Select the `server` folder if prompted for a root directory

### Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically:
   - Create the database
   - Set the `DATABASE_URL` environment variable
   - Connect it to your service

### Step 4: Get Your Server URL

1. In your Railway project, click on your service
2. Go to **"Settings"** tab
3. Scroll to **"Domains"**
4. Click **"Generate Domain"**
5. Copy the generated URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Update Extension

Update the server URL in your extension:

`src/history-viewer.ts` line 32:
```typescript
const EXPORT_SERVER_URL = 'https://your-app.up.railway.app/api/export-history';
```

Then rebuild:
```bash
cd ..  # Back to extension root
npm run build
cp -r dist/* "safari/Google AI Overview Study/extension/"
```

### Step 6: Test the Deployment

Test health check:
```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-02-13T12:34:56.789Z"
}
```

## API Endpoints

### POST /api/export-history

Receives browsing history data from extension.

**Request:**
```json
{
  "participantId": "participant_1234567890_abc123",
  "timestamp": "2024-02-13T12:34:56.789Z",
  "entryCount": 1500,
  "history": [
    {
      "url": "https://example.com",
      "title": "Example",
      "lastVisitTime": "2024-02-13T10:00:00.000Z",
      "visitCount": 5,
      "typedCount": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully stored 1500 history entries",
  "exportId": 123
}
```

### GET /health

Check server and database health.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-02-13T12:34:56.789Z"
}
```

### GET /api/stats

View aggregate statistics (useful for monitoring).

**Response:**
```json
{
  "participants": 42,
  "totalExports": 156,
  "totalEntries": 234567,
  "recentExports": [...]
}
```

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL installed locally

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create local database:
```bash
createdb princeton_study
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with local database URL:
```
DATABASE_URL=postgresql://localhost:5432/princeton_study
PORT=3000
NODE_ENV=development
```

5. Start development server:
```bash
npm run dev
```

Server will run at `http://localhost:3000`

## Monitoring

### View Logs

In Railway:
1. Go to your project
2. Click on your service
3. Go to **"Deployments"** tab
4. Click on the active deployment
5. View real-time logs

### Check Statistics

Visit your server URL + `/api/stats`:
```
https://your-app.up.railway.app/api/stats
```

## Data Export

### Export Participant Data

Connect to Railway PostgreSQL:

1. In Railway, click on your PostgreSQL service
2. Go to **"Connect"** tab
3. Copy the connection string
4. Use `psql` or any PostgreSQL client:

```bash
psql "postgresql://user:pass@host:port/database"
```

### Sample Queries

**Get all participants:**
```sql
SELECT * FROM participants ORDER BY last_seen DESC;
```

**Get export history for a participant:**
```sql
SELECT * FROM history_exports
WHERE participant_id = 'participant_123'
ORDER BY export_timestamp DESC;
```

**Get browsing history for an export:**
```sql
SELECT * FROM history_entries
WHERE export_id = 123
ORDER BY last_visit_time DESC;
```

**Export to CSV:**
```sql
COPY (
  SELECT
    p.participant_id,
    he.export_timestamp,
    h.url,
    h.title,
    h.last_visit_time,
    h.visit_count,
    h.typed_count
  FROM history_entries h
  JOIN history_exports he ON h.export_id = he.id
  JOIN participants p ON he.participant_id = p.participant_id
) TO '/tmp/history_data.csv' CSV HEADER;
```

## Security Considerations

1. **HTTPS Only**: Railway provides HTTPS by default
2. **CORS**: Currently set to accept all origins (`*`). Update in production if needed
3. **Rate Limiting**: Consider adding rate limiting for production
4. **Authentication**: Add authentication tokens if needed
5. **Data Privacy**: Ensure compliance with IRB requirements
6. **Backup**: Enable automatic backups in Railway

## Troubleshooting

### Database Connection Issues

Check DATABASE_URL is set:
```bash
# In Railway dashboard → Service → Variables
```

### Large Payload Errors

Increase payload limit in `server.js`:
```javascript
app.use(express.json({ limit: '100mb' }));
```

### Memory Issues

Increase memory allocation in Railway:
- Go to Service → Settings → Resources
- Adjust memory allocation

## Cost

Railway free tier includes:
- $5 credit per month
- ~500 hours of usage
- Sufficient for small-medium studies (hundreds of participants)

Monitor usage in Railway dashboard → Usage tab

## Support

For issues:
- Railway docs: docs.railway.app
- PostgreSQL docs: postgresql.org/docs
- Express.js docs: expressjs.com

## License

MIT - For research use by Princeton Search Engine Engagement Study
