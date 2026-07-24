import { useEffect, useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { registerChartJS } from '../utils/chartRegistry';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

registerChartJS();

interface RegionData {
  region: string;
  total_budget: number;
  project_count: number;
}

export function BudgetByRegionChart() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause, updateFilter } = useFilters();
  const [data, setData] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryTime, setQueryTime] = useState(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!ready) return;

    async function fetchData() {
      setLoading(true);
      const startTime = performance.now();

      try {
        const whereClause = buildWhereClause();
        const sql = `
          SELECT
            Region as region,
            CAST(SUM(ABC) AS DOUBLE) as total_budget,
            CAST(COUNT(*) AS DOUBLE) as project_count
          FROM projects
          ${whereClause}
          GROUP BY Region
          ORDER BY total_budget DESC
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;
        
        const sanitized = result.data.map((row) => ({
          region: String(row.region),
          total_budget: Number(row.total_budget),
          project_count: Number(row.project_count),
        }));

        setData(sanitized);
        setQueryTime(duration);
      } catch (error) {
        console.error('[BudgetByRegion] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ready, filtersKey, buildWhereClause]);

  const handleChartClick = (regionName: string) => {
    updateFilter('regions', [regionName]);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.region),
    datasets: [
      {
        label: 'Total Budget (ABC)',
        data: data.map((d) => Number(d.total_budget) / 1_000_000_000),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(59, 130, 246, 1)',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const regionName = data[index].region;
        handleChartClick(regionName);
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Budget by Region (Billions PHP)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const regionData = data[context.dataIndex];
            const val = Number(context.parsed.x ?? 0);
            return [
              `Budget: ₱${val.toFixed(2)}B`,
              `Projects: ${Number(regionData.project_count).toLocaleString()}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Budget (Billions PHP)',
        },
        ticks: {
          callback: (value) => `₱${value}B`,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Region',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Budget Distribution by Region</h2>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms
        </span>
      </div>
      <div style={{ height: '500px' }}>
        <Bar key={filtersKey} data={chartData} options={options} redraw={true} />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Click any bar to filter dashboard to that region
      </p>
    </div>
  );
}
