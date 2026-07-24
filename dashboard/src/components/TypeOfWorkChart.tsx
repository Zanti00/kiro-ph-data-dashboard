import { useEffect, useState, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { registerChartJS } from '../utils/chartRegistry';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

registerChartJS();

interface WorkTypeData {
  typeOfWork: string;
  count: number;
  total_budget: number;
}

export function TypeOfWorkChart() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause, updateFilter } = useFilters();
  const [data, setData] = useState<WorkTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryTime, setQueryTime] = useState(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!ready) return;

    async function fetchData() {
      setLoading(true);
      const startTime = performance.now();

      try {
        const baseWhere = buildWhereClause();
        const typeFilter = `TypeofWork IS NOT NULL AND TypeofWork != ''`;
        const whereClause = baseWhere ? `${baseWhere} AND ${typeFilter}` : `WHERE ${typeFilter}`;

        const sql = `
          SELECT
            TypeofWork as typeOfWork,
            CAST(COUNT(*) AS DOUBLE) as count,
            CAST(SUM(ABC) AS DOUBLE) as total_budget
          FROM projects
          ${whereClause}
          GROUP BY TypeofWork
          ORDER BY count DESC
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;

        const sanitized = result.data.map((row) => ({
          typeOfWork: String(row.typeOfWork),
          count: Number(row.count),
          total_budget: Number(row.total_budget),
        }));

        setData(sanitized);
        setQueryTime(duration);
      } catch (error) {
        console.error('[TypeOfWork] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ready, filtersKey, buildWhereClause]);

  const handleSliceClick = (type: string) => {
    updateFilter('typeOfWork', [type]);
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

  const palette = ['#1E3A8A', '#0F766E', '#2563EB', '#D97706', '#9333EA', '#059669', '#E11D48', '#4F46E5', '#65A30D'];

  const chartData = {
    labels: data.map((d) => d.typeOfWork),
    datasets: [
      {
        data: data.map((d) => Number(d.count)),
        backgroundColor: data.map((_, i) => palette[i % palette.length]),
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const typeName = data[index].typeOfWork;
        handleSliceClick(typeName);
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          font: { size: 10 },
        },
      },
      title: {
        display: true,
        text: 'Projects by Type of Infrastructure Work',
        font: { size: 14, weight: 'bold' },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const idx = context.dataIndex;
            const item = data[idx];
            const count = Number(item.count);
            const budgetB = (Number(item.total_budget) / 1_000_000_000).toFixed(2);
            return [`Projects: ${count.toLocaleString()}`, `Budget: ₱${budgetB}B`];
          },
        },
      },
    },
    cutout: '60%',
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Type of Work Distribution</h3>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms
        </span>
      </div>
      <div style={{ height: '320px' }}>
        <Doughnut key={filtersKey} data={chartData} options={options} redraw={true} />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Click any slice to filter by work type
      </p>
    </div>
  );
}
