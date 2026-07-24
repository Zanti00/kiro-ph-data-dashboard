import { useEffect, useState, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { registerChartJS } from '../utils/chartRegistry';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

registerChartJS();

interface StatusData {
  status: string;
  count: number;
}

export function CompletionStatusChart() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause } = useFilters();
  const [data, setData] = useState<StatusData[]>([]);
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
            CASE
              WHEN CompletionDateActual IS NOT NULL THEN 'Completed'
              WHEN CompletionDateOriginal <= '2024-12-31' THEN 'Overdue'
              ELSE 'Ongoing'
            END as status,
            CAST(COUNT(*) AS DOUBLE) as count
          FROM projects
          ${whereClause}
          GROUP BY status
          ORDER BY count DESC
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;

        const sanitized = result.data.map((row) => ({
          status: String(row.status),
          count: Number(row.count),
        }));

        setData(sanitized);
        setQueryTime(duration);
      } catch (error) {
        console.error('[CompletionStatus] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ready, filtersKey, buildWhereClause]);

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

  const totalProjects = data.reduce((acc, curr) => acc + Number(curr.count), 0);

  const colorMap: Record<string, string> = {
    Completed: '#0F766E',
    Ongoing: '#2563EB',
    Overdue: '#DC2626',
  };

  const chartData = {
    labels: data.map((d) => d.status),
    datasets: [
      {
        data: data.map((d) => Number(d.count)),
        backgroundColor: data.map((d) => colorMap[d.status] || '#9CA3AF'),
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Project Completion Status',
        font: { size: 15, weight: 'bold' },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const count = Number(context.parsed);
            const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1) : '0';
            return `${context.label}: ${count.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">🍩 Completion Status</h3>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms {queryTime < 100 && '⚡'}
        </span>
      </div>
      <div className="relative" style={{ height: '320px' }}>
        <Doughnut key={filtersKey} data={chartData} options={options} redraw={true} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
          <span className="text-2xl font-bold text-gray-800">{totalProjects.toLocaleString()}</span>
          <span className="text-xs text-gray-500 font-medium">Total Projects</span>
        </div>
      </div>
    </div>
  );
}
