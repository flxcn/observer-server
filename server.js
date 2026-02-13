const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
// Railway automatically provides DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Middleware
app.use(cors({
  origin: '*', // Update in production to specific origins if needed
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Increase payload size limit for large history exports
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        participant_id VARCHAR(255) UNIQUE NOT NULL,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_exports INTEGER DEFAULT 0
      )
    `);

    // Create history_exports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS history_exports (
        id SERIAL PRIMARY KEY,
        participant_id VARCHAR(255) NOT NULL,
        export_timestamp TIMESTAMP NOT NULL,
        entry_count INTEGER NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES participants(participant_id)
      )
    `);

    // Create history_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS history_entries (
        id SERIAL PRIMARY KEY,
        export_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        last_visit_time TIMESTAMP NOT NULL,
        visit_count INTEGER NOT NULL,
        typed_count INTEGER NOT NULL,
        FOREIGN KEY (export_id) REFERENCES history_exports(id) ON DELETE CASCADE
      )
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_participant_id
      ON history_entries(export_id)
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Princeton Search Engine Engagement Study - Data Collection Server',
    timestamp: new Date().toISOString()
  });
});

// Health check for database
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Main export endpoint
app.post('/api/export-history', async (req, res) => {
  const client = await pool.connect();

  try {
    const { participantId, timestamp, entryCount, history } = req.body;

    // Validate required fields
    if (!participantId || !timestamp || !history || !Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: participantId, timestamp, history'
      });
    }

    console.log(`📥 Receiving export from participant: ${participantId}`);
    console.log(`   Entry count: ${entryCount || history.length}`);
    console.log(`   Timestamp: ${timestamp}`);

    // Start transaction
    await client.query('BEGIN');

    // Insert or update participant
    await client.query(`
      INSERT INTO participants (participant_id, last_seen, total_exports)
      VALUES ($1, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (participant_id)
      DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP,
        total_exports = participants.total_exports + 1
    `, [participantId]);

    // Insert history export record
    const exportResult = await client.query(`
      INSERT INTO history_exports (participant_id, export_timestamp, entry_count)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [participantId, timestamp, entryCount || history.length]);

    const exportId = exportResult.rows[0].id;

    // Insert history entries in batches
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < history.length; i += batchSize) {
      const batch = history.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      batch.forEach((entry, index) => {
        const baseIndex = index * 6;
        placeholders.push(
          `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`
        );
        values.push(
          exportId,
          entry.url || '',
          entry.title || '(No title)',
          entry.lastVisitTime,
          entry.visitCount || 0,
          entry.typedCount || 0
        );
      });

      if (values.length > 0) {
        await client.query(`
          INSERT INTO history_entries
          (export_id, url, title, last_visit_time, visit_count, typed_count)
          VALUES ${placeholders.join(', ')}
        `, values);

        inserted += batch.length;
        console.log(`   Inserted ${inserted}/${history.length} entries...`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Successfully stored ${inserted} history entries from ${participantId}`);

    res.json({
      success: true,
      message: `Successfully stored ${inserted} history entries`,
      exportId: exportId
    });

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');

    console.error('❌ Error processing history export:', error);

    res.status(500).json({
      success: false,
      error: 'Internal server error processing history export'
    });
  } finally {
    client.release();
  }
});

// Get statistics endpoint (optional, for admin viewing)
app.get('/api/stats', async (req, res) => {
  try {
    const participantCount = await pool.query('SELECT COUNT(DISTINCT participant_id) as count FROM participants');
    const exportCount = await pool.query('SELECT COUNT(*) as count FROM history_exports');
    const entryCount = await pool.query('SELECT COUNT(*) as count FROM history_entries');
    const recentExports = await pool.query(`
      SELECT participant_id, export_timestamp, entry_count
      FROM history_exports
      ORDER BY received_at DESC
      LIMIT 10
    `);

    res.json({
      participants: parseInt(participantCount.rows[0].count),
      totalExports: parseInt(exportCount.rows[0].count),
      totalEntries: parseInt(entryCount.rows[0].count),
      recentExports: recentExports.rows
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching statistics'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();

    // Then start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📈 Statistics: http://localhost:${PORT}/api/stats`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

// Start the server
startServer();
