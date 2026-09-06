import { useMemo, useState } from 'react';

export default function useRouteFilters(routes) {
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
      if (!Number.isNaN(minDistance) && route.distanceKm < minDistance) return false;
      if (!Number.isNaN(maxDistance) && route.distanceKm > maxDistance) return false;
      if (filters.region !== 'all' && route.region !== filters.region) return false;
      return true;
    });
  }, [routes, filters]);

  return { filters, setFilters, availableRegions, filteredRoutes };
}
