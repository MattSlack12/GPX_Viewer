import { useRef, useState } from 'react';
import { fetchSnappedRouteLeg } from '../utils/gpxParser';

export default function useRouteDrawing() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [routingMode, setRoutingMode] = useState('foot');
  const [userWaypoints, setUserWaypoints] = useState([]);
  const [draftTrackCoords, setDraftTrackCoords] = useState([]);
  const [draftTrackSnapshots, setDraftTrackSnapshots] = useState([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const routingRequestRef = useRef(false);

  const startDrawing = () => {
    setIsDrawing(true);
    setUserWaypoints([]);
    setDraftTrackCoords([]);
    setDraftTrackSnapshots([]);
  };

  const handleMapClick = async (latlng) => {
    if (routingRequestRef.current) return;

    if (userWaypoints.length === 0) {
      const firstPoint = [[latlng.lng, latlng.lat]];
      setUserWaypoints([latlng]);
      setDraftTrackCoords(firstPoint);
      setDraftTrackSnapshots([firstPoint]);
      return;
    }

    const previousPoint = userWaypoints[userWaypoints.length - 1];
    routingRequestRef.current = true;
    setIsRoutingLoading(true);

    try {
      const snappedLeg = await fetchSnappedRouteLeg(previousPoint, latlng, routingMode);
      const nextCoords = [...draftTrackCoords, ...snappedLeg.slice(1)];
      setUserWaypoints((previous) => [...previous, latlng]);
      setDraftTrackCoords(nextCoords);
      setDraftTrackSnapshots((snapshots) => [...snapshots, nextCoords]);
    } finally {
      routingRequestRef.current = false;
      setIsRoutingLoading(false);
    }
  };

  const handleUndoPoint = () => {
    if (userWaypoints.length <= 1) {
      setUserWaypoints([]);
      setDraftTrackCoords([]);
      setDraftTrackSnapshots([]);
      return;
    }

    const updatedWaypoints = userWaypoints.slice(0, -1);
    const updatedSnapshots = draftTrackSnapshots.slice(0, -1);
    setUserWaypoints(updatedWaypoints);
    setDraftTrackSnapshots(updatedSnapshots);
    setDraftTrackCoords(updatedSnapshots[updatedSnapshots.length - 1] || []);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setUserWaypoints([]);
    setDraftTrackCoords([]);
    setDraftTrackSnapshots([]);
  };

  return {
    isDrawing,
    startDrawing,
    cancelDrawing,
    routingMode,
    setRoutingMode,
    userWaypoints,
    draftTrackCoords,
    isRoutingLoading,
    handleMapClick,
    handleUndoPoint,
  };
}
