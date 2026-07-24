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

  useEffect(() => {
    if (!ready) return;

    async function fetchOptions() {
      try {
        const [regionsResult, yearsResult, typesResult] = await Promise.all([
          query<{ region: string }>('SELECT DISTINCT Region as region FROM projects WHERE Region IS NOT NULL ORDER BY region'),
          query<{ year: number }>('SELECT DISTINCT InfraYear as year FROM projects WHERE InfraYear IS NOT NULL ORDER BY year DESC'),
          query<{ type: string }>('SELECT DISTINCT TypeofWork as type FROM projects WHERE TypeofWork IS NOT NULL ORDER BY type'),
        ]);

        setOptions({
          regions: regionsResult.data.map(r => String(r.region)),
          years: yearsResult.data.map(y => Number(y.year)),
          typeOfWork: typesResult.data.map(t => String(t.type)),
        });

      } catch (error) {
        console.error('[FilterToolbar] Failed to load options:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOptions();
  }, [ready]);

  const handleRegionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    if (!filters.regions.includes(val)) {
      updateFilter('regions', [...filters.regions, val]);
    }
    e.target.value = '';
  };

  const handleYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const num = Number(val);
    if (!filters.years.includes(num)) {
      updateFilter('years', [...filters.years, num]);
    }
    e.target.value = '';
  };

  const handleTypeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    if (!filters.typeOfWork.includes(val)) {
      updateFilter('typeOfWork', [...filters.typeOfWork, val]);
    }
    e.target.value = '';
  };

  const removeRegion = (region: string) => {
    updateFilter('regions', filters.regions.filter(r => r !== region));
  };

  const removeYear = (year: number) => {
    updateFilter('years', filters.years.filter(y => y !== year));
  };

  const removeType = (type: string) => {
    updateFilter('typeOfWork', filters.typeOfWork.filter(t => t !== type));
  };

  const hasActiveFilters = 
    filters.regions.length > 0 ||
    filters.years.length > 0 ||
    filters.typeOfWork.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Dashboard Controls</h2>
          <p className="text-xs text-gray-500">Filter projects by region, year, or type of infrastructure work</p>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="self-start md:self-auto px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md border border-red-200 transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Dropdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Region Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Region {filters.regions.length > 0 && `(${filters.regions.length})`}
          </label>
          <select
            onChange={handleRegionSelect}
            defaultValue=""
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 cursor-pointer"
          >
            <option value="" disabled>Select Region...</option>
            {options.regions.map(r => (
              <option key={r} value={r} disabled={filters.regions.includes(r)}>
                {r} {filters.regions.includes(r) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Year Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Infrastructure Year {filters.years.length > 0 && `(${filters.years.length})`}
          </label>
          <select
            onChange={handleYearSelect}
            defaultValue=""
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 cursor-pointer"
          >
            <option value="" disabled>Select Year...</option>
            {options.years.map(y => (
              <option key={y} value={y} disabled={filters.years.includes(y)}>
                {y} {filters.years.includes(y) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Type of Work Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Type of Work {filters.typeOfWork.length > 0 && `(${filters.typeOfWork.length})`}
          </label>
          <select
            onChange={handleTypeSelect}
            defaultValue=""
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 cursor-pointer"
          >
            <option value="" disabled>Select Type of Work...</option>
            {options.typeOfWork.map(t => (
              <option key={t} value={t} disabled={filters.typeOfWork.includes(t)}>
                {t} {filters.typeOfWork.includes(t) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 mr-1">Active:</span>

          {filters.regions.map(r => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              Region: {r}
              <button
                onClick={() => removeRegion(r)}
                className="hover:text-blue-900 font-bold ml-0.5"
                title="Remove filter"
              >
                &times;
              </button>
            </span>
          ))}

          {filters.years.map(y => (
            <span
              key={y}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200"
            >
              Year: {y}
              <button
                onClick={() => removeYear(y)}
                className="hover:text-teal-900 font-bold ml-0.5"
                title="Remove filter"
              >
                &times;
              </button>
            </span>
          ))}

          {filters.typeOfWork.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
            >
              Work: {t}
              <button
                onClick={() => removeType(t)}
                className="hover:text-purple-900 font-bold ml-0.5"
                title="Remove filter"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
