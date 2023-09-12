import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import customIcon from './pin.jpg'; // Replace with your custom icon image
import animatedIcon from './car2.png'; // Replace with your animated icon image
import GeoJSONData from './GeoJSON';
import axios from 'axios';
import yellowCar from './yellow_car2.png';
import redCar from './red_car2.png';

const customIconConfig = L.icon({
  iconUrl: customIcon,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const googleMapsApiKey = 'YOUR_GOOGLE_MAPS_API_KEY';

const NewMap = () => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAnimatedIconVisible, setIsAnimatedIconVisible] = useState(false); // Add this state
  const markersRef = useRef([]);
  const animationFrameIdsRef = useRef([]);
  const vehicleDataMap = new Map();

  GeoJSONData.features.forEach((feature) => {
    const vehicleId = feature.properties.vehicle_id;
    if (!vehicleDataMap.has(vehicleId)) {
      vehicleDataMap.set(vehicleId, []);
    }
    vehicleDataMap.get(vehicleId).push(feature);
  });

  const startMarkers = [];
  const endMarkers = [];
  const animatedMarkers = [];

  vehicleDataMap.forEach((vehicleData, vehicleId) => {
    const startLocation = vehicleData[0].geometry.coordinates;
    const endLocation = vehicleData[vehicleData.length - 1].geometry.coordinates;

    startMarkers.push(
      <Marker
        key={`start-${vehicleId}`}
        position={[startLocation[1], startLocation[0]]}
        icon={customIconConfig}
      >
        <Tooltip direction="top" offset={[0, -16]}>
          Start of Vehicle ID: {vehicleId}
        </Tooltip>
      </Marker>
    );

    endMarkers.push(
      <Marker
        key={`end-${vehicleId}`}
        position={[endLocation[1], endLocation[0]]}
        icon={customIconConfig}
      >
        <Tooltip direction="top" offset={[0, -16]}>
          End of Vehicle ID: {vehicleId}
        </Tooltip>
      </Marker>
    );

    const marker = (
      <Marker
        key={`animated-${vehicleId}`}
        position={[startLocation[1], startLocation[0]]}
        ref={(ref) => (markersRef.current[vehicleId] = ref)}
        icon={L.divIcon({ className: 'hidden-icon' })} // Initially hidden
      >
        <Tooltip direction="top" offset={[0, -16]} permanent={false}>
          Animated Marker for Vehicle ID: {vehicleId}
        </Tooltip>
      </Marker>
    );

    animatedMarkers.push(marker);
  });

  const polylines = Array.from(vehicleDataMap.values()).map((vehicleData) => {
    const coordinates = vehicleData.map((data) => data.geometry.coordinates);
    return coordinates.map(([longitude, latitude]) => [latitude, longitude]);
  });

  const getSnappedCoordinates = async (coordinates) => {
    try {
      const response = await axios.get(
        `https://roads.googleapis.com/v1/snapToRoads?path=${coordinates.join('|')}&interpolate=true&key=${googleMapsApiKey}`
      );

      if (response.data && response.data.snappedPoints) {
        return response.data.snappedPoints.map((point) => [point.location.latitude, point.location.longitude]);
      }

      return coordinates;
    } catch (error) {
      console.error('Error fetching snapped coordinates:', error);
      return coordinates;
    }
  };

  const animateMarkers = async () => {
    setIsAnimatedIconVisible(true); // Show the animated icon when animation starts
    cancelAnimationFrameRequests();

    vehicleDataMap.forEach(async (vehicleData, vehicleId) => {
      const marker = markersRef.current[vehicleId];

      if (marker) {
        let currentIndex = 0;
        let startTime = performance.now();
        const duration = 4000;

        const coordinates = vehicleData.map((data) => data.geometry.coordinates);
        const snappedCoordinates = await getSnappedCoordinates(coordinates);

        const animateMarker = (timestamp) => {
          const elapsedTime = timestamp - startTime;
          let progress = elapsedTime / duration;

          if (progress >= 1) {
            currentIndex = (currentIndex + 1) % snappedCoordinates.length;
            startTime = timestamp;
            progress = 0;
          }

          const currentIndexFloor = Math.floor(currentIndex);
          const nextIndex = (currentIndexFloor + 1) % snappedCoordinates.length;
          const remainder = currentIndex - currentIndexFloor;

          const currentCoordinate = snappedCoordinates[currentIndexFloor];
          const nextCoordinate = snappedCoordinates[nextIndex];

          const interpolatedLatLng = interpolateLatLng(
            L.latLng(currentCoordinate[1], currentCoordinate[0]),
            L.latLng(nextCoordinate[1], nextCoordinate[0]),
            progress
          );

          marker.setLatLng(interpolatedLatLng);

          const soc = vehicleData[currentIndexFloor].properties.soc;
          let currentIconUrl = 'default_car_icon.png';

          if (soc > 90) {
            currentIconUrl = animatedIcon; // Replace with the URL of your green icon image
          } else if (soc > 70) {
            currentIconUrl = yellowCar; // Replace with the URL of your yellow icon image
          } else {
            currentIconUrl = redCar; // Replace with the URL of your red icon image
          }

          marker.setIcon(
            L.icon({
              iconUrl: currentIconUrl,
              iconSize: [32, 40],
              iconAnchor: [16, 32],
            })
          );

          const tooltipContent = document.createElement('div');
          tooltipContent.innerHTML = `
            Vehicle ID: ${vehicleId}<br />
            SOC: ${soc}%
          `;
          marker.getTooltip().setContent(tooltipContent);

          animationFrameIdsRef.current[vehicleId] = requestAnimationFrame(animateMarker);
        };
        animationFrameIdsRef.current[vehicleId] = requestAnimationFrame(animateMarker);
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

  const startAnimation = () => {
    setIsAnimating(true);
    animateMarkers();
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    setIsAnimatedIconVisible(false); // Hide the animated icon when animation stops
    cancelAnimationFrameRequests();
    markersRef.current.forEach((marker, vehicleId) => {
      const vehicleData = vehicleDataMap.get(vehicleId);
      const endLocation = vehicleData[vehicleData.length - 1].geometry.coordinates;
      if (marker) {
        marker.setLatLng([endLocation[1], endLocation[0]]);
      }
    });
  };

  return (
    <div>
      <h1>Map with React and Leaflet</h1>
      <MapContainer
        center={[12.984, 77.603]}
        zoom={15}
        style={{ height: '900px', width: '100%' }}
      >
        <style>
          {`
            .hidden-icon {
              display: ${isAnimatedIconVisible ? 'block' : 'none'};
            }
          `}
        </style>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {startMarkers}
        {endMarkers}
        {animatedMarkers}
        {polylines.map((line, index) => (
          <Polyline key={index} positions={line} color="blue" />
        ))}
      </MapContainer>
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

export default NewMap;