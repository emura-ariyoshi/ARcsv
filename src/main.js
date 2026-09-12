import './style.css';
import { parseCsv, fetchCsvFromUrl } from './ar-utils.js';

const elements = {
  camera: document.querySelector('#camera'),
  scene: document.querySelector('#ar-scene'),
  heading: document.querySelector('#heading-status'),
  location: document.querySelector('#location-status'),
  pointList: document.querySelector('#point-list'),
  startButton: document.querySelector('#start-button'),
  uploadInput: document.querySelector('#csv-upload'),
  sampleButton: document.querySelector('#sample-button'),
};

const state = {
  userLocation: null,
  heading: 0,
  markers: [],
  points: [],
  mediaStream: null,
};

const appState = {
  isStarted: false,
};

function setLocationStatus(text) {
  elements.location.textContent = text;
}

function setHeadingStatus(degrees) {
  elements.heading.textContent = `${Math.round(degrees)}°`;
}

function renderPointList(points) {
  elements.pointList.innerHTML = '';

  if (!points.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span>点がありません</span><span>0</span>';
    elements.pointList.appendChild(li);
    return;
  }

  points.forEach((point) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${point.label}</span><span>${point.distanceKm.toFixed(1)} km</span>`;
    elements.pointList.appendChild(li);
  });
}

function createMarker(point) {
  const marker = document.createElement('div');
  marker.className = 'marker';

  const dot = document.createElement('span');
  dot.className = 'marker-dot';

  const label = document.createElement('span');
  label.className = 'marker-label';
  label.textContent = point.label;

  marker.append(dot, label);
  elements.scene.appendChild(marker);
  return marker;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function bearingBetween(lat1, lon1, lat2, lon2) {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function relativeBearing(targetBearing) {
  const diff = ((targetBearing - state.heading) + 540) % 360 - 180;
  return diff;
}

function updateMarkers() {
  elements.scene.innerHTML = '';

  if (!state.userLocation || !state.points.length) {
    return;
  }

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const maxDistance = 10;

  const enriched = state.points.map((point) => {
    const distanceKm = haversineKm(
      state.userLocation.latitude,
      state.userLocation.longitude,
      point.latitude,
      point.longitude,
    );

    const targetBearing = bearingBetween(
      state.userLocation.latitude,
      state.userLocation.longitude,
      point.latitude,
      point.longitude,
    );

    const diff = relativeBearing(targetBearing);

    return {
      ...point,
      distanceKm,
      diff,
    };
  }).filter((point) => point.distanceKm <= maxDistance && Math.abs(point.diff) <= 70);

  enriched.sort((a, b) => a.distanceKm - b.distanceKm);

  enriched.forEach((point) => {
    const marker = createMarker(point);
    const ratioX = point.diff / 70;
    const ratioY = 1 - Math.min(point.distanceKm / maxDistance, 1);
    const x = viewWidth * 0.5 + ratioX * viewWidth * 0.34;
    const y = viewHeight * 0.5 - ratioY * viewHeight * 0.28;

    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.transform = `translate(-50%, -50%) scale(${0.9 + (1 - point.distanceKm / maxDistance) * 0.6})`;
    marker.classList.add('visible');
  });

  renderPointList(enriched);
}

function onGeoSuccess(position) {
  const { latitude, longitude, heading } = position.coords;
  state.userLocation = { latitude, longitude };
  setLocationStatus(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

  if (typeof heading === 'number' && Number.isFinite(heading)) {
    state.heading = heading;
    setHeadingStatus(heading);
  }

  updateMarkers();
}

function onGeoError(error) {
  console.error(error);
  setLocationStatus('位置許可が必要です');
}

function setCompassHeading(event) {
  const raw =
    typeof event.webkitCompassHeading === 'number'
      ? event.webkitCompassHeading
      : event.alpha;

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return;
  }

  state.heading = (360 - raw) % 360;
  setHeadingStatus(state.heading);
  updateMarkers();
}

async function startCameraAndSensors() {
  if (appState.isStarted) {
    return;
  }

  appState.isStarted = true;
  elements.startButton.textContent = '起動中...';
  setLocationStatus('カメラを起動しています');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });

    state.mediaStream = stream;
    elements.camera.srcObject = stream;
    elements.camera.style.opacity = '1';
    elements.startButton.textContent = 'AR起動中';
    setLocationStatus('カメラ起動中');
  } catch (error) {
    console.error(error);
    elements.startButton.textContent = 'AR開始';
    setLocationStatus('カメラアクセスを許可してください');
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
    });
  }

  window.addEventListener('deviceorientation', setCompassHeading, true);
  window.addEventListener('deviceorientationabsolute', setCompassHeading, true);
}

function loadPoints(points) {
  state.points = points;
  updateMarkers();
  renderPointList([]);
}

function handleCsvText(text) {
  const parsed = parseCsv(text);
  if (!parsed.length) {
    setLocationStatus('CSVの形式が正しくありません');
    return;
  }

  loadPoints(parsed);
}

async function loadSampleData() {
  try {
    const text = await fetchCsvFromUrl('/sample-data.csv');
    handleCsvText(text);
  } catch (error) {
    console.error(error);
    setLocationStatus('サンプルCSVが読み込めません');
  }
}

async function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  handleCsvText(text);
}

window.addEventListener('resize', updateMarkers);

elements.startButton.addEventListener('click', startCameraAndSensors);
elements.sampleButton.addEventListener('click', loadSampleData);
elements.uploadInput.addEventListener('change', handleCsvUpload);

setHeadingStatus(state.heading);
setLocationStatus('待機中');
loadSampleData();
