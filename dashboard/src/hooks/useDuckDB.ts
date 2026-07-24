/**
 * ============================================================================
 * WORKSHOP STEP 1: DUCKDB-WASM INITIALIZATION & PARQUET LOADING (SHARED CONTEXT WRAPPER)
 * ============================================================================
 */

import { useDuckDBContext } from '../contexts/DuckDBContext';
export type { FloodControlProject, DuckDBState, QueryResult } from '../contexts/DuckDBContext';

export function useDuckDB() {
  return useDuckDBContext();
}
