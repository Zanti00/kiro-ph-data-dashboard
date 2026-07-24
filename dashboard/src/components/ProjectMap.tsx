import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

interface ProjectPoint {
  ProjectID: string;
  Latitude: number;
  Longitude: number;
  ABC: number;
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

interface HeatmapLayerProps {
  points: Array<[number, number, number]>;
}

function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    const heatLayer = (L as any).heatLayer(points, {
      radius: 28,
      blur: 18,
      maxZoom: 10,
      max: 1.0,
      gradient: {
        0.2: '#3B82F6', // Blue
        0.4: '#10B981', // Emerald Green
        0.6: '#F59E0B', // Amber
        0.8: '#EF4444', // Red
        1.0: '#991B1B', // Dark Red (Peak budget density)
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export function ProjectMap() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause } = useFilters();
  const [points, setPoints] = useState<Array<[number, number, number]>>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queryTime, setQueryTime] = useState(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    if (!ready) return;

    async function fetchPoints() {
      setLoading(true);
      const startTime = performance.now();

      try {
        const baseWhere = buildWhereClause();
        const geoFilter = `Latitude IS NOT NULL AND Longitude IS NOT NULL AND Latitude BETWEEN 4.0 AND 21.0 AND Longitude BETWEEN 116.0 AND 127.0`;
        const whereClause = baseWhere ? `${baseWhere} AND ${geoFilter}` : `WHERE ${geoFilter}`;

        const sql = `
          SELECT 
            ProjectID,
            CAST(Latitude AS DOUBLE) as Latitude,
            CAST(Longitude AS DOUBLE) as Longitude,
            CAST(ABC AS DOUBLE) as ABC
          FROM projects
          ${whereClause}
          LIMIT 2000
        `;

        const result = await query<ProjectPoint>(sql);
        const duration = performance.now() - startTime;

        if (result.data.length > 0) {
          const maxABC = Math.max(...result.data.map(p => Number(p.ABC) || 1));
          
          const heatPoints: Array<[number, number, number]> = result.data.map(p => {
            const lat = Number(p.Latitude);
            const lng = Number(p.Longitude);
            const abc = Number(p.ABC) || 0;
            // Normalize weight between 0.2 and 1.0 based on budget magnitude
            const weight = Math.min(Math.max(abc / maxABC, 0.2), 1.0);
            return [lat, lng, weight];
          });

          setPoints(heatPoints);
          setCount(result.data.length);
        } else {
          setPoints([]);
          setCount(0);
        }

        setQueryTime(duration);
      } catch (error) {
        console.error('[ProjectMap] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPoints();
  }, [ready, filtersKey, buildWhereClause]);

  if (loading) {
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
          <h2 className="text-xl font-bold text-gray-800">Geographic Budget Heatmap</h2>
          <p className="text-xs text-gray-500 mt-1">
            Displaying budget density gradient across {count.toLocaleString()} project locations (Blue = Low, Green/Yellow = Medium, Red = High Spend Concentration)
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
          style={{ height: '100%', width: '100%' }}
        >
          <MapInvalidator />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <HeatmapLayer key={filtersKey} points={points} />
        </MapContainer>
      </div>

      {/* Heatmap Legend */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-600 px-2">
        <span className="font-semibold">Spend Intensity:</span>
        <div className="flex items-center gap-2">
          <span>Low</span>
          <div className="h-3 w-32 rounded bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-500 to-red-600"></div>
          <span>High Capital Density</span>
        </div>
      </div>
    </div>
  );
}
