import { useMemo, useState } from 'react';
import { distanceToKm, DISTANCE_UNITS } from '../utils/units';

export default function useRouteFilters(routes, distanceUnit = DISTANCE_UNITS.KM) {
  const [filters, setFilters] = useState({
    keyword: '',
    minDistance: '',
    maxDistance: '',
    region: 'all',
  });

  const availableRegions = useMemo(() => {
    const regions = new Set();
    routes.forEach((route) => {
      if (route.region) regions.add(route.region);
    });
    return Array.from(regions).sort();
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const term = filters.keyword.trim().toLowerCase();
      if (term && !route.title.toLowerCase().includes(term) && !route.fileName.toLowerCase().includes(term)) {
        return false;
      }

      const minDistance = Number.parseFloat(filters.minDistance);
      const maxDistance = Number.parseFloat(filters.maxDistance);
      const minKm = !Number.isNaN(minDistance) ? distanceToKm(minDistance, distanceUnit) : null;
      const maxKm = !Number.isNaN(maxDistance) ? distanceToKm(maxDistance, distanceUnit) : null;

      if (minKm !== null && route.distanceKm < minKm) return false;
      if (maxKm !== null && route.distanceKm > maxKm) return false;
      if (filters.region !== 'all' && route.region !== filters.region) return false;
      return true;
    });
  }, [routes, filters, distanceUnit]);

  return { filters, setFilters, availableRegions, filteredRoutes };
}
