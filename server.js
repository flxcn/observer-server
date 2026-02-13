const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
  console.error('');
  console.error('Please add a PostgreSQL database to your Railway project:');
  console.error('1. Go to Railway dashboard');
  console.error('2. Click "New" → "Database" → "PostgreSQL"');
  console.error('3. Wait for it to provision');
  console.error('4. Redeploy your service');
  console.error('');
  console.error('Railway will automatically set the DATABASE_URL variable.');
  process.exit(1);
}

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

    // Create SERP data tables
    // Main SERP export table
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_exports (
        id SERIAL PRIMARY KEY,
        participant_id VARCHAR(255) NOT NULL,
        export_timestamp TIMESTAMP NOT NULL,
        entry_count INTEGER NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES participants(participant_id)
      )
    `);

    // Individual SERP sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_sessions (
        id SERIAL PRIMARY KEY,
        export_id INTEGER NOT NULL,
        serp_id VARCHAR(255) NOT NULL,
        participant_id VARCHAR(255) NOT NULL,
        visit_start_time TIMESTAMP NOT NULL,
        query TEXT NOT NULL,
        hashed_query VARCHAR(255),
        attribution TEXT,
        attention_duration INTEGER,
        max_scroll_depth NUMERIC(10,2),
        max_scroll_percentage NUMERIC(5,2),
        page_height NUMERIC(10,2),
        viewport_height NUMERIC(10,2),
        ai_overview_top_position NUMERIC(10,2),
        ai_overview_bottom_position NUMERIC(10,2),
        is_ai_overview_expanded BOOLEAN,
        ai_overview_initial_height NUMERIC(10,2),
        ai_overview_expanded_height NUMERIC(10,2),
        dive_deeper_clicked BOOLEAN,
        dive_deeper_click_timestamp TIMESTAMP,
        FOREIGN KEY (export_id) REFERENCES serp_exports(id) ON DELETE CASCADE
      )
    `);

    // Organic results
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_organic_results (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        top_left_x NUMERIC(10,2),
        top_left_y NUMERIC(10,2),
        top_right_x NUMERIC(10,2),
        top_right_y NUMERIC(10,2),
        bottom_left_x NUMERIC(10,2),
        bottom_left_y NUMERIC(10,2),
        bottom_right_x NUMERIC(10,2),
        bottom_right_y NUMERIC(10,2),
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // Ad results
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_ad_results (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        top_left_x NUMERIC(10,2),
        top_left_y NUMERIC(10,2),
        top_right_x NUMERIC(10,2),
        top_right_y NUMERIC(10,2),
        bottom_left_x NUMERIC(10,2),
        bottom_left_y NUMERIC(10,2),
        bottom_right_x NUMERIC(10,2),
        bottom_right_y NUMERIC(10,2),
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // Result clicks
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_result_clicks (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        click_timestamp TIMESTAMP NOT NULL,
        attention_duration_until_click INTEGER,
        is_page_loaded_upon_selection BOOLEAN,
        result_ranking INTEGER,
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // Ad clicks
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_ad_clicks (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        click_timestamp TIMESTAMP NOT NULL,
        attention_duration_until_click INTEGER,
        is_page_loaded_upon_selection BOOLEAN,
        result_ranking INTEGER,
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // AI Overview clicks
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_aio_clicks (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        link_text TEXT,
        click_timestamp TIMESTAMP NOT NULL,
        attention_duration_until_click INTEGER,
        is_page_loaded_upon_selection BOOLEAN,
        redirects_to_google_serp BOOLEAN,
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // AI Overview links
    await client.query(`
      CREATE TABLE IF NOT EXISTS serp_aio_links (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES serp_sessions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for SERP tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_serp_sessions_export
      ON serp_sessions(export_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_serp_sessions_participant
      ON serp_sessions(participant_id)
    `);

    // Migration: Convert INTEGER columns to NUMERIC for decimal support
    // Check if serp_sessions table exists and has INTEGER columns
    const checkSerpSessions = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'serp_sessions'
      AND column_name IN ('max_scroll_depth', 'page_height', 'viewport_height', 'ai_overview_top_position',
                          'ai_overview_bottom_position', 'ai_overview_initial_height', 'ai_overview_expanded_height')
      AND data_type = 'integer'
    `);

    if (checkSerpSessions.rows.length > 0) {
      console.log('🔄 Migrating serp_sessions columns from INTEGER to NUMERIC...');
      const columnsToMigrate = ['max_scroll_depth', 'page_height', 'viewport_height', 'ai_overview_top_position',
                                'ai_overview_bottom_position', 'ai_overview_initial_height', 'ai_overview_expanded_height'];
      for (const col of columnsToMigrate) {
        await client.query(`ALTER TABLE serp_sessions ALTER COLUMN ${col} TYPE NUMERIC(10,2)`);
      }
      console.log('✅ Migrated serp_sessions columns');
    }

    // Migration: Convert position columns in organic_results
    const checkOrganic = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'serp_organic_results'
      AND column_name LIKE '%_x' OR column_name LIKE '%_y'
      AND data_type = 'integer'
      LIMIT 1
    `);

    if (checkOrganic.rows.length > 0) {
      console.log('🔄 Migrating serp_organic_results columns from INTEGER to NUMERIC...');
      const positionCols = ['top_left_x', 'top_left_y', 'top_right_x', 'top_right_y',
                           'bottom_left_x', 'bottom_left_y', 'bottom_right_x', 'bottom_right_y'];
      for (const col of positionCols) {
        await client.query(`ALTER TABLE serp_organic_results ALTER COLUMN ${col} TYPE NUMERIC(10,2)`);
      }
      console.log('✅ Migrated serp_organic_results columns');
    }

    // Migration: Convert position columns in ad_results
    const checkAds = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'serp_ad_results'
      AND column_name LIKE '%_x' OR column_name LIKE '%_y'
      AND data_type = 'integer'
      LIMIT 1
    `);

    if (checkAds.rows.length > 0) {
      console.log('🔄 Migrating serp_ad_results columns from INTEGER to NUMERIC...');
      const positionCols = ['top_left_x', 'top_left_y', 'top_right_x', 'top_right_y',
                           'bottom_left_x', 'bottom_left_y', 'bottom_right_x', 'bottom_right_y'];
      for (const col of positionCols) {
        await client.query(`ALTER TABLE serp_ad_results ALTER COLUMN ${col} TYPE NUMERIC(10,2)`);
      }
      console.log('✅ Migrated serp_ad_results columns');
    }

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

// SERP data export endpoint
app.post('/api/export-serp', async (req, res) => {
  const client = await pool.connect();

  try {
    const { participantId, timestamp, serpData } = req.body;

    // Validate required fields
    if (!participantId || !timestamp || !serpData || typeof serpData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: participantId, timestamp, serpData'
      });
    }

    const serpEntries = Object.entries(serpData);
    const entryCount = serpEntries.length;

    console.log(`📥 Receiving SERP export from participant: ${participantId}`);
    console.log(`   SERP sessions: ${entryCount}`);
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

    // Insert SERP export record
    const exportResult = await client.query(`
      INSERT INTO serp_exports (participant_id, export_timestamp, entry_count)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [participantId, timestamp, entryCount]);

    const exportId = exportResult.rows[0].id;

    // Insert each SERP session
    let processedSessions = 0;

    for (const [serpId, session] of serpEntries) {
      try {
        console.log(`   Processing SERP session: ${serpId}`);
        console.log(`   Query: ${session.query}`);
        console.log(`   Visit time: ${session.visitStartTime}`);

        // Insert SERP session
        const sessionResult = await client.query(`
        INSERT INTO serp_sessions (
          export_id, serp_id, participant_id, visit_start_time, query, hashed_query,
          attribution, attention_duration, max_scroll_depth, max_scroll_percentage,
          page_height, viewport_height, ai_overview_top_position, ai_overview_bottom_position,
          is_ai_overview_expanded, ai_overview_initial_height, ai_overview_expanded_height,
          dive_deeper_clicked, dive_deeper_click_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id
      `, [
        exportId,
        serpId,
        session.participantId || participantId,
        session.visitStartTime,
        session.query,
        session.hashedQuery || null,
        session.attribution || null,
        session.attentionDuration || null,
        session.maxScrollDepth || null,
        session.maxScrollPercentage || null,
        session.pageHeight || null,
        session.viewportHeight || null,
        session.aiOverviewTopPosition || null,
        session.aiOverviewBottomPosition || null,
        session.isAiOverviewExpanded || null,
        session.aiOverviewInitialHeight || null,
        session.aiOverviewExpandedHeight || null,
        session.diveDeeperClicked || null,
        session.diveDeeperClickTimestamp || null
      ]);

      const sessionId = sessionResult.rows[0].id;

      // Insert organic results
      if (session.organicResults && Array.isArray(session.organicResults)) {
        for (const result of session.organicResults) {
          await client.query(`
            INSERT INTO serp_organic_results (
              session_id, url, title, top_left_x, top_left_y, top_right_x, top_right_y,
              bottom_left_x, bottom_left_y, bottom_right_x, bottom_right_y
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            sessionId,
            result.url,
            result.title || null,
            result.topLeft?.x || null,
            result.topLeft?.y || null,
            result.topRight?.x || null,
            result.topRight?.y || null,
            result.bottomLeft?.x || null,
            result.bottomLeft?.y || null,
            result.bottomRight?.x || null,
            result.bottomRight?.y || null
          ]);
        }
      }

      // Insert ad results
      if (session.adResults && Array.isArray(session.adResults)) {
        for (const ad of session.adResults) {
          await client.query(`
            INSERT INTO serp_ad_results (
              session_id, url, title, top_left_x, top_left_y, top_right_x, top_right_y,
              bottom_left_x, bottom_left_y, bottom_right_x, bottom_right_y
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            sessionId,
            ad.url,
            ad.title || null,
            ad.topLeft?.x || null,
            ad.topLeft?.y || null,
            ad.topRight?.x || null,
            ad.topRight?.y || null,
            ad.bottomLeft?.x || null,
            ad.bottomLeft?.y || null,
            ad.bottomRight?.x || null,
            ad.bottomRight?.y || null
          ]);
        }
      }

      // Insert result clicks
      if (session.resultClicks && Array.isArray(session.resultClicks)) {
        for (const click of session.resultClicks) {
          await client.query(`
            INSERT INTO serp_result_clicks (
              session_id, url, click_timestamp, attention_duration_until_click,
              is_page_loaded_upon_selection, result_ranking
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            sessionId,
            click.url,
            click.timestamp,
            click.attentionDurationUntilClick || null,
            click.isPageLoadedUponSelection || null,
            click.resultRanking || null
          ]);
        }
      }

      // Insert ad clicks
      if (session.adClicks && Array.isArray(session.adClicks)) {
        for (const click of session.adClicks) {
          await client.query(`
            INSERT INTO serp_ad_clicks (
              session_id, url, click_timestamp, attention_duration_until_click,
              is_page_loaded_upon_selection, result_ranking
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            sessionId,
            click.url,
            click.timestamp,
            click.attentionDurationUntilClick || null,
            click.isPageLoadedUponSelection || null,
            click.resultRanking || null
          ]);
        }
      }

      // Insert AI Overview clicks
      if (session.aiOverviewClicks && Array.isArray(session.aiOverviewClicks)) {
        for (const click of session.aiOverviewClicks) {
          await client.query(`
            INSERT INTO serp_aio_clicks (
              session_id, url, link_text, click_timestamp, attention_duration_until_click,
              is_page_loaded_upon_selection, redirects_to_google_serp
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            sessionId,
            click.url,
            click.linkText || null,
            click.timestamp,
            click.attentionDurationUntilClick || null,
            click.isPageLoadedUponSelection || null,
            click.redirectsToGoogleSERP || null
          ]);
        }
      }

      // Insert AI Overview links
      if (session.aiOverviewLinks && Array.isArray(session.aiOverviewLinks)) {
        for (const link of session.aiOverviewLinks) {
          await client.query(`
            INSERT INTO serp_aio_links (session_id, url)
            VALUES ($1, $2)
          `, [sessionId, link]);
        }
      }

        processedSessions++;
        if (processedSessions % 10 === 0) {
          console.log(`   Processed ${processedSessions}/${entryCount} sessions...`);
        }
      } catch (sessionError) {
        console.error(`   ❌ Error processing session ${serpId}:`, sessionError);
        console.error(`   Session data:`, JSON.stringify(session, null, 2));
        throw sessionError; // Re-throw to rollback transaction
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Successfully stored ${processedSessions} SERP sessions from ${participantId}`);

    res.json({
      success: true,
      message: `Successfully stored ${processedSessions} SERP sessions`,
      exportId: exportId
    });

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');

    console.error('❌ Error processing SERP export:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error processing SERP export',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get statistics endpoint (optional, for admin viewing)
app.get('/api/stats', async (req, res) => {
  try {
    const participantCount = await pool.query('SELECT COUNT(DISTINCT participant_id) as count FROM participants');

    // History stats
    const historyExportCount = await pool.query('SELECT COUNT(*) as count FROM history_exports');
    const historyEntryCount = await pool.query('SELECT COUNT(*) as count FROM history_entries');
    const recentHistoryExports = await pool.query(`
      SELECT participant_id, export_timestamp, entry_count
      FROM history_exports
      ORDER BY received_at DESC
      LIMIT 5
    `);

    // SERP stats
    const serpExportCount = await pool.query('SELECT COUNT(*) as count FROM serp_exports');
    const serpSessionCount = await pool.query('SELECT COUNT(*) as count FROM serp_sessions');
    const recentSerpExports = await pool.query(`
      SELECT participant_id, export_timestamp, entry_count
      FROM serp_exports
      ORDER BY received_at DESC
      LIMIT 5
    `);

    res.json({
      participants: parseInt(participantCount.rows[0].count),
      history: {
        totalExports: parseInt(historyExportCount.rows[0].count),
        totalEntries: parseInt(historyEntryCount.rows[0].count),
        recentExports: recentHistoryExports.rows
      },
      serp: {
        totalExports: parseInt(serpExportCount.rows[0].count),
        totalSessions: parseInt(serpSessionCount.rows[0].count),
        recentExports: recentSerpExports.rows
      }
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
