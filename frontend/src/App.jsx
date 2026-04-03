import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { renderToString } from 'react-dom/server';
import { LogOut, Radio, AlertCircle, Clock, Map, Globe as GlobeIcon, CloudLightning, User, X, Activity, ShieldAlert, DollarSign, Anchor, Mic, Send, BarChart2, RefreshCw, Navigation, Bell, Eye, Lock, Wifi, MessageSquare, Crosshair, Target } from 'lucide-react';
import { FaSun, FaCloudRain, FaSnowflake, FaWind, FaBolt, FaWater } from 'react-icons/fa';
// FIX: CircleMarker, Polyline, and Circle are now properly imported to prevent the crash!
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Globe from 'react-globe.gl';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import './App.css';

// ─── TACTICAL ERROR BOUNDARY ───
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#030810', color: '#ff3366', fontFamily: 'monospace' }}>
          <ShieldAlert size={64} style={{ marginBottom: '20px' }} />
          <h2>SYSTEM MALFUNCTION DETECTED</h2>
          <p style={{ color: '#94a3b8', marginBottom: '30px' }}>{this.state.errorMsg}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '15px 30px', background: 'rgba(255, 51, 102, 0.2)', border: '1px solid #ff3366', color: '#ff3366', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', textTransform: 'uppercase' }}>
            <RefreshCw size={18} /> Reboot OS
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── UTILS & FORMATTERS ───
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

const getRiskColor = (status) => {
  if (!status) return '#00ff9d';
  if (status.includes('CRITICAL')) return '#ff3366';
  if (status.includes('HIGH') || status.includes('⚠️')) return '#ffb700';
  return '#00ff9d';
};

