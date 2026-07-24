/**
 * ============================================================================
 * WORKSHOP STEP 2: CLIENT-SIDE SQL AGGREGATION & DRILL-DOWNS
 * ============================================================================
 * 
 * Data Engineering Insight:
 * React Context + URL state persistence enables complex filter interactions
 * without backend state management, allowing infinite horizontal scaling on
 * Vercel's CDN while maintaining shareable URLs for collaborative analytics.
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface FilterState {
  regions: string[];
  provinces: string[];
  years: number[];
  typeOfWork: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

interface FilterContextType {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  buildWhereClause: () => string;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: FilterState = {
  regions: [],
  provinces: [],
  years: [],
  typeOfWork: [],
  dateRange: {
    start: null,
    end: null,
  },
};

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use ref to store current filters for buildWhereClause without triggering re-renders
  const filtersRef = useRef(filters);
  
  // Update ref when filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Parse URL on mount (only once)
  useEffect(() => {
    console.log('[FilterContext] 🔵 Initializing from URL');
    const params = new URLSearchParams(window.location.search);
    
    // Only set filters if they're actually different from defaults
    const hasUrlFilters = params.toString().length > 0;
    
    if (hasUrlFilters) {
      const urlFilters: FilterState = {
        regions: params.get('regions')?.split(',').filter(Boolean) || [],
        provinces: params.get('provinces')?.split(',').filter(Boolean) || [],
        years: params.get('years')?.split(',').map(Number).filter(Boolean) || [],
        typeOfWork: params.get('typeOfWork')?.split(',').filter(Boolean) || [],
        dateRange: {
          start: params.get('dateStart') || null,
          end: params.get('dateEnd') || null,
        },
      };
      console.log('[FilterContext] 📥 Loaded filters from URL:', urlFilters);
      setFilters(urlFilters);
    } else {
      console.log('[FilterContext] 📥 No URL filters, using defaults');
    }
    
    setIsInitialized(true);
    console.log('[FilterContext] ✅ Initialization complete');
  }, []); // Only run once on mount

  // Update URL when filters change (but not on initial load)
  useEffect(() => {
    if (!isInitialized) {
      console.log('[FilterContext] ⏸️  Skipping URL update (not initialized)');
      return; // Skip URL update on initial mount
    }

    console.log('[FilterContext] 🔄 Filters changed, updating URL:', filters);

    const params = new URLSearchParams();
    
    if (filters.regions.length > 0) {
      params.set('regions', filters.regions.join(','));
    }
    if (filters.provinces.length > 0) {
      params.set('provinces', filters.provinces.join(','));
    }
    if (filters.years.length > 0) {
      params.set('years', filters.years.join(','));
    }
    if (filters.typeOfWork.length > 0) {
      params.set('typeOfWork', filters.typeOfWork.join(','));
    }
    if (filters.dateRange.start) {
      params.set('dateStart', filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      params.set('dateEnd', filters.dateRange.end);
    }

    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [filters, isInitialized]);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Build SQL WHERE clause from current filters
   * 
   * Logic: OR within category, AND across categories
   * Example: (Region='NCR' OR Region='Region I') AND InfraYear IN (2023, 2024)
   * 
   * Uses filtersRef to avoid re-creating function on every filter change
   */
  const buildWhereClause = useCallback((): string => {
    const currentFilters = filtersRef.current;
    const conditions: string[] = [];

    // Region filter
    if (currentFilters.regions.length > 0) {
      const regionList = currentFilters.regions.map(r => `'${r.replace(/'/g, "''")}'`).join(', ');
      conditions.push(`Region IN (${regionList})`);
    }

    // Province filter
    if (currentFilters.provinces.length > 0) {
      const provinceList = currentFilters.provinces.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
      conditions.push(`Province IN (${provinceList})`);
    }

    // Year filter
    if (currentFilters.years.length > 0) {
      conditions.push(`InfraYear IN (${currentFilters.years.join(', ')})`);
    }

    // Type of Work filter
    if (currentFilters.typeOfWork.length > 0) {
      const typeList = currentFilters.typeOfWork.map(t => `'${t.replace(/'/g, "''")}'`).join(', ');
      conditions.push(`TypeofWork IN (${typeList})`);
    }

    // Date range filter
    if (currentFilters.dateRange.start || currentFilters.dateRange.end) {
      if (currentFilters.dateRange.start && currentFilters.dateRange.end) {
        conditions.push(
          `CompletionDateActual BETWEEN '${currentFilters.dateRange.start}' AND '${currentFilters.dateRange.end}'`
        );
      } else if (currentFilters.dateRange.start) {
        conditions.push(`CompletionDateActual >= '${currentFilters.dateRange.start}'`);
      } else if (currentFilters.dateRange.end) {
        conditions.push(`CompletionDateActual <= '${currentFilters.dateRange.end}'`);
      }
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }, []); // Empty deps - function never recreated

  return (
    <FilterContext.Provider
      value={{
        filters,
        setFilters,
        updateFilter,
        clearFilters,
        buildWhereClause,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}
