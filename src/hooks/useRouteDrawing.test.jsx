// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import useRouteDrawing from './useRouteDrawing';
import * as gpxParser from '../utils/gpxParser';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderCustomHook(hookFn) {
  const result = { current: null };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    result,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('useRouteDrawing hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values', () => {
    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    expect(result.current.isDrawing).toBe(false);
    expect(result.current.routingMode).toBe('foot');
    expect(result.current.userWaypoints).toEqual([]);
    expect(result.current.routeLegs).toEqual([]);
    expect(result.current.draftTrackCoords).toEqual([]);
    expect(result.current.canUndo).toBe(false);

    unmount();
  });

  it('starts drawing and adds points on map click', async () => {
    vi.spyOn(gpxParser, 'fetchSnappedRouteLeg').mockResolvedValue([
      [-2.1, 54.1],
      [-2.15, 54.15],
      [-2.2, 54.2],
    ]);

    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    act(() => {
      result.current.startDrawing();
    });
    expect(result.current.isDrawing).toBe(true);

    // 1st click (start)
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.1, lng: -2.1 });
    });
    expect(result.current.userWaypoints).toHaveLength(1);
    expect(result.current.draftTrackCoords).toEqual([[-2.1, 54.1]]);

    // 2nd click
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.2, lng: -2.2 });
    });
    expect(result.current.userWaypoints).toHaveLength(2);
    expect(result.current.routeLegs).toHaveLength(1);
    expect(result.current.draftTrackCoords).toEqual([
      [-2.1, 54.1],
      [-2.15, 54.15],
      [-2.2, 54.2],
    ]);

    unmount();
  });

  it('moves an existing waypoint and re-routes adjacent legs', async () => {
    vi.spyOn(gpxParser, 'fetchSnappedRouteLeg').mockImplementation(async (from, to) => [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);

    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    act(() => {
      result.current.startDrawing();
    });

    await act(async () => {
      await result.current.handleMapClick({ lat: 54.0, lng: -2.0 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.2, lng: -2.2 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.4, lng: -2.4 });
    });

    expect(result.current.userWaypoints).toHaveLength(3);
    expect(result.current.routeLegs).toHaveLength(2);

    // Move waypoint 1 (middle point)
    await act(async () => {
      await result.current.handleMoveWaypoint(1, { lat: 54.25, lng: -2.15 });
    });

    expect(result.current.userWaypoints[1]).toEqual({ lat: 54.25, lng: -2.15 });
    expect(result.current.routeLegs).toHaveLength(2);
    expect(result.current.routeLegs[0]).toEqual([
      [-2.0, 54.0],
      [-2.15, 54.25],
    ]);
    expect(result.current.routeLegs[1]).toEqual([
      [-2.15, 54.25],
      [-2.4, 54.4],
    ]);

    unmount();
  });

  it('inserts a waypoint at midpoint and splits leg', async () => {
    vi.spyOn(gpxParser, 'fetchSnappedRouteLeg').mockImplementation(async (from, to) => [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);

    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    act(() => {
      result.current.startDrawing();
    });

    await act(async () => {
      await result.current.handleMapClick({ lat: 54.0, lng: -2.0 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.4, lng: -2.4 });
    });

    expect(result.current.userWaypoints).toHaveLength(2);
    expect(result.current.routeLegs).toHaveLength(1);

    // Insert waypoint on leg 0
    await act(async () => {
      await result.current.handleInsertWaypoint(0, { lat: 54.2, lng: -2.2 });
    });

    expect(result.current.userWaypoints).toHaveLength(3);
    expect(result.current.userWaypoints[1]).toEqual({ lat: 54.2, lng: -2.2 });
    expect(result.current.routeLegs).toHaveLength(2);

    unmount();
  });

  it('deletes an intermediate waypoint and reconnects adjacent points', async () => {
    vi.spyOn(gpxParser, 'fetchSnappedRouteLeg').mockImplementation(async (from, to) => [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);

    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    act(() => {
      result.current.startDrawing();
    });

    await act(async () => {
      await result.current.handleMapClick({ lat: 54.0, lng: -2.0 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.2, lng: -2.2 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.4, lng: -2.4 });
    });

    expect(result.current.userWaypoints).toHaveLength(3);

    // Delete waypoint 1 (middle)
    await act(async () => {
      await result.current.handleDeleteWaypoint(1);
    });

    expect(result.current.userWaypoints).toHaveLength(2);
    expect(result.current.userWaypoints[0]).toEqual({ lat: 54.0, lng: -2.0 });
    expect(result.current.userWaypoints[1]).toEqual({ lat: 54.4, lng: -2.4 });
    expect(result.current.routeLegs).toHaveLength(1);
    expect(result.current.routeLegs[0]).toEqual([
      [-2.0, 54.0],
      [-2.4, 54.4],
    ]);

    unmount();
  });

  it('supports undo across actions', async () => {
    vi.spyOn(gpxParser, 'fetchSnappedRouteLeg').mockImplementation(async (from, to) => [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ]);

    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    act(() => {
      result.current.startDrawing();
    });

    await act(async () => {
      await result.current.handleMapClick({ lat: 54.0, lng: -2.0 });
    });
    await act(async () => {
      await result.current.handleMapClick({ lat: 54.2, lng: -2.2 });
    });

    expect(result.current.userWaypoints).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);

    // Undo last point
    act(() => {
      result.current.handleUndoPoint();
    });

    expect(result.current.userWaypoints).toHaveLength(1);
    expect(result.current.draftTrackCoords).toEqual([[-2.0, 54.0]]);

    unmount();
  });

  it('loads an existing route for editing', () => {
    const { result, unmount } = renderCustomHook(() => useRouteDrawing());

    const waypoints = [
      { lat: 54.1, lng: -2.1 },
      { lat: 54.2, lng: -2.2 },
    ];
    const legs = [
      [
        [-2.1, 54.1],
        [-2.15, 54.15],
        [-2.2, 54.2],
      ],
    ];
    const coords = [
      [-2.1, 54.1],
      [-2.15, 54.15],
      [-2.2, 54.2],
    ];

    act(() => {
      result.current.loadRouteForEditing({
        userWaypoints: waypoints,
        routeLegs: legs,
        draftTrackCoords: coords,
      });
    });

    expect(result.current.isDrawing).toBe(true);
    expect(result.current.userWaypoints).toHaveLength(2);
    expect(result.current.routeLegs).toHaveLength(1);
    expect(result.current.draftTrackCoords).toEqual(coords);

    unmount();
  });
});
