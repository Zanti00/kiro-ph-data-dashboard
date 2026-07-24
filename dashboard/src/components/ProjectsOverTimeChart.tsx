import { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { registerChartJS } from '../utils/chartRegistry';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

registerChartJS();

interface YearData {
  year: number;
  project_count: number;
  total_budget: number;
}

export function ProjectsOverTimeChart() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause, updateFilter } = useFilters();
  const [data, setData] = useState<YearData[]>([]);
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
            CAST(InfraYear AS INT) as year,
            CAST(COUNT(*) AS DOUBLE) as project_count,
            CAST(SUM(ABC) AS DOUBLE) as total_budget
          FROM projects
          ${whereClause}
          WHERE InfraYear IS NOT NULL AND InfraYear > 2000
          GROUP BY InfraYear
          ORDER BY InfraYear ASC
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;

        const sanitized = result.data.map((row) => ({
          year: Number(row.year),
          project_count: Number(row.project_count),
          total_budget: Number(row.total_budget),
        }));

        setData(sanitized);
        setQueryTime(duration);
      } catch (error) {
        console.error('[ProjectsOverTime] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ready, filtersKey, buildWhereClause]);

  const handleYearClick = (year: number) => {
    updateFilter('years', [year]);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map((d) => d.year.toString()),
    datasets: [
      {
        label: 'Project Count',
        data: data.map((d) => Number(d.project_count)),
        borderColor: 'rgba(37, 99, 235, 1)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'yCount',
      },
      {
        label: 'Budget (Billions PHP)',
        data: data.map((d) => Number(d.total_budget) / 1_000_000_000),
        borderColor: 'rgba(15, 118, 110, 1)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
        yAxisID: 'yBudget',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const year = data[index].year;
        handleYearClick(year);
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Project Count & Budget Trend Over Time',
        font: { size: 15, weight: 'bold' },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = Number(context.parsed.y ?? 0);
            if (context.datasetIndex === 0) {
              return `Projects: ${val.toLocaleString()}`;
            }
            return `Budget: ₱${val.toFixed(2)}B`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Infrastructure Year' },
      },
      yCount: {
        type: 'linear' as const,
        position: 'left' as const,
        title: { display: true, text: 'Project Count' },
        beginAtZero: true,
      },
      yBudget: {
        type: 'linear' as const,
        position: 'right' as const,
        title: { display: true, text: 'Budget (Billions PHP)' },
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value) => `₱${value}B`,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Projects & Budget Over Time</h3>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms
        </span>
      </div>
      <div style={{ height: '320px' }}>
        <Line key={filtersKey} data={chartData} options={options} redraw={true} />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Click any data point to filter by that year
      </p>
    </div>
  );
}
