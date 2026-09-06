// src/components/RouteDetailsDrawer.jsx
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, MapPin, TrendingUp, Navigation, Compass, Mountain } from 'lucide-react';

function ElevationChart({ profile }) {
  const { minEle, maxEle, maxDist, points, areaPoints } = useMemo(() => {
    if (!profile || profile.length < 2) {
      return { minEle: 0, maxEle: 0, maxDist: 0, points: '', areaPoints: '' };
    }

    let min = Infinity;
    let max = -Infinity;
    profile.forEach((p) => {
      if (p.elevation < min) min = p.elevation;
      if (p.elevation > max) max = p.elevation;
    });

    const eleSpan = max - min || 1;
    const chartMax = max + eleSpan * 0.1;
    const chartMin = Math.max(0, min - eleSpan * 0.1);
    const chartSpan = chartMax - chartMin;
    const maxD = profile[profile.length - 1].distance || 1;
    const w = 300;
    const h = 90;

    const pts = profile
      .map((p) => {
        const x = (p.distance / maxD) * w;
        const y = h - ((p.elevation - chartMin) / chartSpan) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return { minEle: min, maxEle: max, maxDist: maxD, points: pts, areaPoints: `0,${h} ${pts} ${w},${h}` };
  }, [profile]);

  if (!profile || profile.length < 2) {
    return <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No elevation data recorded.</p>;
  }

  return (
    <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem' }}>
          <Mountain size={14} color="#0284c7" />
          <span style={{ fontWeight: 600 }}>Elevation Profile</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Min: <b>{minEle}m</b> · Max: <b>{maxEle}m</b>
        </span>
      </div>

      <div style={{ width: '100%', height: '90px', position: 'relative' }}>
        <svg viewBox="0 0 300 90" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#eleGrad)" />
          <polyline fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
        <span>0 km</span>
        <span>{(maxDist / 2).toFixed(1)} km</span>
        <span>{maxDist.toFixed(1)} km</span>
      </div>
    </div>
  );
}

export default function RouteDetailsDrawer({ route, isOpen, onClose, onExport }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !route) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'auto' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 25px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100000,
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', background: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
              Route Details
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '0.5rem', lineHeight: 1.2 }}>
              {route.title}
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.25rem', wordBreak: 'break-all' }}>
              {route.fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem', color: '#64748b', background: 'transparent', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                <Navigation size={14} color="#3b82f6" />
                <span>Distance</span>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                {route.distanceKm} <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#64748b' }}>km</span>
              </p>
            </div>

            <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                <TrendingUp size={14} color="#10b981" />
                <span>Gain</span>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                +{route.elevationGainM} <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#64748b' }}>m</span>
              </p>
            </div>
          </div>

          {/* Elevation Line Chart */}
          <ElevationChart profile={route.elevationProfile} />

          {/* Start Point */}
          <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              <MapPin size={14} color="#ef4444" />
              <span>Start Coordinates</span>
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
              {route.startLocation.lat.toFixed(5)}, {route.startLocation.lng.toFixed(5)}
            </p>
          </div>

          {/* Bounding Box */}
          <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
              <Compass size={14} color="#f59e0b" />
              <span>Bounding Coordinates</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#334155' }}>
              <div>Min Lat: {route.bounds[0][0].toFixed(4)}</div>
              <div>Max Lat: {route.bounds[1][0].toFixed(4)}</div>
              <div>Min Lng: {route.bounds[0][1].toFixed(4)}</div>
              <div>Max Lng: {route.bounds[1][1].toFixed(4)}</div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0 0.25rem' }}>
            Total Recorded Points: <strong style={{ color: '#0f172a' }}>{route.pointCount}</strong>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9', background: '#ffffff' }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExport(route);
            }}
            style={{
              width: '100%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: '600',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <Download size={16} />
            Download GPX File
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}