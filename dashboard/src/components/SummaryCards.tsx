import { useEffect, useState, useMemo } from 'react';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

interface SummaryMetrics {
  totalProjects: number;
  totalABC: number;
  totalContractCost: number;
  budgetVariance: number;
}

export function SummaryCards() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause } = useFilters();
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryTime, setQueryTime] = useState(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!ready) return;

    async function fetchMetrics() {
      setLoading(true);
      const startTime = performance.now();

      try {
        const whereClause = buildWhereClause();
        
        const sql = `
          WITH summary AS (
            SELECT
              CAST(COUNT(*) AS DOUBLE) as total_projects,
              CAST(SUM(ABC) AS DOUBLE) as total_abc,
              CAST(SUM(ContractCost) AS DOUBLE) as total_contract_cost
            FROM projects
            ${whereClause}
          )
          SELECT
            total_projects,
            total_abc,
            total_contract_cost,
            CASE 
              WHEN total_abc > 0 
              THEN ((total_abc - total_contract_cost) / total_abc * 100)
              ELSE 0 
            END as budget_variance
          FROM summary
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;
        setQueryTime(duration);

        if (result.data.length > 0) {
          const row = result.data[0];
          setMetrics({
            totalProjects: Number(row.total_projects),
            totalABC: Number(row.total_abc),
            totalContractCost: Number(row.total_contract_cost),
            budgetVariance: Number(row.budget_variance),
          });
        }

      } catch (error) {
        console.error('[SummaryCards] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [ready, filtersKey, buildWhereClause]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Projects',
      value: formatNumber(metrics.totalProjects),
      color: 'text-blue-600',
    },
    {
      title: 'Approved Budget (ABC)',
      value: formatCurrency(metrics.totalABC),
      color: 'text-green-600',
    },
    {
      title: 'Contract Cost',
      value: formatCurrency(metrics.totalContractCost),
      color: 'text-purple-600',
    },
    {
      title: 'Budget Variance',
      value: `${metrics.budgetVariance.toFixed(2)}%`,
      color: metrics.budgetVariance >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 text-right mb-4">
        Query time: {queryTime.toFixed(2)}ms
      </div>
    </>
  );
}
