import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import pin from './car.png';

const customIcon = L.icon({
  iconUrl: pin,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const Map = () => {
  const [vehicles, setVehicles] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const markersRef = useRef([]);
  const animationFrameIdsRef = useRef([]);

  useEffect(() => {
    fetch('http://localhost:8002/vehicles')
      .then((response) => response.json())
      .then((data) => {
        setVehicles(data);
      })
      .catch((error) => {
        console.log('Error fetching vehicles:', error);
      });
  }, []);

  const startAnimation = () => {
    setIsAnimating(true);
    animateMarkers();
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    cancelAnimationFrameRequests();
    markersRef.current.forEach((marker, index) => {
      const { locations } = vehicles[index];
      const lastCoordinate = locations[locations.length - 1];
      if (marker) {
        marker.setLatLng([lastCoordinate.latitude, lastCoordinate.longitude]);
      }
    });
  };

  const animateMarkers = () => {
    cancelAnimationFrameRequests();

    vehicles.forEach((vehicle, index) => {
      const { locations } = vehicle;
      const numCoordinates = locations.length;
      const marker = markersRef.current[index];

      if (numCoordinates > 1 && marker) {
        let currentIndex = 0;
        let startTime = performance.now();
        const duration = 4000;

        const animateMarker = (timestamp) => {
          const elapsedTime = timestamp - startTime;
          let progress = elapsedTime / duration;
        
          if (progress >= 1) {
            currentIndex = (currentIndex + 1) % numCoordinates;
            startTime = timestamp;
            progress = 0;
          }
        
          const currentIndexFloor = Math.floor(currentIndex);
          const nextIndex = (currentIndexFloor + 1) % numCoordinates;
          const remainder = currentIndex - currentIndexFloor;
        
          const currentCoordinate = locations[currentIndexFloor];
          const nextCoordinate = locations[nextIndex];
        
          const interpolatedLatLng = interpolateLatLng(
            L.latLng(currentCoordinate.latitude, currentCoordinate.longitude),
            L.latLng(nextCoordinate.latitude, nextCoordinate.longitude),
            progress
          );
        
          marker.setLatLng(interpolatedLatLng);
        
          const popupContent = document.createElement('div');
          popupContent.textContent = currentCoordinate.soc;
        
          marker.getPopup().setContent(popupContent);
        
          animationFrameIdsRef.current[index] = requestAnimationFrame(animateMarker);
        };
        animationFrameIdsRef.current[index] = requestAnimationFrame(animateMarker);
      }
    });
  };

  const cancelAnimationFrameRequests = () => {
    animationFrameIdsRef.current.forEach((id) => cancelAnimationFrame(id));
    animationFrameIdsRef.current = [];
  };

  const interpolateLatLng = (start, end, progress) => {
    const lat = start.lat + (end.lat - start.lat) * progress;
    const lng = start.lng + (end.lng - start.lng) * progress;
    return L.latLng(lat, lng);
  };

  return (
    <div>
      <MapContainer center={[12.983693457, 77.603524403]} zoom={13} style={{ height: '1000px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="Map data © OpenStreetMap contributors" />
        {vehicles.map((vehicle, index) => {
          const { locations } = vehicle;
          const routeCoordinates = locations.map(({ latitude, longitude }) => [latitude, longitude]);

          const startMarker = locations.length > 0 ? (
            <Marker
              position={[locations[0].latitude, locations[0].longitude]}
              icon={customIcon}
              ref={(ref) => (markersRef.current[index] = ref)}
            >
              <Popup>{locations[0].soc}</Popup>
            </Marker>
          ) : null;

          const endMarker = locations.length > 0 ? (
            <Marker
              position={[
                locations[locations.length - 1].latitude,
                locations[locations.length - 1].longitude,
              ]}
              icon={customIcon}
              ref={(ref) => (markersRef.current[index] = ref)}
            >
              <Popup>{locations[locations.length - 1].soc}</Popup>
            </Marker>
          ) : null;

          let currentIndexFloor = 0;
          if (isAnimating && markersRef.current[index]) {
            currentIndexFloor = Math.floor(markersRef.current[index].options.zIndexOffset);
          }

          const movingMarker = locations.length > 0 && locations.length > 1 ? (
            <Marker
              position={[
                locations[currentIndexFloor].latitude,
                locations[currentIndexFloor].longitude,
              ]}
              icon={customIcon}
              ref={(ref) => (markersRef.current[index] = ref)}
              eventHandlers={{
                mouseover: () => {
                  markersRef.current[index]?.openPopup();
                },
                mouseout: () => {
                  markersRef.current[index]?.closePopup();
                },
              }}
            >
              <Popup>{locations[currentIndexFloor].soc}</Popup>
            </Marker>
          ) : null;
          

          return (
            <React.Fragment key={index}>
              {startMarker}
              {endMarker}
              <Polyline positions={routeCoordinates} color="blue" />
              {movingMarker}
            </React.Fragment>
          );
        })}
      </MapContainer>
      <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '4px', zIndex: '1000', border: '1px solid black' }}>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Route Distance: 30km</p>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Start Location:</p>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>End Location:</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
        {!isAnimating && (
          <button
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#f44336',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={startAnimation}
          >
            Start
          </button>
        )}
        {isAnimating && (
          <button
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#f44336',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={stopAnimation}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
};

export default Map;








