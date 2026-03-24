import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wind, User, LogOut, X, Radio, AlertCircle, Layers, FileText, Clock, Navigation, Anchor } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import './App.css';

// ─── CHOLA-TECH CHAKRA LOGO ───────────────────────────────────────────────────
const NavaRakshakLogo = ({ size = 42 }) => (
  <div className="logo-area" style={{ justifyContent: 'center', marginBottom: '10px' }}>
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,2 98,25 98,75 50,98 2,75 2,25" stroke="#06b6d4" strokeWidth="3" fill="rgba(2,6,23,0.5)"/>
      <circle cx="50" cy="50" r="28" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 6"/>
      <circle cx="50" cy="50" r="22" stroke="#f59e0b" strokeWidth="1" opacity="0.5"/>
      <path d="M50 22 L50 78 M22 50 L78 50 M30 30 L70 70 M30 70 L70 30" stroke="#f59e0b" strokeWidth="1" opacity="0.4"/>
      <path d="M 50,15 L 65,65 L 50,60 L 35,65 Z" fill="#38bdf8"/>
      <path d="M 35,75 C 45,85 55,85 65,75" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"/>
      <path d="M 40,85 C 45,90 55,90 60,85" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <div className="navarakshak-text"><span className="text-nava">NAVA</span><span className="text-rakshak">RAKSHAK</span></div>
  </div>
);

// ─── LIVE UTC CLOCK ───────────────────────────────────────────────────────────
function UtcClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toUTCString().split(' ').slice(4, 6).join(' ').replace('GMT', 'UTC'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.78rem', fontFamily: 'monospace', letterSpacing: '1px' }}>
      <Clock size={13} />
      {time}
    </div>
  );
}

// ─── TACTICAL INTEL TICKER ─────────────────────────────────────────────────
const TACTICAL_FALLBACK = 
  "🔴 GEOPOLITICAL ALERT: Tensions escalating in Strait of Hormuz. US Navy and allied forces shadowing commercial tanker traffic.   |   " +
  "🔴 RED SEA CORRIDOR: Houthi threat active. Multiple carriers rerouting via Cape of Good Hope. Insurance premiums elevated.   |   " +
  "🔴 SOUTH CHINA SEA: Naval exercises reported near sovereign waters. Maintain active radar watch.   |   " +
  "🔴 WEATHER WARNING: Category 3 Cyclone forming in the Bay of Bengal. Ports on high alert.   |   " +
  "🔴 PIRACY UPDATE: Suspicious skiff activity reported near Gulf of Guinea. Implement BMP5 protocols.";

function LiveNewsTicker() {
  const [news, setNews] = useState(TACTICAL_FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          'https://api.reliefweb.int/v1/reports?appname=navarakshak&query[value]=conflict OR "red sea" OR "hormuz" OR maritime&sort[]=date:desc&limit=5&fields[include][]=title',
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Non-200');
        const data = await response.json();
        if (data?.data?.length > 0) {
          const headlines = data.data.map(item => `🔴 ${item.fields.title}`).join('   |   ');
          setNews(headlines + '   |   (END OF LIVE REPORT)');
          setLive(true);
        }
      } catch {
        // Fallback handles it perfectly
      }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  return (
    <div className="news-ticker-container">
      <div className="news-ticker-label">
        <AlertCircle size={14} style={{ marginRight: '5px' }} />
        {live ? 'LIVE UN INTEL' : 'TACTICAL INTEL'}
      </div>
      <div className="news-ticker-wrapper">
        <div className="news-ticker-text" key={news}>{news}</div>
      </div>
    </div>
  );
}

// ─── MAP CONTROLLER ───────────────────────────────────────────────────────────
function MapController({ targetShip }) {
  const map = useMap();
  useEffect(() => {
    if (targetShip?.latitude && targetShip?.longitude) {
      map.flyTo([targetShip.latitude, targetShip.longitude], 10, { animate: true, duration: 1.5 });
    }
  }, [targetShip, map]);
  return null;
}

// ─── HEATMAP LAYER ────────────────────────────────────────────────────────────
function HeatmapLayer({ ships, enabled }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }
    if (layerRef.current) map.removeLayer(layerRef.current);
    const group = L.layerGroup();
    ships.forEach(ship => {
      const lat = ship.latitude || 0;
      const lon = ship.longitude || 0;
      if (lat === 0 && lon === 0) return;
      const isCritical = ship.statusText?.includes('CRITICAL');
      const isHigh = ship.statusText?.includes('HIGH RISK') || ship.statusText?.includes('DELAYED');
      const color = isCritical ? '#ef4444' : isHigh ? '#f59e0b' : '#10b981';
      L.circleMarker([lat, lon], { radius: 14, fillColor: color, color: 'transparent', fillOpacity: 0.08 }).addTo(group);
    });
    group.addTo(map);
    layerRef.current = group;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [ships, enabled, map]);
  return null;
}

