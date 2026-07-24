import { useEffect, useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { registerChartJS } from '../utils/chartRegistry';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

registerChartJS();

interface ContractorData {
  contractor: string;
  abc: number;
  cost: number;
  project_count: number;
}

export function TopContractorsChart() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause } = useFilters();
  const [data, setData] = useState<ContractorData[]>([]);
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
        const contractorFilter = `Contractor IS NOT NULL AND Contractor != '' AND Contractor != 'N/A'`;
        const whereClause = baseWhere ? `${baseWhere} AND ${contractorFilter}` : `WHERE ${contractorFilter}`;

        const sql = `
          SELECT
            Contractor as contractor,
            CAST(SUM(ABC) AS DOUBLE) as abc,
            CAST(SUM(ContractCost) AS DOUBLE) as cost,
            CAST(COUNT(*) AS DOUBLE) as project_count
          FROM projects
          ${whereClause}
          GROUP BY Contractor
          ORDER BY cost DESC
          LIMIT 10
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;

        const sanitized = result.data.map((row) => ({
          contractor: String(row.contractor),
          abc: Number(row.abc),
          cost: Number(row.cost),
          project_count: Number(row.project_count),
        }));

        setData(sanitized);
        setQueryTime(duration);
      } catch (error) {
        console.error('[TopContractors] Query failed:', error);
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

  const chartData = {
    labels: data.map((d) => (d.contractor.length > 20 ? `${d.contractor.substring(0, 18)}...` : d.contractor)),
    datasets: [
      {
        label: 'Approved Budget (ABC)',
        data: data.map((d) => Number(d.abc) / 1_000_000),
        backgroundColor: 'rgba(30, 58, 138, 0.85)',
      },
      {
        label: 'Contract Cost',
        data: data.map((d) => Number(d.cost) / 1_000_000),
        backgroundColor: 'rgba(15, 118, 110, 0.85)',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Top 10 Contractors: Budget (ABC) vs. Contract Cost (Millions PHP)',
        font: { size: 14, weight: 'bold' },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            if (items.length > 0) {
              const idx = items[0].dataIndex;
              return data[idx].contractor;
            }
            return '';
          },
          label: (context) => {
            const val = Number(context.parsed.y ?? 0);
            return `${context.dataset.label}: ₱${val.toFixed(1)}M`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 25,
        },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Millions PHP' },
        ticks: {
          callback: (value) => `₱${value}M`,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">🏗️ Top 10 Contractors</h3>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms {queryTime < 100 && '⚡'}
        </span>
      </div>
      <div style={{ height: '320px' }}>
        <Bar key={filtersKey} data={chartData} options={options} redraw={true} />
      </div>
    </div>
  );
}
