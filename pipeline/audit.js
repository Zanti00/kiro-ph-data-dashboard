/**
 * ============================================================================
 * DATA QUALITY AUDIT SCRIPT
 * ============================================================================
 * 
 * Standalone audit script for workshop participants to run diagnostics
 * on the raw dataset before cleaning transformations.
 * 
 * Usage: npm run audit
 * ============================================================================
 */

import duckdb from 'duckdb';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_FILE = join(__dirname, '..', 'flood_control.json');

function createDatabase() {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(':memory:', (err) => {
      if (err) reject(err);
      else resolve({ db, conn: db.connect() });
    });
  });
}

function query(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function runAudit() {
  console.log('\n=== DATA QUALITY AUDIT REPORT ===\n');
  
  if (!existsSync(INPUT_FILE)) {
    console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  
  const { db, conn } = await createDatabase();
  
  try {
    // Load data
    console.log('Loading dataset...');
    await exec(conn, `
      CREATE TABLE raw AS 
      SELECT attributes.*
      FROM (
        SELECT unnest(features) as feat
        FROM read_json('${INPUT_FILE.replace(/\\/g, '/')}', 
          maximum_object_size=33554432
        )
      )
      CROSS JOIN LATERAL (SELECT feat.attributes) as t(attributes)
    `);
    
    // 1. Row count
    const rowCount = await query(conn, 'SELECT COUNT(*) as count FROM raw');
    console.log(`\n1. TOTAL ROWS: ${rowCount[0].count}\n`);
    
    // 2. Column statistics
    console.log('2. COLUMN STATISTICS (Top 10 by null percentage):');
    const colStats = await query(conn, `
      SELECT 
        column_name,
        data_type,
        COUNT(*) FILTER (WHERE column_name IS NULL) as nulls,
        ROUND((COUNT(*) FILTER (WHERE column_name IS NULL))::DOUBLE / COUNT(*) * 100, 2) as null_pct
      FROM raw,
           (SELECT unnest(columns) as column_name FROM (DESCRIBE raw))
      GROUP BY column_name, data_type
      ORDER BY null_pct DESC
      LIMIT 10
    `);
    console.table(colStats);
    
    // 3. Duplicates
    const duplicates = await query(conn, `
      SELECT COUNT(*) as duplicate_count
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY ProjectID, ProjectComponentID) as rn
        FROM raw
      ) 
      WHERE rn > 1
    `);
    console.log(`\n3. DUPLICATE RECORDS: ${duplicates[0].duplicate_count}\n`);
    
    // 4. Data type issues
    console.log('4. NUMERIC FIELD VALIDATION:');
    const numericIssues = await query(conn, `
      SELECT 
        'ABC' as field,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE TRY_CAST(ABC AS DOUBLE) IS NULL AND ABC IS NOT NULL) as invalid
      FROM raw
      UNION ALL
      SELECT 
        'ContractCost',
        COUNT(*),
        COUNT(*) FILTER (WHERE TRY_CAST(ContractCost AS DOUBLE) IS NULL AND ContractCost IS NOT NULL)
      FROM raw
    `);
    console.table(numericIssues);
    
    // 5. Whitespace issues
    const whitespace = await query(conn, `
      SELECT 
        COUNT(*) FILTER (WHERE Region != TRIM(Region)) as region_whitespace,
        COUNT(*) FILTER (WHERE Province != TRIM(Province)) as province_whitespace,
        COUNT(*) FILTER (WHERE Municipality != TRIM(Municipality)) as municipality_whitespace
      FROM raw
    `);
    console.log('\n5. WHITESPACE ISSUES:');
    console.table(whitespace);
    
    // 6. Coordinate validation
    const coords = await query(conn, `
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE Longitude IS NOT NULL AND Latitude IS NOT NULL) as with_coordinates,
        COUNT(*) FILTER (
          WHERE Longitude IS NOT NULL 
          AND Latitude IS NOT NULL
          AND (Longitude < 116 OR Longitude > 127 OR Latitude < 4 OR Latitude > 21)
        ) as out_of_bounds
      FROM raw
    `);
    console.log('\n6. COORDINATE VALIDATION (Philippine bounds):');
    console.table(coords);
    
    // 7. Date format issues
    console.log('\n7. DATE FIELD ANALYSIS:');
    const dates = await query(conn, `
      SELECT 
        COUNT(*) FILTER (WHERE CompletionDateOriginal IS NOT NULL) as has_completion_orig,
        COUNT(*) FILTER (WHERE CompletionDateActual IS NOT NULL) as has_completion_actual,
        COUNT(*) FILTER (WHERE StartDate IS NOT NULL) as has_start_date,
        COUNT(*) FILTER (
          WHERE StartDate IS NOT NULL 
          AND TRY_CAST(StartDate AS DATE) IS NULL
        ) as invalid_start_dates
      FROM raw
    `);
    console.table(dates);
    
    console.log('\n=== AUDIT COMPLETE ===\n');
    
  } catch (error) {
    console.error('Audit failed:', error.message);
    throw error;
  } finally {
    conn.close();
    db.close();
  }
}

runAudit().catch(console.error);
