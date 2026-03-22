import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Ship, Wind } from 'lucide-react';
import './App.css'; // THIS LINKS YOUR BEAUTIFUL CSS FILE!

function App() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch Live Data from Spring Boot
  const fetchLiveData = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/alerts/live');
      const data = await response.json();
      setShips(data.reverse()); // Newest ships at the top
      setLoading(false);
    } catch (error) {
      console.error("SATCOM Link Offline:", error);
    }
  };

  useEffect(() => {
    fetchLiveData(); // Initial fetch
    const radarSweep = setInterval(fetchLiveData, 3000); // Poll every 3 seconds
    return () => clearInterval(radarSweep);
  }, []);

  return (
    <div className="dashboard-container">
      
      {/* HEADER */}
      <div className="dashboard-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ship size={28} />
          Global Fleet Operations Center
        </h1>
        <div className="live-indicator">● LIVE SATCOM FEED</div>
      </div>

      {/* DATA TABLE */}
      <div className="table-wrapper">
        <table className="fleet-table">
          <thead>
            <tr>
              <th>Vessel Name</th>
              <th>Coordinates</th>
              <th>Speed</th>
              <th>Live Weather</th>
              <th>AI Risk Assessment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="loading">Establishing Secure SATCOM Link...</td>
              </tr>
            ) : (
              ships.map((ship) => {
                // Map the risk text to your custom CSS classes
                let rowClass = "row-safe";
                let Icon = ShieldCheck;
                
                if (ship.statusText.includes("HIGH RISK")) {
                  rowClass = "row-high";
                  Icon = AlertTriangle;
                } else if (ship.statusText.includes("CRITICAL")) {
                  rowClass = "row-critical";
                  Icon = AlertTriangle;
                }

                return (
                  <tr key={ship.id} className={rowClass}>
                    <td className="ship-name">{ship.shipName}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                      {ship.latitude.toFixed(4)}, {ship.longitude.toFixed(4)}
                    </td>
                    <td>{ship.speed} kts</td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Wind size={16} color="#94a3b8" />
                      {ship.weather || "Clear"}
                    </td>
                    <td className="status-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={18} />
                      {ship.statusText}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;