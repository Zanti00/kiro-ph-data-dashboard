import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useDuckDB } from '../hooks/useDuckDB';
import { useFilters } from '../contexts/FilterContext';

interface ProjectPoint {
  ProjectID: string;
  ProjectDescription: string;
  Region: string;
  Province: string;
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

export function ProjectMap() {
  const { query, ready } = useDuckDB();
  const { filters, buildWhereClause, updateFilter } = useFilters();
  const [projects, setProjects] = useState<ProjectPoint[]>([]);
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
            ProjectDescription,
            Region,
            Province,
            Latitude,
            Longitude,
            ABC
          FROM projects
          ${whereClause}
          LIMIT 500
        `;

        const result = await query<ProjectPoint>(sql);
        const duration = performance.now() - startTime;

        setProjects(result.data);
        setQueryTime(duration);
      } catch (error) {
        console.error('[ProjectMap] Query failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPoints();
  }, [ready, filtersKey, buildWhereClause]);

  const handleRegionClick = (region: string) => {
    updateFilter('regions', [region]);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(val);
  };

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
          <h2 className="text-xl font-bold text-gray-800">Geographic Project Map</h2>
          <p className="text-xs text-gray-500 mt-1">
            Showing {projects.length.toLocaleString()} project locations • Circle size indicates Approved Budget (ABC)
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
          {projects.map((p) => (
            <CircleMarker
              key={p.ProjectID}
              center={[p.Latitude, p.Longitude]}
              radius={Math.min(Math.max((p.ABC || 0) / 40_000_000, 4), 14)}
              pathOptions={{
                color: '#0F766E',
                fillColor: '#2563EB',
                fillOpacity: 0.7,
                weight: 1,
              }}
            >
              <Popup>
                <div className="p-1 max-w-xs text-xs">
                  <p className="font-bold text-gray-900 mb-1">{p.ProjectDescription}</p>
                  <p className="text-gray-600">{p.Province}, {p.Region}</p>
                  <p className="text-blue-600 font-semibold mt-1">Budget: {formatCurrency(p.ABC)}</p>
                  <button
                    onClick={() => handleRegionClick(p.Region)}
                    className="mt-2 w-full px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Filter by Region ({p.Region})
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
