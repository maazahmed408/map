import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import pin from './pin.jpg';

const customIcon = L.icon({
  iconUrl: pin,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const Map = () => {
  const [coordinates, setCoordinates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const markerRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:8001/locations')
      .then((response) => response.json())
      .then((data) => {
        setCoordinates(data);
        setCurrentIndex(0);
      })
      .catch((error) => {
        console.log('Error fetching coordinates:', error);
      });
  }, []);

  useEffect(() => {
    if (markerRef.current && coordinates.length > 0) {
      const popupContent = L.popup().setContent(`<strong>SoC: ${coordinates[currentIndex].soc}%</strong>`);

      markerRef.current.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -32), // Adjust the offset as needed to position the popup correctly
      }).openPopup();
    }
  }, [coordinates, currentIndex]);

  useEffect(() => {
    let animationFrameId;

    const animateMarker = (timestamp) => {
      const currentCoordinate = coordinates[currentIndex];
      const nextIndex = (currentIndex + 1) % coordinates.length;
      const nextCoordinate = coordinates[nextIndex];

      const progress = (timestamp - startTime) / duration;
      const interpolatedLatLng = interpolateLatLng(
        L.latLng(currentCoordinate.latitude, currentCoordinate.longitude),
        L.latLng(nextCoordinate.latitude, nextCoordinate.longitude),
        progress
      );
      markerRef.current.setLatLng(interpolatedLatLng);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateMarker);
      } else {
        setCurrentIndex(nextIndex);
        startAnimation();
      }
    };

    const startAnimation = () => {
      startTime = performance.now();
      animationFrameId = requestAnimationFrame(animateMarker);
    };

    let startTime;
    const duration = 2000;

    if (isAnimating) {
      startAnimation();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [coordinates, currentIndex, isAnimating]);

  const interpolateLatLng = (start, end, progress) => {
    const lat = start.lat + (end.lat - start.lat) * progress;
    const lng = start.lng + (end.lng - start.lng) * progress;
    return L.latLng(lat, lng);
  };

  const toggleAnimation = () => {
    setIsAnimating((prevIsAnimating) => !prevIsAnimating);
  };

  const routeCoordinates = coordinates.map(({ latitude, longitude }) => [latitude, longitude]);

  const mapInfo = `Total Locations: ${coordinates.length}`;

  return (
    <div>
      <MapContainer center={[12.983693457, 77.603524403]} zoom={13} style={{ height: '1000px', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="Map data © OpenStreetMap contributors" />
        {coordinates.length > 0 && (
          <>
            <Marker
              position={L.latLng(coordinates[0].latitude, coordinates[0].longitude)}
              icon={customIcon}
            />
            <Marker
              position={L.latLng(coordinates[coordinates.length - 1].latitude, coordinates[coordinates.length - 1].longitude)}
              icon={customIcon}
            />
            <Polyline positions={routeCoordinates} color="blue" />
            <Marker
              position={L.latLng(coordinates[currentIndex].latitude, coordinates[currentIndex].longitude)}
              icon={customIcon}
              ref={markerRef}
            />
          </>
        )}
      </MapContainer>
      <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '4px', zIndex: '1000', border: '1px solid black' }}>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Route Distance: 30km</p>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Start Location:</p>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>End Location:</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
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
          className={`animation-button ${isAnimating ? 'pause' : 'start'}`}
          onClick={toggleAnimation}
        >
          {isAnimating ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  );
};

export default Map;