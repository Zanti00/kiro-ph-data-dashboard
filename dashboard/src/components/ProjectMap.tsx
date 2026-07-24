import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

interface RegionMetrics {
  region: string;
  total_budget: number;
  project_count: number;
}

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Complete mapping table between GeoJSON properties (shapeISO / shapeName) and DuckDB Region strings
const REGION_ALIAS_MAP: Record<string, string[]> = {
  'National Capital Region': ['ncr', 'ph-00', 'national capital'],
  'Cordillera Administrative Region': ['car', 'ph-15', 'cordillera'],
  'Region I': ['region i', 'ilocos', 'ph-01'],
  'Region II': ['region ii', 'cagayan valley', 'ph-02'],
  'Region III': ['region iii', 'central luzon', 'ph-03'],
  'Region IV-A': ['region iv-a', 'calabarzon', 'ph-40'],
  'Region IV-B': ['region iv-b', 'mimaropa', 'ph-41'],
  'Region V': ['region v', 'bicol', 'ph-05'],
  'Region VI': ['region vi', 'western visayas', 'ph-06'],
  'Region VII': ['region vii', 'central visayas', 'ph-07'],
  'Region VIII': ['region viii', 'eastern visayas', 'ph-08'],
  'Region IX': ['region ix', 'zamboanga', 'ph-09'],
  'Region X': ['region x', 'northern mindanao', 'ph-10'],
  'Region XI': ['region xi', 'davao', 'ph-11'],
  'Region XII': ['region xii', 'soccsksargen', 'ph-12'],
  'Region XIII': ['region xiii', 'caraga', 'ph-13'],
  'BARMM': ['barmm', 'armm', 'bangsamoro', 'ph-14'],
};

function resolveDuckDBRegion(featureProps: any): string | null {
  if (!featureProps) return null;
  const iso = String(featureProps.shapeISO || '').toLowerCase();
  const name = String(featureProps.shapeName || '').toLowerCase();

  for (const [duckKey, aliases] of Object.entries(REGION_ALIAS_MAP)) {
    for (const alias of aliases) {
      if (iso === alias || name === alias || name.includes(alias)) {
        return duckKey;
      }
    }
  }
  return null;
}

// Solid filled choropleth color scale
function getChoroplethColor(budget: number, maxBudget: number): string {
  if (!budget || budget <= 0) return '#E5E7EB'; // Neutral Gray for no budget
  const ratio = budget / (maxBudget || 1);

  if (ratio > 0.7) return '#991B1B';  // Dark Red (highest spend)
  if (ratio > 0.45) return '#DC2626'; // Solid Red
  if (ratio > 0.25) return '#EA580C'; // Solid Orange
  if (ratio > 0.12) return '#059669'; // Solid Emerald Green
  if (ratio > 0.05) return '#2563EB'; // Solid Royal Blue
  return '#60A5FA';                   // Solid Light Blue
}

export function ProjectMap() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause, updateFilter } = useFilters();
  const [geoData, setGeoData] = useState<any>(null);
  const [regionMetrics, setRegionMetrics] = useState<Record<string, RegionMetrics>>({});
  const [maxBudget, setMaxBudget] = useState(1);
  const [loading, setLoading] = useState(true);
  const [queryTime, setQueryTime] = useState(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Load Philippines region GeoJSON
  useEffect(() => {
    async function loadGeoJson() {
      try {
        const res = await fetch('/data/philippines-regions.geojson');
        if (res.ok) {
          const data = await res.json();
          setGeoData(data);
        }
      } catch (err) {
        console.error('[ProjectMap] GeoJSON load error:', err);
      }
    }
    loadGeoJson();
  }, []);

  // Fetch region spending aggregations from DuckDB
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
          WHERE Region IS NOT NULL
          GROUP BY Region
        `;

        const result = await query<any>(sql);
        const duration = performance.now() - startTime;

        const metricsMap: Record<string, RegionMetrics> = {};
        let highest = 1;

        result.data.forEach((row) => {
          const reg = String(row.region);
          const b = Number(row.total_budget) || 0;
          const c = Number(row.project_count) || 0;
          metricsMap[reg] = { region: reg, total_budget: b, project_count: c };
          if (b > highest) highest = b;
        });

        setRegionMetrics(metricsMap);
        setMaxBudget(highest);
        setQueryTime(duration);
      } catch (error) {
        console.error('[ProjectMap] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ready, filtersKey, buildWhereClause]);

  const getMetricsForFeature = (featureProps: any): RegionMetrics | null => {
    const duckRegion = resolveDuckDBRegion(featureProps);
    if (!duckRegion) return null;
    return regionMetrics[duckRegion] || null;
  };

  const styleFeature = (feature: any) => {
    const metrics = getMetricsForFeature(feature?.properties);
    const budget = metrics ? metrics.total_budget : 0;

    return {
      fillColor: getChoroplethColor(budget, maxBudget),
      weight: 1.5,
      opacity: 1,
      color: '#FFFFFF', // Crisp white borders
      fillOpacity: 0.8,  // Solid filled color
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const props = feature?.properties;
    const duckRegion = resolveDuckDBRegion(props);
    const displayName = props?.shapeName || duckRegion || 'Region';
    const metrics = getMetricsForFeature(props);

    const budgetText = metrics
      ? `₱${(metrics.total_budget / 1_000_000_000).toFixed(2)} Billion`
      : 'No Data';
    const projectText = metrics ? metrics.project_count.toLocaleString() : '0';

    layer.bindTooltip(
      `
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="font-weight: bold; font-size: 13px; color: #111827;">${displayName} ${duckRegion ? `(${duckRegion})` : ''}</div>
          <div style="color: #1E3A8A; font-size: 12px; font-weight: 600; margin-top: 2px;">Budget: ${budgetText}</div>
          <div style="color: #4B5563; font-size: 11px;">Projects: ${projectText}</div>
        </div>
      `,
      { sticky: true }
    );

    layer.on({
      mouseover: (e: any) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: '#1E3A8A',
          fillOpacity: 0.95,
        });
      },
      mouseout: (e: any) => {
        const l = e.target;
        l.setStyle(styleFeature(feature));
      },
      click: () => {
        if (metrics) {
          updateFilter('regions', [metrics.region]);
        } else if (duckRegion) {
          updateFilter('regions', [duckRegion]);
        }
      },
    });
  };

  if (loading || !geoData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Regional Budget Choropleth Map</h2>
          <p className="text-xs text-gray-500 mt-1">
            Regions colored by total budget allocation • Hover for details • Click any region to filter
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {queryTime.toFixed(2)}ms
        </span>
      </div>

      <div className="h-[450px] w-full rounded-lg overflow-hidden border border-gray-200 relative z-0">
        <MapContainer
          center={[12.8797, 121.774]}
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', backgroundColor: '#F3F4F6' }}
        >
          <MapInvalidator />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <GeoJSON
            key={filtersKey}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      </div>

      {/* Solid Choropleth Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-gray-600 px-2 gap-2">
        <span className="font-semibold text-gray-700">Budget Range Scale:</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#60A5FA' }}></span>
            &lt; ₱2B
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#2563EB' }}></span>
            ₱2B – ₱5B
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#059669' }}></span>
            ₱5B – ₱10B
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#EA580C' }}></span>
            ₱10B – ₱15B
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#DC2626' }}></span>
            ₱15B – ₱20B
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#991B1B' }}></span>
            &gt; ₱20B (High Capital)
          </span>
        </div>
      </div>
    </div>
  );
}