// ─── MAP LEGEND ───────────────────────────────────────────────────────────────
const MapLegend = () => (
  <div className="map-legend frosted-panel">
    <div className="legend-title">VESSEL STATUS</div>
    <div className="legend-item"><span className="legend-dot" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />NORMAL</div>
    <div className="legend-item"><span className="legend-dot" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />DELAY / CAUTION</div>
    <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />CRITICAL (WAR/STORM)</div>
  </div>
);

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportFleetPDF(ships) {
  const criticalShips = ships.filter(s => s.statusText?.includes('CRITICAL'));
  const highRiskShips = ships.filter(s => s.statusText?.includes('HIGH RISK'));
  const normalShips = ships.filter(s => !s.statusText?.includes('CRITICAL') && !s.statusText?.includes('HIGH RISK'));
  const now = new Date().toUTCString();

  const rows = (list, color) => list.map(s =>
      `<tr>
        <td>${s.shipName || 'Unknown'}</td>
        <td>${(s.latitude || 0).toFixed(4)}, ${(s.longitude || 0).toFixed(4)}</td>
        <td>${s.speed || 0} kts</td>
        <td>${s.vessel_type || 'Commercial'}</td>
        <td style="color:${color};font-weight:bold">${s.statusText || 'N/A'}</td>
      </tr>`
    ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>NavaRakshak Fleet Report</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #020617; color: #e2e8f0; margin: 0; padding: 30px; }
  h1 { color: #06b6d4; letter-spacing: 3px; font-size: 1.8rem; margin-bottom: 4px; }
  h2 { color: #38bdf8; font-size: 1rem; letter-spacing: 2px; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-top: 30px; }
  .meta { color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px; }
  .summary { display: flex; gap: 20px; margin: 20px 0; }
  .stat { background: rgba(15,23,42,0.8); border: 1px solid #334155; border-radius: 8px; padding: 15px 25px; text-align: center; }
  .stat .num { font-size: 2rem; font-weight: bold; }
  .stat .lbl { font-size: 0.75rem; color: #94a3b8; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 10px; }
  th { background: rgba(15,23,42,0.9); color: #94a3b8; padding: 10px; text-align: left; letter-spacing: 1px; font-size: 0.75rem; border-bottom: 1px solid #334155; }
  td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .footer { margin-top: 40px; color: #334155; font-size: 0.75rem; text-align: center; }
</style></head><body>
<h1>⚓ NAVARAKSHAK — FLEET INTELLIGENCE REPORT</h1>
<div class="meta">Generated: ${now} &nbsp;|&nbsp; Classification: OPERATIONAL</div>
<div class="summary">
  <div class="stat"><div class="num" style="color:#38bdf8">${ships.length}</div><div class="lbl">SHIPS MONITORED</div></div>
  <div class="stat"><div class="num" style="color:#f59e0b">${highRiskShips.length}</div><div class="lbl">HIGH RISK</div></div>
  <div class="stat"><div class="num" style="color:#ef4444">${criticalShips.length}</div><div class="lbl">CRITICAL</div></div>
  <div class="stat"><div class="num" style="color:#10b981">${normalShips.length}</div><div class="lbl">NORMAL</div></div>
</div>
${criticalShips.length > 0 ? `<h2>🔴 CRITICAL THREATS (${criticalShips.length})</h2><table><thead><tr><th>VESSEL</th><th>COORDINATES</th><th>SPEED</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>${rows(criticalShips, '#ef4444')}</tbody></table>` : ''}
${highRiskShips.length > 0 ? `<h2>🟡 HIGH RISK VESSELS (${highRiskShips.length})</h2><table><thead><tr><th>VESSEL</th><th>COORDINATES</th><th>SPEED</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>${rows(highRiskShips, '#f59e0b')}</tbody></table>` : ''}
<h2>🟢 ALL MONITORED VESSELS (${ships.length})</h2><table><thead><tr><th>VESSEL</th><th>COORDINATES</th><th>SPEED</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>${rows(ships.slice(0, 500), '#10b981')}</tbody></table>
<div class="footer">NavaRakshak Maritime Intelligence OS — CONFIDENTIAL — ${now}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NavaRakshak_FleetReport_${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({ user, onLogout }) {
  const [ships, setShips] = useState([]);
  const [selectedShip, setSelectedShip] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLiveData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/alerts/live');
      const data = await response.json();

      const newestData = [...data].reverse();
      const uniqueShips = [];
      const seenMMSI = new Set();

      for (const ship of newestData) {
        const key = ship.shipName && ship.shipName !== 'Unknown' ? ship.shipName : ship.id; 
        if (key && !seenMMSI.has(key)) {
          seenMMSI.add(key);
          // Set a default status based on data_source if none exists
          if (!ship.statusText && ship.data_source === "REAL_AIS") ship.statusText = "✅ SAFE";
          uniqueShips.push(ship);
        }
        if (uniqueShips.length >= 3000) break;
      }
      setShips(uniqueShips);
    } catch (error) { console.error('SATCOM Link Offline:', error); }
  }, []);

  // 🔴 NEW: DEAD RECKONING ANIMATION ENGINE 🔴
  // This physically moves the dots across the screen 60 times a minute between backend updates!
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setShips(prevShips => prevShips.map(ship => {
        if (!ship.speed || !ship.heading) return ship;
        // Calculate tiny movement vector based on speed and heading
        const moveFactor = ship.speed * 0.000008; 
        const rad = ship.heading * (Math.PI / 180);
        return {
          ...ship,
          latitude: ship.latitude + (moveFactor * Math.cos(rad)),
          longitude: ship.longitude + (moveFactor * Math.sin(rad))
        };
      }));
    }, 1000); // Smooth movement every 1 second
    return () => clearInterval(animationInterval);
  }, []);

  useEffect(() => {
    fetchLiveData();
    const id = setInterval(fetchLiveData, 6000); // Fetch true position from backend every 6s
    return () => clearInterval(id);
  }, [fetchLiveData]);

  const criticalShips = ships.filter(s => s.statusText?.includes('CRITICAL'));
  const highRiskShips = ships.filter(s => s.statusText?.includes('HIGH RISK') || s.statusText?.includes('DELAY'));

  const searchResults = searchQuery.length > 1
    ? ships.filter(s => s.shipName?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : [];

  const handleShipSelect = (ship) => {
    setSelectedShip(ship);
    setSearchQuery('');
    setIsSearching(false);
    setActiveModal(null);
  };

  const getShipColor = (statusText) => {
    if (statusText?.includes('CRITICAL')) return '#ef4444';
    if (statusText?.includes('HIGH RISK') || statusText?.includes('DELAY')) return '#f59e0b';
    return '#10b981';
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => { exportFleetPDF(ships); setExporting(false); }, 300);
  };

  const modalInfo =
    activeModal === 'ALL'      ? { title: 'ALL MONITORED VESSELS',      data: ships,         color: '#38bdf8' } :
    activeModal === 'DELAY'    ? { title: 'ACTIVE DELAYS & HIGH RISK',  data: highRiskShips, color: '#f59e0b' } :
    activeModal === 'CRITICAL' ? { title: 'CRITICAL THREATS',           data: criticalShips, color: '#ef4444' } :
                                 { title: '', data: [], color: '#fff' };

  return (
    <div className="hero-map-container">

      {/* HEADER */}
      <header className="main-header frosted-panel">
        <NavaRakshakLogo size={32} />
        <UtcClock />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setHeatmapEnabled(h => !h)} className={`toolbar-btn ${heatmapEnabled ? 'toolbar-btn-active' : ''}`} title="Toggle Threat Heatmap">
            <Layers size={15} style={{ marginRight: '5px' }} /> HEATMAP {heatmapEnabled ? 'ON' : 'OFF'}
          </button>
          <button onClick={handleExport} className="toolbar-btn toolbar-btn-export" disabled={exporting} title="Export Fleet Report">
            <FileText size={15} style={{ marginRight: '5px' }} /> {exporting ? 'GENERATING...' : 'EXPORT REPORT'}
          </button>
          <div className="role-badge"><User size={14} /> {user.name}</div>
          <div className="live-indicator">● LIVE SATCOM FEED</div>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </header>

      {/* NEWS TICKER */}
      <LiveNewsTicker />

      {/* LEFT SIDEBAR */}
      <aside className="left-sidebar frosted-panel" style={{ top: '110px', zIndex: 1002 }}>
        <div className="sidebar-title">Fleet Commander</div>
        <div className="search-container">
          <input type="text" className="search-input" style={{ marginBottom: 0 }} placeholder="Search Ship Name..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsSearching(true); }} onFocus={() => setIsSearching(true)} />
          {isSearching && searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map(ship => (
                <div key={ship.id} className="search-result-item" onClick={() => handleShipSelect(ship)}>
                  <span>{ship.shipName}</span><span style={{ color: ship.statusText?.includes('CRITICAL') ? '#ef4444' : '#10b981' }}>{ship.speed}kts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-card-tactical clickable-card" onClick={() => setActiveModal('ALL')} style={{ borderColor: '#38bdf8' }}>
          <p className="stat-label" style={{ color: '#38bdf8' }}>Ships Monitored (Click to view)</p>
          <p className="stat-value" style={{ color: '#f8fafc' }}>{ships.length}</p>
        </div>

        <div className="stat-card-tactical clickable-card" onClick={() => setActiveModal('DELAY')} style={{ borderColor: '#f59e0b' }}>
          <p className="stat-label" style={{ color: '#f59e0b' }}>Active Delays (Click to view)</p>
          <p className="stat-value" style={{ color: '#f59e0b' }}>{highRiskShips.length}</p>
        </div>

        <div className="stat-card-tactical clickable-card" onClick={() => setActiveModal('CRITICAL')} style={{ borderColor: '#ef4444' }}>
          <p className="stat-label" style={{ color: '#ef4444' }}>Critical Threats (Click to view)</p>
          <p className="stat-value" style={{ color: '#ef4444' }}>{criticalShips.length}</p>
        </div>
      </aside>

      {/* MODAL */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, color: modalInfo.color, fontSize: '1.2rem' }}>{modalInfo.title}</h2>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <table className="fleet-table">
                <thead><tr><th>Vessel Name</th><th>Speed</th><th>Type</th><th>Risk Assessment</th></tr></thead>
                <tbody>
                  {modalInfo.data.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No vessels currently in this category.</td></tr>
                  ) : (
                    modalInfo.data.map(ship => (
                      <tr key={ship.id} style={{ cursor: 'pointer', borderBottom: '1px solid #334155' }} onClick={() => handleShipSelect(ship)}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#f8fafc' }}>{ship.shipName}</td>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>{ship.speed} kts</td>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>{ship.vessel_type || 'N/A'}</td>
                        <td style={{ padding: '12px', color: ship.statusText?.includes('CRITICAL') ? '#ef4444' : (ship.statusText?.includes('HIGH') || ship.statusText?.includes('DELAY') ? '#f59e0b' : '#10b981'), fontWeight: 'bold' }}>{ship.statusText}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SHIP DETAIL DRAWER */}
      <aside className={`ship-details-drawer frosted-panel ${selectedShip ? 'drawer-open' : ''}`} style={{ top: '110px' }}>
        {selectedShip && (
          <>
            <div className="drawer-header">
              <div>
                <h2 style={{ margin: 0, color: '#f8fafc' }}>{selectedShip.shipName}</h2>
                <p style={{ margin: '3px 0 0 0', color: '#94a3b8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Anchor size={14} /> {selectedShip.vessel_type || 'Commercial Vessel'} | IMO: {(selectedShip.id || 'N/A').toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedShip(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">AI Risk Assessment</span>
              <span className="detail-value" style={{ color: selectedShip.statusText?.includes('CRITICAL') ? '#ef4444' : (selectedShip.statusText?.includes('HIGH') || selectedShip.statusText?.includes('DELAY') ? '#f59e0b' : '#10b981') }}>
                {selectedShip.statusText || '✅ SAFE'}
              </span>
            </div>
            <div className="detail-row"><span className="detail-label">Destination</span><span className="detail-value" style={{ color: '#38bdf8' }}>{selectedShip.destination || 'Tracking...'}</span></div>
            <div className="detail-row"><span className="detail-label">Current Speed</span><span className="detail-value">{selectedShip.speed || 0} knots</span></div>
            <div className="detail-row">
              <span className="detail-label">Course (Heading)</span>
              <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Navigation size={14} style={{ transform: `rotate(${selectedShip.heading || 0}deg)` }}/> {selectedShip.heading || 0}°</span>
            </div>
            <div className="detail-row"><span className="detail-label">Coordinates</span><span className="detail-value">{(selectedShip.latitude || 0).toFixed(4)}, {(selectedShip.longitude || 0).toFixed(4)}</span></div>
            <div className="detail-row"><span className="detail-label">Local Weather</span><span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Wind size={16} /> {selectedShip.weather || 'N/A'}</span></div>
            <div className="detail-row"><span className="detail-label">Communication Link</span><span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#22c55e' }}><Radio size={16} /> SATCOM (Starlink)</span></div>
            
            <button style={{ width: '100%', padding: '12px', background: '#020617', border: '1px solid #334155', color: '#ef4444', borderRadius: '6px', marginTop: '30px', fontWeight: 'bold', cursor: 'pointer' }}>
              SEND MANUAL SATCOM ALERT
            </button>
          </>
        )}
      </aside>

      {/* MAP */}
      <MapContainer center={[20.0, 60.0]} zoom={3} className="custom-map-full" scrollWheelZoom={true} zoomControl={false} preferCanvas={true}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='Tiles &copy; Esri' />
        <MapController targetShip={selectedShip} />
        <HeatmapLayer ships={ships} enabled={heatmapEnabled} />

        {ships.map((ship) => {
          const lat = ship.latitude || 0;
          const lon = ship.longitude || 0;
          if (lat === 0 && lon === 0) return null;
          return (
            <CircleMarker key={ship.id} center={[lat, lon]} radius={4} fillColor={getShipColor(ship.statusText)} color="#ffffff" weight={1} fillOpacity={0.85} eventHandlers={{ click: () => handleShipSelect(ship) }} />
          );
        })}
      </MapContainer>

      {/* MAP LEGEND */}
      <MapLegend />
    </div>
  );
}

// ─── SHIP DASHBOARD ───────────────────────────────────────────────────────────
function ShipDashboard({ user, onLogout }) {
  return (
    <div style={{ textAlign: 'center', padding: '100px', backgroundColor: '#020617', minHeight: '100vh', color: '#fff' }}>
      <NavaRakshakLogo size={60} />
      <h1 style={{ marginTop: '2rem' }}>Welcome Captain. Bridge link established to {user.shipName}.</h1>
      <button onClick={onLogout} className="auth-btn" style={{ maxWidth: '200px', marginTop: '20px' }}>LOGOUT TERMINAL</button>
    </div>
  );
}

// ─── AUTH GATEWAY ─────────────────────────────────────────────────────────────
function AuthGateway({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shipName, setShipName] = useState('');
  const [imoNumber, setImoNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      if (email === 'admin' && password === 'rakshak') onLogin({ role: 'admin', name: 'Fleet Cmdr' });
      else if (email === 'captain' && password === 'rakshak') onLogin({ role: 'ship', name: 'Capt.', shipName: 'TEST SHIP' });
      else setError('Connection refused. Invalid ID or Passcode.');
    } else {
      if (!shipName || !imoNumber || !email || !password) return setError('All fields required.');
      alert(`Registration Request Sent for ${shipName}.`);
      setIsLogin(true);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <NavaRakshakLogo size={60} />
        <p style={{ color: '#94a3b8', margin: '0 0 2rem 0' }}>Maritime Intelligence OS</p>
        {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem', backgroundColor: 'rgba(239,68,68,0.1)', padding: '10px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="input-group"><input type="text" className="auth-input" value={shipName} onChange={e => setShipName(e.target.value)} placeholder="Vessel Name" /></div>
              <div className="input-group"><input type="text" className="auth-input" value={imoNumber} onChange={e => setImoNumber(e.target.value)} placeholder="IMO Number" /></div>
            </>
          )}
          <div className="input-group"><input type="text" className="auth-input" value={email} onChange={e => setEmail(e.target.value)} placeholder={isLogin ? 'Terminal ID (admin)' : 'captain@vessel.com'} /></div>
          <div className="input-group"><input type="password" className="auth-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Passcode (rakshak)" /></div>
          <button type="submit" className="auth-btn">{isLogin ? 'ESTABLISH SECURE LINK' : 'SUBMIT REGISTRATION'}</button>
        </form>
        <div className="auth-toggle">
          {isLogin ? <p>New Vessel? <span onClick={() => setIsLogin(false)}>Register</span></p> : <p>Registered? <span onClick={() => setIsLogin(true)}>Login</span></p>}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <AuthGateway onLogin={setUser} />;
  return user.role === 'admin'
    ? <AdminDashboard user={user} onLogout={() => setUser(null)} />
    : <ShipDashboard user={user} onLogout={() => setUser(null)} />;
}