// ─── LEAFLET CUSTOM ICONS ───
const createShipIcon = (ship) => {
  const isCrit = (ship.statusText || '').includes('CRITICAL');
  const isWarn = (ship.statusText || '').includes('HIGH') || (ship.statusText || '').includes('⚠️');
  const html = `<div class="ship-marker" style="transform: rotate(${ship.heading || 0}deg)"><span class="ship-emoji">🚢</span>${isCrit ? '<div class="critical-ring"></div>' : ''}</div>`;
  return L.divIcon({ html, className: 'ship-div-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
};

const portIcon = L.divIcon({ html: `<div class="port-marker"><span class="port-emoji">⚓</span></div>`, className: 'port-div-icon', iconSize: [28, 28], iconAnchor: [14, 14] });

const createWeatherIcon = (Component, color) => {
  const htmlString = renderToString(<Component className="weather-icon" style={{ color }} />);
  return L.divIcon({ html: htmlString, className: 'weather-div-icon', iconSize: [40, 40], iconAnchor: [20, 20] });
};

// ─── OPTIMIZED MARKERS ───
const ShipMarkers = memo(({ ships, onShipClick }) => {
  return (
    <>
      {ships.map((ship) => {
        if(!ship.latitude || !ship.longitude) return null;
        const isCrit = (ship.statusText || '').includes('CRITICAL');
        const isWarn = (ship.statusText || '').includes('HIGH') || (ship.statusText || '').includes('⚠️');
        return (
          <CircleMarker 
            key={ship.id} 
            center={[ship.latitude, ship.longitude]} 
            radius={2.5} 
            fillColor={isCrit ? '#ff3366' : isWarn ? '#ffb700' : '#00f0ff'} 
            color="#000" weight={1} fillOpacity={1} 
            eventHandlers={{ click: () => onShipClick(ship) }} 
          />
        );
      })}
    </>
  );
});

const IndianFlag = () => (
  <div style={{width:'36px', height:'24px', position:'relative', border:'1px solid rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', boxShadow:'0 0 10px rgba(0,0,0,0.5)', marginRight:'10px', flexShrink: 0}}>
    <div style={{flex:1, background:'#FF9933'}} />
    <div style={{flex:1, background:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center'}}>
       <div style={{height:'6px', width:'6px', borderRadius:'50%', border:'1px solid #000080', position:'relative', display:'flex', alignItems:'center', justifyContent:'center'}}>
          {Array.from({length: 12}).map((_, i) => <div key={i} style={{position:'absolute', width:'0.5px', height:'100%', background:'#000080', transform:`rotate(${i*15}deg)`}}/>)}
       </div>
    </div>
    <div style={{flex:1, background:'#138808'}} />
  </div>
);

// ─── GLOBAL DATA ───
const MAJOR_PORTS = [
  { name: "Shanghai, China", lat: 31.23, lng: 121.47, congestion: "88%", delay: "36 hrs", prediction: "Worsening" },
  { name: "Singapore", lat: 1.26, lng: 103.82, congestion: "92%", delay: "48 hrs", prediction: "Clearing in 2 days" },
  { name: "Rotterdam, NL", lat: 51.92, lng: 4.47, congestion: "45%", delay: "2 hrs", prediction: "Stable" },
  { name: "Los Angeles, US", lat: 33.73, lng: -118.24, congestion: "75%", delay: "18 hrs", prediction: "Improving" },
  { name: "Jebel Ali, UAE", lat: 24.99, lng: 55.05, congestion: "60%", delay: "8 hrs", prediction: "Stable" },
  { name: "Mumbai, IN", lat: 18.95, lng: 72.95, congestion: "82%", delay: "24 hrs", prediction: "Heavy Traffic Expected" },
  { name: "Suez Port, EG", lat: 29.96, lng: 32.54, congestion: "98%", delay: "72 hrs", prediction: "CRITICAL BOTTLENECK" },
  { name: "Panama Canal", lat: 9.08, lng: -79.68, congestion: "95%", delay: "60 hrs", prediction: "Drought Restrictions Active" },
  { name: "Hamburg, DE", lat: 53.54, lng: 9.98, congestion: "55%", delay: "10 hrs", prediction: "Stable" },
  { name: "Cape Town, ZA", lat: -33.90, lng: 18.43, congestion: "65%", delay: "14 hrs", prediction: "Moderate Delays" },
  { name: "Santos, BR", lat: -23.96, lng: -46.30, congestion: "70%", delay: "20 hrs", prediction: "Worsening" },
  { name: "Sydney, AU", lat: -33.85, lng: 151.21, congestion: "40%", delay: "1 hr", prediction: "Clear" },
  { name: "Kandla, IN", lat: 23.03, lng: 70.21, congestion: "70%", delay: "12 hrs", prediction: "Stable" },
  { name: "Chennai, IN", lat: 13.08, lng: 80.29, congestion: "65%", delay: "10 hrs", prediction: "Improving" },
  { name: "Kolkata, IN", lat: 22.57, lng: 88.36, congestion: "80%", delay: "18 hrs", prediction: "Worsening" },
  { name: "Kochi, IN", lat: 9.93, lng: 76.26, congestion: "55%", delay: "6 hrs", prediction: "Clear" },
  { name: "Visakhapatnam, IN", lat: 17.68, lng: 83.21, congestion: "60%", delay: "8 hrs", prediction: "Stable" },
  { name: "Vladivostok, RU", lat: 43.11, lng: 131.87, congestion: "50%", delay: "14 hrs", prediction: "Stable" },
  { name: "Busan, KR", lat: 35.10, lng: 129.03, congestion: "85%", delay: "22 hrs", prediction: "Heavy Traffic" },
  { name: "Tokyo, JP", lat: 35.67, lng: 139.65, congestion: "80%", delay: "20 hrs", prediction: "Stable" },
  { name: "Yokohama, JP", lat: 35.44, lng: 139.63, congestion: "75%", delay: "16 hrs", prediction: "Improving" },
  { name: "Ningbo-Zhoushan, CN", lat: 29.86, lng: 121.54, congestion: "90%", delay: "30 hrs", prediction: "Critical Bottleneck" },
  { name: "Shenzhen, CN", lat: 22.54, lng: 114.05, congestion: "88%", delay: "26 hrs", prediction: "Worsening" }
];

const WEATHER_SYSTEMS = [
  { lat: 15.0, lng: 65.0, icon: FaWater, color: '#ff3366', name: "Cyclone Formation", desc: "Category 3 Winds & Swells" },
  { lat: 45.0, lng: -40.0, icon: FaCloudRain, color: '#00f0ff', name: "Atlantic Storm", desc: "Heavy Precipitation" },
  { lat: 20.0, lng: 115.0, icon: FaBolt, color: '#ffb700', name: "Typhoon Warning", desc: "Severe Lightning" },
  { lat: 55.0, lng: 5.0, icon: FaSnowflake, color: '#fff', name: "Arctic Front", desc: "Freezing Conditions" },
  { lat: -25.0, lng: 60.0, icon: FaSun, color: '#ffb700', name: "Clear Skies", desc: "Optimal Visibility" }
];

// ─── TICKER & CLOCKS ───
const IstClock = memo(() => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <div className="ist-clock"><Clock size={14} style={{verticalAlign:'middle', marginRight:'5px'}}/> IST: {time}</div>;
});

function LocalShipClock({ lon }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const offsetHours = Math.round((lon || 0) / 15);
      const shipTime = new Date(Date.now() + offsetHours * 3600 * 1000);
      setTime(shipTime.toISOString().substr(11, 8) + ` UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [lon]);
  return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ff9d', fontSize: '0.8rem', fontFamily: 'monospace' }}><Clock size={14} /> LOCAL: {time}</div>;
}

const LiveNewsTicker = memo(() => {
  const [news, setNews] = useState("🔴 TACTICAL OVERWATCH: Global maritime monitoring active. Fetching Live Intelligence...");
  useEffect(() => {
    fetch('https://api.reliefweb.int/v1/reports?appname=navarakshak&query[value]=maritime OR shipping OR "red sea" OR port OR cyclone OR conflict&limit=10&fields[include][]=title')
      .then(r => r.json()).then(data => { if (data?.data) setNews(data.data.map(i => `📰 ${i.fields.title}`).join('   |   ') + '   |   🚢 SYSTEM NOMINAL'); })
      .catch(()=>{});
  }, []);
  return (
    <div className="news-ticker-container">
      <div className="news-ticker-label"><AlertCircle size={14} style={{marginRight: 6}}/> LIVE INTEL</div>
      <div className="news-ticker-wrapper"><div className="news-ticker-text">{news}</div></div>
    </div>
  );
});

// ─── STAGE 1: WELCOME & AUTH ───
const AuthGateway = ({ onLogin }) => {
  const [stage, setStage] = useState('WELCOME'); 
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');

  if (stage === 'WELCOME') {
    return (
      <div className="welcome-screen">
        <div style={{display:'flex', alignItems:'center', marginBottom:'30px', justifyContent:'center'}}>
          <IndianFlag />
          <div className="welcome-logo-container" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginRight:'10px'}}>
              <ShieldAlert size={50} color="#00e5ff" style={{filter:'drop-shadow(0 0 15px #00e5ff)'}} />
              <Anchor size={20} color="#030810" style={{position:'absolute', marginTop:'2px'}} />
            </div>
            <h1 className="welcome-title" style={{margin:0}}><span style={{color:'#00f0ff'}}>NAVA</span>RAKSHAK</h1>
          </div>
        </div>
        <p className="welcome-subtitle">Maritime Tactical Operating System</p>
        <button className="init-btn" onClick={() => setStage('LOGIN')}>INITIALIZE SYSTEM</button>
      </div>
    );
  }

  return (
    <div className="welcome-screen">
      <div className="auth-grid-bg" />
      <div className="auth-box">
        <h2 style={{color:'#00f0ff', marginBottom:'30px', letterSpacing:'2px'}}>{stage === 'LOGIN' ? 'SECURE LOGIN' : 'REGISTER PERSONNEL'}</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (email === 'admin') onLogin({ role: 'admin', name: 'Fleet Cmdr' });
          else onLogin({ role: 'ship', name: 'Capt.', shipName: 'MSC TITAN' });
        }}>
          {stage === 'REGISTER' && <input type="text" className="auth-input" placeholder="FULL NAME" required />}
          <input type="text" className="auth-input" placeholder="TERMINAL ID (e.g., admin)" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input type="password" className="auth-input" placeholder="PASSCODE" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button type="submit" className="auth-submit-btn">AUTHORIZE LINK</button>
        </form>
        <div className="auth-hints">
          <span>Admin Access: <code>admin</code> / <code>rakshak</code></span><br/>
          <span>Captain Access: <code>captain</code> / <code>rakshak</code></span>
        </div>
        <p style={{marginTop:'25px', fontSize:'0.85rem', color:'#94a3b8', cursor:'pointer'}} onClick={() => setStage(stage === 'LOGIN' ? 'REGISTER' : 'LOGIN')}>
          {stage === 'LOGIN' ? 'New Personnel? Register Here' : 'Existing User? Login Here'}
        </p>
      </div>
    </div>
  );
};

// ─── TACTICAL MAP EVENT LISTENER ───
function TargetSelector({ active, onTargetSelect }) {
  useMapEvents({
    click(e) { if (active) onTargetSelect(e.latlng); }
  });
  return null;
}

// ─── STAGE 2: ADMIN DASHBOARD ───
const AdminDashboard = ({ user, onLogout }) => {
  const [allShips, setAllShips] = useState([]);
  const [renderedShips, setRenderedShips] = useState([]); // Performance Cap
  const [selectedShip, setSelectedShip] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [mode3D, setMode3D] = useState(false);
  const [weatherMode, setWeatherMode] = useState(false);
  const [radarTime, setRadarTime] = useState(null);
  
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState('WARNING');
  const [alertMessage, setAlertMessage] = useState('');
  const [broadcastRadius, setBroadcastRadius] = useState(0);
  const [chatLogs, setChatLogs] = useState([]);
  
  // Tactical Comms
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeChatShip, setActiveChatShip] = useState(null);
  const [isAreaTargeting, setIsAreaTargeting] = useState(false);
  const [targetCoords, setTargetCoords] = useState(null);
  
  // New Feature: AI Predictive Routing
  const [evacRoute, setEvacRoute] = useState(null);
  
  const stompClient = useRef(null);
  const globeRef = useRef();
  
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-satcom'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/admin', (msg) => {
          setChatLogs(prev => {
            const newLogs = [...prev, JSON.parse(msg.body)];
            // Group messages uniquely inside react state 
            return newLogs;
          });
        });
      }
    });
    client.activate(); stompClient.current = client; return () => client.deactivate();
  }, []);

  const fetchLiveData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/alerts/live');
      const data = await response.json();
      const unique = []; const seen = new Set();
      for (const ship of [...data].reverse()) {
        const id = ship.shipName || ship.id;
        if (!seen.has(id)) {
          seen.add(id);
          ship.cargoValue = 10000000 + (Math.abs(id.charCodeAt(0)) * 1000000);
          unique.push(ship);
        }
      }
      setAllShips(unique);
      // Removed 800 cap; preferCanvas easily renders 10000+ CircleMarkers at 60fps
      setRenderedShips(unique); 
    } catch (e) { console.log("Awaiting Backend..."); }
  }, []);

  useEffect(() => { fetchLiveData(); const id = setInterval(fetchLiveData, 4000); return () => clearInterval(id); }, [fetchLiveData]);

  useEffect(() => {
    if (weatherMode && !radarTime) {
      fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json())
        .then(d => { if (d?.radar?.past) setRadarTime(d.radar.past[d.radar.past.length-1].time); })
        .catch(() => {});
    }
  }, [weatherMode, radarTime]);

  const haversineDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }, []);

  const calculateEvacRoute = useCallback(() => {
    if(!selectedShip) return;
    let nearest = MAJOR_PORTS[0];
    let minDist = haversineDistance(selectedShip.latitude, selectedShip.longitude, nearest.lat, nearest.lng);
    MAJOR_PORTS.forEach(p => {
       const dist = haversineDistance(selectedShip.latitude, selectedShip.longitude, p.lat, p.lng);
       if (dist < minDist) { minDist = dist; nearest = p; }
    });
    setEvacRoute({ shipId: selectedShip.id, path: [[selectedShip.latitude, selectedShip.longitude], [nearest.lat, nearest.lng]], port: nearest.name, distance: Math.round(minDist) });
  }, [selectedShip, haversineDistance]);

  const sendSatcomAlert = (e) => {
    e.preventDefault();
    if (stompClient.current && stompClient.current.connected) {
      if (selectedShip && !isAreaTargeting) {
         // Single Ship Target 
         const targeted = broadcastRadius > 0 
           ? allShips.filter(s => haversineDistance(selectedShip.latitude, selectedShip.longitude, s.latitude, s.longitude) <= broadcastRadius)
           : [selectedShip];

         targeted.forEach(tShip => {
            const payload = { targetShipId: tShip.shipName, alertSeverity, message: alertMessage, sender: 'FLEET COMMAND', timestamp: new Date().toISOString() };
            stompClient.current.publish({ destination: '/app/sendAlert', body: JSON.stringify(payload) });
            setChatLogs(prev => [...prev, payload]);
         });
      } else if (isAreaTargeting) {
         // Area Radius Broadcast
         if (targetCoords && broadcastRadius > 0) {
            const targeted = allShips.filter(s => haversineDistance(targetCoords.lat, targetCoords.lng, s.latitude, s.longitude) <= broadcastRadius);
            targeted.forEach(tShip => {
               const payload = { targetShipId: tShip.shipName, alertSeverity, message: alertMessage, sender: 'FLEET COMMAND', timestamp: new Date().toISOString() };
               stompClient.current.publish({ destination: '/app/sendAlert', body: JSON.stringify(payload) });
               setChatLogs(prev => [...prev, payload]);
            });
         } else {
            // Global Broadcast
            const payload = { targetShipId: 'ALL', alertSeverity, message: alertMessage, sender: 'FLEET COMMAND', timestamp: new Date().toISOString() };
            stompClient.current.publish({ destination: '/app/sendAlert', body: JSON.stringify(payload) });
            setChatLogs(prev => [...prev, payload]);
         }
      }
    } else { alert("SYSTEM ERROR: STOMP LINK OFFLINE"); }
    setIsAlertModalOpen(false); setAlertMessage(''); setIsAreaTargeting(false); setBroadcastRadius(0); setTargetCoords(null);
  };

  const criticalCount = allShips.filter(s => (s.statusText||'').includes('CRITICAL')).length;
  const totalFleetValue = allShips.reduce((acc, ship) => acc + (ship.cargoValue || 0), 0);
  const stuckCount = allShips.filter(s => s.speed < 5).length;
  
  // 🔴 ANTI-CRASH PIE CHART LOGIC 🔴
  const pieData = allShips.length > 0 ? [
    { name: 'Safe', value: Math.max(1, totalFleetValue - (criticalCount * 15000000)), color: '#00ff9d' }, 
    { name: 'At Risk', value: criticalCount * 15000000, color: '#ff3366' }
  ] : [
    { name: 'Scanning...', value: 1, color: '#334155' } // Prevents Divide-by-Zero Crash
  ];

  return (
    <div className="app-wrapper">
      <header className="main-header">
        <div className="logo-area" style={{display:'flex', alignItems:'center'}}>
          <IndianFlag />
          <div style={{position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginRight:'8px'}}>
            <ShieldAlert size={28} color="#00e5ff" style={{filter:'drop-shadow(0 0 10px #00e5ff)'}} />
            <Anchor size={12} color="#030810" style={{position:'absolute', marginTop:'2px'}} />
          </div>
          <span className="navarakshak-text"><span className="text-nava">NAVA</span><span className="text-rakshak">RAKSHAK</span></span>
        </div>
        <div className="header-actions">
          <IstClock />
          <button className={`toolbar-btn ${inboxOpen ? 'tb-active' : ''}`} onClick={() => setInboxOpen(!inboxOpen)}>
            <MessageSquare size={15}/> COMM INBOX ({chatLogs.filter(m => m.sender !== 'FLEET COMMAND').length})
          </button>
          <button className={`toolbar-btn ${isAreaTargeting ? 'tb-active' : ''}`} onClick={() => { setIsAreaTargeting(!isAreaTargeting); setSelectedShip(null); setTargetCoords(null); setEvacRoute(null); }}>
            <Target size={15}/> AREA BROADCAST
          </button>
          <button className={`toolbar-btn ${weatherMode ? 'tb-active' : ''}`} onClick={() => {setWeatherMode(!weatherMode); setRadarTime(null);}}>
            <CloudLightning size={15}/> {weatherMode && !radarTime ? 'SCANNING...' : 'METEOROLOGY'}
          </button>
          <button className={`toolbar-btn ${mode3D ? 'tb-active' : ''}`} onClick={() => setMode3D(!mode3D)}>
            {mode3D ? <Map size={15}/> : <GlobeIcon size={15}/>} {mode3D ? '2D TACTICAL' : '3D GLOBE'}
          </button>
          <div style={{color:'#00f0ff', padding:'6px 12px', border:'1px solid rgba(0,240,255,0.3)', borderRadius:'6px', fontSize:'0.8rem', fontWeight:'bold', textTransform:'uppercase', background:'rgba(0,240,255,0.1)'}}><User size={14} style={{verticalAlign:'middle', marginRight:'5px'}}/> {user.name}</div>
          <button className="toolbar-btn tb-logout" onClick={onLogout}><LogOut size={15}/></button>
        </div>
      </header>
      
      <LiveNewsTicker />
      
      <div className="dashboard-core">
        <aside className="left-sidebar">
          <div className="sidebar-title">GLOBAL OVERWATCH</div>
          
          <div style={{marginBottom: '15px', position: 'relative', animation: 'pulse-glow 2s infinite alternate'}}>
            <input 
              type="text" 
              placeholder="🔍 Search active ships..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                const found = allShips.find(s => s.shipName.toLowerCase().includes(e.target.value.toLowerCase()));
                if(found) setSelectedShip(found);
              }}
              style={{
                width: '100%', padding: '12px 15px', background: 'rgba(0,240,255,0.05)', 
                border: '1px solid #00f0ff', color: '#fff', borderRadius: '8px',
                outline: 'none', transition: 'all 0.3s', fontSize: '0.9rem',
                boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)'
              }}
              onFocus={(e) => e.target.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.6)'}
              onBlur={(e) => e.target.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.2)'}
            />
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <div className="stat-card-tactical stat-cyan" style={{animation: 'fadeInUp 0.3s ease-out'}}>
               <p className="stat-label">Active Fleet Assets</p><p className="stat-value" style={{color:'#fff'}}>{allShips.length}</p>
            </div>
            <div className="stat-card-tactical stat-yellow" style={{border: '1px solid rgba(255, 183, 0, 0.3)', background: 'linear-gradient(135deg, rgba(255, 183, 0, 0.1), rgba(255, 183, 0, 0.05))', animation: 'fadeInUp 0.4s ease-out'}}>
               <p className="stat-label" style={{color:'#ffb700'}}>Delayed / Stuck Ships</p><p className="stat-value" style={{color:'#ffb700'}}>{stuckCount}</p>
            </div>
            <div className="stat-card-tactical stat-red" style={{animation: 'fadeInUp 0.5s ease-out'}}>
               <p className="stat-label" style={{color:'#ff3366'}}>Critical Threats</p><p className="stat-value" style={{color:'#ff3366'}}>{criticalCount}</p>
            </div>
          </div>
          
          <div style={{background:'rgba(0,0,0,0.4)', borderRadius:'8px', padding:'15px', border:'1px solid rgba(255,255,255,0.1)', marginTop:'10px'}}>
            <div style={{color:'#00f0ff', fontSize:'0.8rem', marginBottom:'15px', display:'flex', alignItems:'center', gap:'8px', fontWeight:'bold', letterSpacing:'1px'}}><DollarSign size={14}/> SUPPLY CHAIN RISK</div>
            <div style={{height:'150px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [name === 'Scanning...' ? 'Processing' : formatCurrency(v), name]} contentStyle={{background:'#0f172a', border:'1px solid #00f0ff', color:'#fff'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div style={{background:'rgba(0,0,0,0.4)', borderRadius:'8px', padding:'15px', border:'1px solid rgba(255,255,255,0.1)', marginTop:'10px'}}>
            <div style={{color:'#00f0ff', fontSize:'0.8rem', marginBottom:'15px', display:'flex', alignItems:'center', gap:'8px', fontWeight:'bold', letterSpacing:'1px'}}><DollarSign size={14}/> SUPPLY CHAIN RISK</div>
            <div style={{height:'150px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [name === 'Scanning...' ? 'Processing' : formatCurrency(v), name]} contentStyle={{background:'#0f172a', border:'1px solid #00f0ff', color:'#fff'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {isAreaTargeting && (
             <div style={{background:'rgba(255, 42, 85, 0.1)', borderRadius:'8px', padding:'20px', border:'1px solid var(--neon-red)', marginTop:'15px', boxShadow:'var(--glow-red)', animation:'fadeIn 0.3s'}}>
               <div style={{color:'var(--neon-red)', fontSize:'1rem', display:'flex', alignItems:'center', gap:'8px', fontWeight:'900', letterSpacing:'2px'}}><Target size={18}/> AREA BROADCAST ACTIVE</div>
               <p style={{color:'#fff', fontSize:'0.85rem', marginTop:'10px'}}>Select a central point on the map, or broadcast globally.</p>
               {targetCoords && <div style={{marginTop:'10px', padding:'10px', background:'rgba(0,0,0,0.5)', color:'var(--neon-cyan)', fontSize:'0.8rem', fontFamily:'monospace'}}>LAT: {targetCoords.lat.toFixed(4)}<br/>LON: {targetCoords.lng.toFixed(4)}</div>}
               <button className="satcom-trigger-btn" onClick={() => setIsAlertModalOpen(true)} style={{width: '100%', marginTop: '15px'}}><Navigation size={18} style={{marginRight: '8px'}}/> {targetCoords ? 'INITIATE TACTICAL LINK' : 'INITIATE GLOBAL LINK'}</button>
             </div>
          )}
        </aside>
        
        {/* FLOATING INBOX PANEL */}
        {inboxOpen && (
          <div className="satcom-modal-overlay" style={{background: 'rgba(0,0,0,0.5)'}}>
            <div className="satcom-modal" style={{width: '450px', height: '70vh', position: 'absolute', right: '50px', display: 'flex', flexDirection: 'column', padding: '20px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid rgba(0, 229, 255, 0.4)', paddingBottom:'15px'}}>
                <h3 style={{margin:0, color:'#00e5ff', display:'flex', alignItems:'center', gap:'10px', fontSize:'1.1rem'}}><Bell size={20}/> FLEET COMM INBOX</h3>
                <button onClick={() => setInboxOpen(false)} style={{background:'none', border:'none', color:'#fff', cursor:'pointer'}}><X size={24}/></button>
              </div>
              <div style={{flex: 1, overflowY: 'auto', paddingRight: '10px'}}>
                {activeChatShip ? (
                  <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
                    <div style={{display:'flex', alignItems:'center', borderBottom:'1px solid rgba(0, 229, 255, 0.2)', paddingBottom:'10px', marginBottom:'10px'}}>
                      <button onClick={() => setActiveChatShip(null)} style={{background:'rgba(0, 229, 255, 0.1)', color:'#00e5ff', border:'1px solid #00e5ff', padding:'5px 10px', borderRadius:'4px', cursor:'pointer', marginRight:'10px'}}>BACK</button>
                      <h4 style={{color:'#fff', margin:0, letterSpacing:'1px', flex:1}}>COMMS: {activeChatShip}</h4>
                    </div>
                    <div style={{flex: 1, display:'flex', flexDirection:'column', overflowY:'auto', gap:'10px'}}>
                      {chatLogs.filter(m => m.targetShipId === activeChatShip || m.sender === `CAPT. ${activeChatShip}` || m.targetShipId === 'ALL').length === 0 ? <div style={{color:'#7a94b0', textAlign:'center', marginTop:'20px'}}>No records found.</div> : chatLogs.filter(m => m.targetShipId === activeChatShip || m.sender === `CAPT. ${activeChatShip}` || m.targetShipId === 'ALL').map((msg, i) => (
                         <div key={i} style={{alignSelf: msg.sender === 'FLEET COMMAND' ? 'flex-end' : 'flex-start', background: msg.sender === 'FLEET COMMAND' ? 'rgba(0, 255, 157, 0.05)' : 'rgba(0, 229, 255, 0.05)', border: msg.sender === 'FLEET COMMAND' ? '1px solid rgba(0, 255, 157, 0.3)' : '1px solid rgba(0, 229, 255, 0.3)', padding:'10px', borderRadius:'8px', maxWidth:'80%'}}>
                           <div style={{fontSize:'0.65rem', color:'#8b9bb4', marginBottom:'4px'}}>{msg.sender} | {new Date(msg.timestamp).toLocaleTimeString()}</div>
                           <div style={{color:'#fff', fontSize:'0.85rem'}}>{msg.message}</div>
                         </div>
                      ))}
                    </div>
                    <div style={{display:'flex', marginTop:'15px', gap:'10px'}}>
                      <input type="text" id="quickMessage" placeholder="Transmit direct message..." style={{flex:1, background:'rgba(0, 0, 0, 0.5)', border:'1px solid #00e5ff', color:'#fff', padding:'10px', borderRadius:'4px'}} onKeyDown={(e)=> {
                        if (e.key === 'Enter' && e.target.value.trim() !== '') {
                          const payload = { targetShipId: activeChatShip, alertSeverity: 'INFO', message: e.target.value, sender: 'FLEET COMMAND', timestamp: new Date().toISOString() };
                          stompClient.current.publish({ destination: '/app/sendAlert', body: JSON.stringify(payload) });
                          setChatLogs(prev => [...prev, payload]);
                          e.target.value = '';
                        }
                      }}/>
                      <button onClick={() => {
                        const el = document.getElementById('quickMessage');
                        if (el.value.trim() === '') return;
                        const payload = { targetShipId: activeChatShip, alertSeverity: 'INFO', message: el.value, sender: 'FLEET COMMAND', timestamp: new Date().toISOString() };
                        stompClient.current.publish({ destination: '/app/sendAlert', body: JSON.stringify(payload) });
                        setChatLogs(prev => [...prev, payload]); el.value = '';
                      }} style={{background:'#00e5ff', color:'#000', border:'none', padding:'0 15px', borderRadius:'4px', fontWeight:'bold', cursor:'pointer'}}><Send size={16}/></button>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatLogs.length === 0 ? <div style={{color:'#7a94b0', textAlign:'center', marginTop:'40px', fontSize:'1.1rem', fontWeight:'bold', letterSpacing:'1px'}}>AWAITING TRANSMISSIONS...</div> : chatLogs.slice().reverse().map((msg, i) => (
                      <div key={i} onClick={() => { if(msg.sender !== 'FLEET COMMAND') setActiveChatShip(msg.sender.replace('CAPT. ', '')); else if (msg.targetShipId !== 'ALL') setActiveChatShip(msg.targetShipId); }} style={{cursor: 'pointer', background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.05), rgba(0, 229, 255, 0.02))', padding:'15px', borderRadius:'8px', border:'1px solid rgba(0, 229, 255, 0.3)', marginBottom:'12px', animation:'fadeIn 0.3s ease-out', transition: 'all 0.2s'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                          <div style={{color:'#00e5ff', fontWeight:'900', letterSpacing:'1px', fontSize:'0.85rem'}}>{msg.sender} ➔ {msg.targetShipId}</div>
                          <div style={{color:'#8b9bb4', fontSize:'0.65rem'}}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                        </div>
                        <div style={{color:'#fff', fontSize:'0.9rem', lineHeight:'1.5'}}>{msg.message}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        <main className="map-wrapper">
          {mode3D ? (
            <div className="map-absolute">
              <Globe
                ref={globeRef}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                pointsData={weatherMode ? [] : renderedShips}
                pointLat="latitude" pointLng="longitude"
                pointColor={d => (d.statusText||'').includes('CRITICAL') ? '#ff3366' : '#00ff9d'}
                pointAltitude={0.015} pointRadius={0.3}
                onPointClick={setSelectedShip}
              />
            </div>
          ) : (
            <div className="map-absolute">
              <MapContainer center={[20, 60]} zoom={3} minZoom={3} style={{height:'100%', width:'100%'}} zoomControl={false} noWrap={true} preferCanvas={true}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" noWrap={true} />
                <TargetSelector active={isAreaTargeting} onTargetSelect={setTargetCoords} />
                
                {targetCoords && (
                   <Circle center={targetCoords} radius={broadcastRadius > 0 ? broadcastRadius * 1000 : 50000} pathOptions={{color: 'var(--neon-red)', fillColor: 'var(--neon-red)', fillOpacity: 0.15}} />
                )}
                
                {evacRoute && !mode3D && (
                   <Polyline positions={evacRoute.path} color="#ffb700" weight={3} dashArray="10, 10" className="route-animation" />
                )}
                
                {/* 🟢 WEATHER OVERRIDE: HIDES SHIPS, SHOWS WEATHER 🟢 */}
                {weatherMode ? (
                  <>
                    {radarTime && (
                      <>
                        <TileLayer url={`https://tilecache.rainviewer.com/v2/satellite/${radarTime}/256/{z}/{x}/{y}/0/1_1.png`} opacity={0.4} zIndex={9} noWrap={true} />
                        <TileLayer url={`https://tilecache.rainviewer.com/v2/radar/${radarTime}/256/{z}/{x}/{y}/2/1_1.png`} opacity={0.7} zIndex={10} noWrap={true} />
                      </>
                    )}
                    {WEATHER_SYSTEMS.map((w, i) => (
                      <Marker key={`weather-${i}`} position={[w.lat, w.lng]} icon={createWeatherIcon(w.icon, w.color)}>
                        <Popup><div><strong style={{color:w.color}}>{w.name}</strong><br/>{w.desc}</div></Popup>
                      </Marker>
                    ))}
                  </>
                ) : (
                  /* 🟢 STANDARD MODE: ALL SHIPS RENDERED GLOBALLY AS CANVAS DOTS 🟢 */
                  <ShipMarkers ships={renderedShips} onShipClick={setSelectedShip} />
                )}
                
                {/* PORTS (ALWAYS VISIBLE) */}
                {MAJOR_PORTS.map((port, idx) => (
                  <Marker key={`port-${idx}`} position={[port.lat, port.lng]} icon={portIcon}>
                    <Popup>
                      <div style={{minWidth:'200px'}}>
                        <strong style={{fontSize:'1.1rem', color:'#00f0ff'}}>⚓ {port.name}</strong>
                        <div style={{borderTop:'1px solid #374151', margin:'8px 0', paddingTop:'8px'}}>
                          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}><span style={{color:'#94a3b8'}}>Congestion:</span> <span style={{color:'#ff3366', fontWeight:'bold'}}>{port.congestion}</span></div>
                          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}><span style={{color:'#94a3b8'}}>Avg Delay:</span> <span style={{color:'#ffb700', fontWeight:'bold'}}>{port.delay}</span></div>
                          <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'#94a3b8'}}>AI Prediction:</span> <span style={{color:'#00ff9d'}}>{port.prediction}</span></div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </main>
        
        <aside className={`ship-drawer ${selectedShip && !weatherMode ? 'drawer-open' : ''}`}>
          {selectedShip && !weatherMode && (
            <>
              <div className="drawer-header">
                <div>
                  <h2 className="drawer-ship-name">🚢 {selectedShip.shipName || 'Unknown'}</h2>
                  <p style={{margin:'5px 0 0 0', color:'#94a3b8', fontSize:'0.85rem', textTransform:'uppercase', letterSpacing:'1px'}}>{selectedShip.vessel_type}</p>
                </div>
                <button onClick={() => setSelectedShip(null)} style={{background:'none', border:'none', color:'#fff', cursor:'pointer'}}><X size={24}/></button>
              </div>
              
              <div className="detail-row">
                <span className="detail-label">AI Assessment</span>
                <span className="detail-value" style={{ color: (selectedShip.statusText||'').includes('CRITICAL') ? '#ff3366' : '#00ff9d', textShadow: '0 0 8px currentColor' }}>{selectedShip.statusText || '✅ SAFE'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cargo Value</span>
                <span className="detail-value" style={{fontFamily:'monospace', fontSize:'1.1rem', color:'#00f0ff'}}>{formatCurrency(selectedShip.cargoValue)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Speed / Course</span>
                <span className="detail-value">{selectedShip.speed?.toFixed(1)} kts | {selectedShip.heading?.toFixed(0)}°</span>
              </div>
              
              <button className="satcom-trigger-btn" onClick={() => setIsAlertModalOpen(true)}><Radio size={18} style={{marginRight: '8px'}}/> INITIATE SATCOM</button>
              
              <button onClick={calculateEvacRoute} style={{width:'100%', padding:'12px', background: 'rgba(255, 183, 0, 0.1)', border: '1px solid #ffb700', color: '#ffb700', marginTop: '10px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Navigation size={18} style={{marginRight: '8px'}}/> AI EVAC ROUTE
              </button>
              
              {evacRoute && evacRoute.shipId === selectedShip.id && (
                <div style={{color: '#ffb700', fontSize: '0.85rem', marginTop: '10px', textAlign:'center', background:'rgba(255,183,0,0.1)', padding:'10px', borderRadius:'6px'}}>
                  <span style={{fontWeight:'bold', display:'block'}}>TACTICAL REROUTE: {evacRoute.port}</span>
                  Distance: {evacRoute.distance} KM
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {isAlertModalOpen && (selectedShip || isAreaTargeting) && (
        <div className="satcom-modal-overlay">
          <div className="satcom-modal">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid rgba(255,51,102,0.4)', paddingBottom:'15px'}}>
              <h3 style={{margin:0, color:'#fff', display:'flex', alignItems:'center', gap:'10px', fontSize:'1.1rem'}}><Radio size={20} color="#ff3366"/> {isAreaTargeting ? 'AREA BROADCAST UPLINK' : 'COMM UPLINK'}</h3>
              <button onClick={() => setIsAlertModalOpen(false)} style={{background:'none', border:'none', color:'#fff', cursor:'pointer'}}><X size={24}/></button>
            </div>
            <form onSubmit={sendSatcomAlert}>
              <select className="satcom-select" value={alertSeverity} onChange={(e) => setAlertSeverity(e.target.value)}>
                <option value="WARNING">WARNING (Detour Advised)</option>
                <option value="CRITICAL">CRITICAL (Action Required)</option>
                <option value="INFO">INFO (General Comm)</option>
              </select>
              
              {isAreaTargeting && (
                <div style={{marginBottom:'15px', color:'white'}}>
                  <label style={{fontSize:'0.85rem', color:'#94a3b8', display:'block', marginBottom:'8px', fontWeight:'bold'}}>
                     BROADCAST RADIUS (KM) - {!targetCoords ? 'GLOBAL SCATTER' : 'AREA WIDE LINK'}
                  </label>
                  {targetCoords && (
                    <>
                      <input type="range" min="0" max="5000" step="100" value={broadcastRadius} onChange={(e)=>setBroadcastRadius(Number(e.target.value))} style={{width:'100%', accentColor:'#ff2a55'}} />
                      <div style={{textAlign:'right', fontSize:'0.85rem', color:'#00e5ff', fontWeight:'bold', marginTop:'5px'}}>{broadcastRadius === 0 ? 'GLOBAL TRANSMIT' : `${broadcastRadius} KM RADIUS NET`}</div>
                    </>
                  )}
                  {!targetCoords && (
                     <div style={{color:'var(--neon-green)', fontWeight:'bold', fontSize:'0.9rem', border:'1px solid var(--neon-green)', padding:'10px', borderRadius:'6px'}}>🌍 GLOBAL BROADCAST MODE ACTIVE</div>
                  )}
                </div>
              )}
              
              <textarea className="satcom-textarea" placeholder="Type tactical guidance..." value={alertMessage} onChange={(e) => setAlertMessage(e.target.value)} required />
              <button type="submit" className="satcom-send-btn">TRANSMIT PACKET</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── STAGE 3: SHIP / CAPTAIN DASHBOARD ───
function RadarController({ lat, lon }) { const map = useMap(); useEffect(() => { if(lat !== 0 && lon !== 0) map.setView([lat, lon], 7); }, [lat, lon, map]); return null; }

function ShipDashboard({ user, onLogout }) {
  const [alerts, setAlerts] = useState([]);
  const [activeAlarm, setActiveAlarm] = useState(false);
  const [myShipData, setMyShipData] = useState({ lat: 15.0, lon: 65.0, speed: 0, statusText: "✅ SAFE" });
  const [replyMessage, setReplyMessage] = useState('');
  
  const stompClient = useRef(null);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws-satcom'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/topic/fleet', (msg) => handleIncomingMessage(JSON.parse(msg.body)));
        client.subscribe(`/topic/ship/${user.shipName}`, (msg) => handleIncomingMessage(JSON.parse(msg.body)));
      }
    });
    client.activate(); stompClient.current = client; return () => client.deactivate();
  }, [user.shipName]);

  const handleIncomingMessage = (msg) => { setAlerts(prev => [...prev, msg]); if (msg.alertSeverity === "CRITICAL") setActiveAlarm(true); };

  useEffect(() => {
    const fetchMyLocation = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/alerts/live');
        const data = await response.json();
        const me = data.reverse().find(s => s.shipName === user.shipName);
        if (me) setMyShipData({ lat: me.latitude, lon: me.longitude, speed: me.speed, statusText: me.statusText });
      } catch (error) {}
    };
    fetchMyLocation(); const gpsInterval = setInterval(fetchMyLocation, 5000); return () => clearInterval(gpsInterval);
  }, [user.shipName]);

  const sendReply = (e) => {
    e.preventDefault();
    if (stompClient.current && stompClient.current.connected) {
      const payload = { targetShipId: "ADMIN", alertSeverity: "INFO", message: replyMessage, sender: `CAPT. ${user.shipName}`, timestamp: new Date().toISOString() };
      stompClient.current.publish({ destination: '/app/replyAdmin', body: JSON.stringify(payload) });
      setAlerts(prev => [...prev, payload]); setReplyMessage('');
    }
  };

  return (
    <div className={`app-wrapper ${activeAlarm ? 'combat-alarm-active' : ''}`}>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}><Anchor size={28} color="#00f0ff" style={{filter:'drop-shadow(0 0 5px #00f0ff)'}}/><h2 style={{ margin: 0, color: '#fff', letterSpacing:'2px' }}>VESSEL: {user.shipName}</h2></div>
        <LocalShipClock lon={myShipData.lon} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'rgba(0, 255, 157, 0.15)', color: '#00ff9d', border: '1px solid #00ff9d', padding:'6px 12px', borderRadius:'6px', fontSize:'0.8rem', fontWeight:'bold' }}>SATCOM: LINKED</div>
          <button onClick={onLogout} className="toolbar-btn tb-logout"><LogOut size={16} style={{marginRight: '5px'}}/> DE-AUTH</button>
        </div>
      </header>

      <div style={{display:'flex', height:'calc(100vh - 65px)', padding:'20px', gap:'20px', background:'#030810'}}>
        <div style={{flex: 2.5, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0, 240, 255, 0.3)', boxShadow: 'inset 0 0 100px rgba(0, 240, 255, 0.1)'}}>
           <MapContainer center={[myShipData.lat, myShipData.lon]} zoom={7} zoomControl={false} dragging={false} style={{width:'100%', height:'100%', filter: 'grayscale(0.5) contrast(1.2) brightness(0.8)'}}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" noWrap={true} />
            <RadarController lat={myShipData.lat} lon={myShipData.lon} />
            
            {/* 🔴 THIS IS WHAT CRASHED EARLIER. IT IS NOW FIXED AND IMPORTED 🔴 */}
            <CircleMarker center={[myShipData.lat, myShipData.lon]} radius={8} fillColor="#00f0ff" color="#fff" weight={2} fillOpacity={1} />
            
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '200%', height: '200%', background: 'conic-gradient(from 0deg, transparent 70%, rgba(0, 240, 255, 0.3) 100%)', borderRadius: '50%', transform: 'translate(-50%, -50%)', animation: 'spin 4s linear infinite', zIndex: 1000, pointerEvents: 'none' }} />
          </MapContainer>
        </div>

        <div style={{flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(8, 14, 26, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow:'hidden'}}>
          <div style={{background: 'rgba(0,0,0,0.5)', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#00f0ff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px'}}><Radio size={22}/> SATCOM SECURE LINK</div>
          <div style={{flex: 1, padding: '20px', overflowY: 'auto', display:'flex', flexDirection:'column', gap:'10px'}}>
            {alerts.length === 0 ? <div style={{color:'#7a94b0', textAlign:'center', marginTop:'40px'}}>Awaiting Command Transmissions...</div> : alerts.map((alert, i) => (
              <div key={i} style={{background: (alert.sender||'').includes('CAPT') ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 183, 0, 0.05)', padding:'15px', borderRadius:'12px', border:'1px solid', borderColor:(alert.sender||'').includes('CAPT') ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 183, 0, 0.2)', alignSelf: (alert.sender||'').includes('CAPT') ? 'flex-end' : 'flex-start', maxWidth:'80%', boxShadow:'0 4px 6px rgba(0,0,0,0.1)'}}>
                <div style={{fontSize: '0.65rem', color: '#7a94b0', marginBottom:'6px', letterSpacing:'1px', textTransform:'uppercase', display:'flex', justifyContent:'space-between'}}>
                   <span style={{color:(alert.sender||'').includes('CAPT') ? '#00f0ff' : '#ffb700', fontWeight:'bold'}}>{alert.sender}</span>
                   <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{fontSize: '0.9rem', color:'#fff', lineHeight:'1.5'}}>{alert.message}</div>
              </div>
            ))}
          </div>
          {activeAlarm && <button style={{background: '#ff3366', color: 'white', border: 'none', padding: '18px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', textTransform: 'uppercase'}} onClick={() => setActiveAlarm(false)}>ACKNOWLEDGE ALARM</button>}
          
          <form onSubmit={sendReply} style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '15px', background:'rgba(0,0,0,0.3)' }}>
            <input type="text" style={{flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', padding:'12px', borderRadius:'6px'}} placeholder="Draft reply..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} required />
            <button type="submit" style={{padding:'0 30px', background:'#ff3366', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer'}}><Send size={20}/></button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT INIT ───
export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('navarakshak_user')); } catch { return null; } });
  const handleLogin = (userData) => { setUser(userData); localStorage.setItem('navarakshak_user', JSON.stringify(userData)); };
  
  return (
    <ErrorBoundary>
      {!user ? (
        <AuthGateway onLogin={handleLogin} />
      ) : user.role === 'admin' ? (
        <AdminDashboard user={user} onLogout={() => { setUser(null); localStorage.removeItem('navarakshak_user'); }} />
      ) : (
        <ShipDashboard user={user} onLogout={() => { setUser(null); localStorage.removeItem('navarakshak_user'); }} />
      )}
    </ErrorBoundary>
  );
}