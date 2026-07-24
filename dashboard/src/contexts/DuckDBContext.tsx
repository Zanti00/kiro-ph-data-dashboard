import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

export interface FloodControlProject {
  Region: string;
  Province: string;
  Municipality: string;
  ImplementingOffice: string;
  Longitude: number;
  Latitude: number;
  InfraYear: number;
  ProjectID: string;
  ProjectDescription: string;
  ProjectComponentID: string;
  ProjectComponentDescription: string;
  Program: string | null;
  TypeofWork: string;
  infra_type: string;
  ABC: number;
  ContractCost: number;
  CompletionDateOriginal: string;
  CompletionYear: number;
  CompletionDateActual: string | null;
  StartDate: string;
  ContractID: string;
  Contractor: string;
  FundingYear: string;
  LegislativeDistrict: string;
  DistrictEngineeringOffice: string;
}

export interface DuckDBState {
  db: duckdb.AsyncDuckDB | null;
  connection: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
}

export interface QueryResult<T = any> {
  data: T[];
  duration: number;
  rowCount: number;
}

export interface DuckDBContextType extends DuckDBState {
  query: <T = any>(sql: string) => Promise<QueryResult<T>>;
}

const DuckDBContext = createContext<DuckDBContextType | undefined>(undefined);

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DuckDBState>({
    db: null,
    connection: null,
    loading: true,
    error: null,
    ready: false,
  });

  const connectionRef = useRef<duckdb.AsyncDuckDBConnection | null>(null);

  useEffect(() => {
    let mounted = true;
    let dbInstance: duckdb.AsyncDuckDB | null = null;
    let connInstance: duckdb.AsyncDuckDBConnection | null = null;

    async function initializeDuckDB() {
      const startTime = performance.now();
      console.log('[DuckDB] 🚀 Initializing DuckDB-WASM...');

      try {
        const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
          mvp: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
          },
          eh: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href,
          },
        };
        
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        console.log('[DuckDB] ✓ Bundle selected:', bundle.mainModule);

        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        
        dbInstance = new duckdb.AsyncDuckDB(logger, worker);
        await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
        console.log(`[DuckDB] ✓ Worker instantiated (${(performance.now() - startTime).toFixed(0)}ms)`);

        connInstance = await dbInstance.connect();
        connectionRef.current = connInstance;
        console.log('[DuckDB] ✓ Connection established');

        const parquetUrl = '/data/flood_control.parquet';
        console.log(`[DuckDB] 📦 Loading Parquet file: ${parquetUrl}`);
        
        const parquetResponse = await fetch(parquetUrl);
        if (!parquetResponse.ok) {
          throw new Error(`Failed to fetch Parquet file: ${parquetResponse.statusText}`);
        }

        const parquetBuffer = await parquetResponse.arrayBuffer();
        const fileSize = (parquetBuffer.byteLength / 1024 / 1024).toFixed(2);
        console.log(`[DuckDB] ✓ Parquet loaded: ${fileSize}MB`);

        await dbInstance.registerFileBuffer(
          'flood_control.parquet',
          new Uint8Array(parquetBuffer)
        );
        console.log('[DuckDB] ✓ File registered in virtual filesystem');

        await connInstance.query(`
          CREATE TABLE IF NOT EXISTS projects AS 
          SELECT * FROM read_parquet('flood_control.parquet')
        `);
        
        const countResult = await connInstance.query('SELECT COUNT(*) as count FROM projects');
        const rowCount = countResult.toArray()[0].count;
        console.log(`[DuckDB] ✓ Table created with ${rowCount} rows`);

        const totalTime = performance.now() - startTime;
        console.log(`[DuckDB] 🎉 Initialization complete! Total time: ${totalTime.toFixed(0)}ms`);

        if (mounted) {
          setState({
            db: dbInstance,
            connection: connInstance,
            loading: false,
            error: null,
            ready: true,
          });
        }

      } catch (error) {
        console.error('[DuckDB] ❌ Initialization failed:', error);
        if (mounted) {
          setState({
            db: null,
            connection: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            ready: false,
          });
        }
      }
    }

    initializeDuckDB();

    return () => {
      mounted = false;
      if (connInstance) {
        connInstance.close().catch(console.error);
        connectionRef.current = null;
      }
      if (dbInstance) {
        dbInstance.terminate().catch(console.error);
      }
    };
  }, []);

  const query = useCallback(async <T = any>(sql: string): Promise<QueryResult<T>> => {
    const conn = connectionRef.current;
    if (!conn) {
      throw new Error('DuckDB connection not ready');
    }

    const startTime = performance.now();
    console.log('[Query] 🔍 Executing:', sql.substring(0, 100) + '...');

    try {
      const result = await conn.query(sql);
      const data = result.toArray() as T[];
      const duration = performance.now() - startTime;

      console.log(`[Query] ✓ Completed in ${duration.toFixed(2)}ms (${data.length} rows)`);

      return {
        data,
        duration,
        rowCount: data.length,
      };
    } catch (error) {
      console.error('[Query] ❌ Query failed:', error);
      throw error;
    }
  }, []);

  return (
    <DuckDBContext.Provider
      value={{
        ...state,
        query,
      }}
    >
      {children}
    </DuckDBContext.Provider>
  );
}

export function useDuckDBContext() {
  const context = useContext(DuckDBContext);
  if (!context) {
    throw new Error('useDuckDBContext must be used within a DuckDBProvider');
  }
  return context;
}
