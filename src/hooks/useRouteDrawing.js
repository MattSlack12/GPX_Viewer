// src/hooks/useRouteDrawing.js
import { useRef, useState } from 'react';
import { fetchSnappedRouteLeg } from '../utils/gpxParser';

function compileTrackCoords(legs, waypoints) {
  if (!waypoints || waypoints.length === 0) return [];
  if (waypoints.length === 1) return [[waypoints[0].lng, waypoints[0].lat]];
  if (!legs || legs.length === 0) return waypoints.map((w) => [w.lng, w.lat]);

  const coords = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i] || [];
    if (i === 0) {
      coords.push(...leg);
    } else {
      coords.push(...leg.slice(1));
    }
  }
  return coords;
}

export default function useRouteDrawing() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [routingMode, setRoutingMode] = useState('foot');
  const [userWaypoints, setUserWaypoints] = useState([]);
  const [routeLegs, setRouteLegs] = useState([]);
  const [draftTrackCoords, setDraftTrackCoords] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const routingRequestRef = useRef(false);

  const pushUndo = (waypoints, legs) => {
    setUndoStack((prev) => [
      ...prev,
      {
        userWaypoints: waypoints.map((w) => ({ ...w })),
        routeLegs: legs.map((l) => [...l]),
      },
    ]);
  };

  const startDrawing = () => {
    setIsDrawing(true);
    setUserWaypoints([]);
    setRouteLegs([]);
    setDraftTrackCoords([]);
    setUndoStack([]);
  };

  const handleMapClick = async (latlng) => {
    if (routingRequestRef.current) return;

    if (userWaypoints.length === 0) {
      pushUndo([], []);
      const firstPoint = [[latlng.lng, latlng.lat]];
      setUserWaypoints([latlng]);
      setRouteLegs([]);
      setDraftTrackCoords(firstPoint);
      return;
    }

    const previousPoint = userWaypoints[userWaypoints.length - 1];
    routingRequestRef.current = true;
    setIsRoutingLoading(true);

    try {
      pushUndo(userWaypoints, routeLegs);
      const snappedLeg = await fetchSnappedRouteLeg(previousPoint, latlng, routingMode);
      const updatedWaypoints = [...userWaypoints, latlng];
      const updatedLegs = [...routeLegs, snappedLeg];
      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);

      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
    } catch (err) {
      console.error('Routing failed on map click:', err);
    } finally {
      routingRequestRef.current = false;
      setIsRoutingLoading(false);
    }
  };

  const handleMoveWaypoint = async (index, newLatLng) => {
    if (index < 0 || index >= userWaypoints.length) return;
    if (routingRequestRef.current) return;

    // If only 1 waypoint exists
    if (userWaypoints.length <= 1) {
      pushUndo(userWaypoints, routeLegs);
      setUserWaypoints([newLatLng]);
      setDraftTrackCoords([[newLatLng.lng, newLatLng.lat]]);
      return;
    }

    routingRequestRef.current = true;
    setIsRoutingLoading(true);

    try {
      pushUndo(userWaypoints, routeLegs);

      const legPromises = [];
      const hasPrev = index > 0;
      const hasNext = index < userWaypoints.length - 1;

      if (hasPrev) {
        legPromises.push(fetchSnappedRouteLeg(userWaypoints[index - 1], newLatLng, routingMode));
      }
      if (hasNext) {
        legPromises.push(fetchSnappedRouteLeg(newLatLng, userWaypoints[index + 1], routingMode));
      }

      const results = await Promise.all(legPromises);
      let resIdx = 0;
      const updatedLegs = [...routeLegs];

      if (hasPrev) {
        updatedLegs[index - 1] = results[resIdx++];
      }
      if (hasNext) {
        updatedLegs[index] = results[resIdx++];
      }

      const updatedWaypoints = [...userWaypoints];
      updatedWaypoints[index] = newLatLng;

      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);
      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
    } catch (err) {
      console.error('Failed to move waypoint:', err);
    } finally {
      routingRequestRef.current = false;
      setIsRoutingLoading(false);
    }
  };

  const handleInsertWaypoint = async (legIndex, latlng) => {
    if (legIndex < 0 || legIndex >= userWaypoints.length - 1) return;
    if (routingRequestRef.current) return;

    routingRequestRef.current = true;
    setIsRoutingLoading(true);

    try {
      pushUndo(userWaypoints, routeLegs);

      const [legA, legB] = await Promise.all([
        fetchSnappedRouteLeg(userWaypoints[legIndex], latlng, routingMode),
        fetchSnappedRouteLeg(latlng, userWaypoints[legIndex + 1], routingMode),
      ]);

      const updatedWaypoints = [...userWaypoints];
      updatedWaypoints.splice(legIndex + 1, 0, latlng);

      const updatedLegs = [...routeLegs];
      updatedLegs.splice(legIndex, 1, legA, legB);

      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);
      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
    } catch (err) {
      console.error('Failed to insert waypoint:', err);
    } finally {
      routingRequestRef.current = false;
      setIsRoutingLoading(false);
    }
  };

  const handleDeleteWaypoint = async (index) => {
    if (index < 0 || index >= userWaypoints.length) return;
    if (routingRequestRef.current) return;

    if (userWaypoints.length <= 1) {
      pushUndo(userWaypoints, routeLegs);
      setUserWaypoints([]);
      setRouteLegs([]);
      setDraftTrackCoords([]);
      return;
    }

    pushUndo(userWaypoints, routeLegs);

    if (index === 0) {
      const updatedWaypoints = userWaypoints.slice(1);
      const updatedLegs = routeLegs.slice(1);
      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);
      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
      return;
    }

    if (index === userWaypoints.length - 1) {
      const updatedWaypoints = userWaypoints.slice(0, -1);
      const updatedLegs = routeLegs.slice(0, -1);
      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);
      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
      return;
    }

    // Intermediate waypoint removed: connect previous to next
    routingRequestRef.current = true;
    setIsRoutingLoading(true);

    try {
      const newLeg = await fetchSnappedRouteLeg(
        userWaypoints[index - 1],
        userWaypoints[index + 1],
        routingMode
      );

      const updatedWaypoints = userWaypoints.filter((_, i) => i !== index);
      const updatedLegs = [...routeLegs];
      updatedLegs.splice(index - 1, 2, newLeg);

      const nextCoords = compileTrackCoords(updatedLegs, updatedWaypoints);
      setUserWaypoints(updatedWaypoints);
      setRouteLegs(updatedLegs);
      setDraftTrackCoords(nextCoords);
    } catch (err) {
      console.error('Failed to delete waypoint and re-route:', err);
    } finally {
      routingRequestRef.current = false;
      setIsRoutingLoading(false);
    }
  };

  const handleUndoPoint = () => {
    if (undoStack.length === 0) {
      if (userWaypoints.length <= 1) {
        setUserWaypoints([]);
        setRouteLegs([]);
        setDraftTrackCoords([]);
      }
      return;
    }

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setUserWaypoints(previousState.userWaypoints);
    setRouteLegs(previousState.routeLegs);
    setDraftTrackCoords(compileTrackCoords(previousState.routeLegs, previousState.userWaypoints));
  };

  const loadRouteForEditing = ({ userWaypoints: waypoints = [], routeLegs: legs = [], draftTrackCoords: coords = [] }) => {
    setIsDrawing(true);
    setUserWaypoints(waypoints);
    setRouteLegs(legs);
    setDraftTrackCoords(coords.length > 0 ? coords : compileTrackCoords(legs, waypoints));
    setUndoStack([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setUserWaypoints([]);
    setRouteLegs([]);
    setDraftTrackCoords([]);
    setUndoStack([]);
  };

  return {
    isDrawing,
    startDrawing,
    loadRouteForEditing,
    cancelDrawing,
    routingMode,
    setRoutingMode,
    userWaypoints,
    routeLegs,
    draftTrackCoords,
    isRoutingLoading,
    canUndo: undoStack.length > 0 || userWaypoints.length > 0,
    handleMapClick,
    handleMoveWaypoint,
    handleInsertWaypoint,
    handleDeleteWaypoint,
    handleUndoPoint,
  };
}
