/**
 * ============================================================================
 * WORKSHOP STEP 2: CLIENT-SIDE SQL DRILL-DOWNS - Filter UI
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

interface FilterOptions {
  regions: string[];
  years: number[];
  typeOfWork: string[];
}

export function FilterToolbar() {
  const { query, ready } = useDuckDB();
  const { filters, updateFilter, clearFilters } = useFilters();
  const [options, setOptions] = useState<FilterOptions>({
    regions: [],
    years: [],
    typeOfWork: [],
  });
  const [loading, setLoading] = useState(true);

  // Load available filter options
  useEffect(() => {
    if (!ready) return;

    async function fetchOptions() {
      try {
        // Fetch distinct values for each filter dimension
        const [regionsResult, yearsResult, typesResult] = await Promise.all([
          query<{ region: string }>('SELECT DISTINCT Region as region FROM projects ORDER BY region'),
          query<{ year: number }>('SELECT DISTINCT InfraYear as year FROM projects ORDER BY year'),
          query<{ type: string }>('SELECT DISTINCT TypeofWork as type FROM projects ORDER BY type'),
        ]);

        setOptions({
          regions: regionsResult.data.map(r => r.region),
          years: yearsResult.data.map(y => y.year),
          typeOfWork: typesResult.data.map(t => t.type),
        });

      } catch (error) {
        console.error('[FilterToolbar] Failed to load options:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOptions();
  }, [ready]); // query is memoized in DuckDBContext

  const handleRegionToggle = (region: string) => {
    const newRegions = filters.regions.includes(region)
      ? filters.regions.filter(r => r !== region)
      : [...filters.regions, region];
    updateFilter('regions', newRegions);
  };

  const handleYearToggle = (year: number) => {
    const newYears = filters.years.includes(year)
      ? filters.years.filter(y => y !== year)
      : [...filters.years, year];
    updateFilter('years', newYears);
  };

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.typeOfWork.includes(type)
      ? filters.typeOfWork.filter(t => t !== type)
      : [...filters.typeOfWork, type];
    updateFilter('typeOfWork', newTypes);
  };

  const hasActiveFilters = 
    filters.regions.length > 0 ||
    filters.years.length > 0 ||
    filters.typeOfWork.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Region Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Region ({filters.regions.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {options.regions.map(region => (
              <button
                key={region}
                onClick={() => handleRegionToggle(region)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filters.regions.includes(region)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Infrastructure Year ({filters.years.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {options.years.map(year => (
              <button
                key={year}
                onClick={() => handleYearToggle(year)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filters.years.includes(year)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Type of Work Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type of Work ({filters.typeOfWork.length} selected)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {options.typeOfWork.map(type => (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                className={`px-3 py-2 text-xs text-left rounded-md transition-colors truncate ${
                  filters.typeOfWork.includes(type)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={type}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
