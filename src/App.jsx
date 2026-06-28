import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Camera,
  Download,
  Crosshair,
  Footprints,
  MousePointer2,
  Scissors,
  Undo2,
  Redo2,
  Grid3X3,
  Layers,
  MapPinned,
  Menu,
  Maximize2,
  Minimize2,
  FileDown,
  FileUp,
  FolderOpen,
  RotateCcw,
  RotateCw,
  Settings,
  Trash2,
  Upload,
  X
} from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  MODULE_ASSET_BUCKET,
  MODULE_LIBRARY_ID,
  isSupabaseConfigured,
  supabase
} from "./supabaseClient.js";

const GRID_SIZE = 2;

const DEFAULT_MODULES = [
  { id: "gate-1", name: "Gate 1", footprint: [2, 1], color: "#b66f38", url: "/modules/Gate 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "gate-2", name: "Gate 2", footprint: [2, 1], color: "#b8834f", url: "/modules/Gate 2.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "gate-3", name: "Gate 3", footprint: [2, 1], color: "#a56f44", url: "/modules/Gate 3.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "iwan-1", name: "Iwan 1", footprint: [2, 1], color: "#c79d67", url: "/modules/Iwan 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "iwan-2", name: "Iwan 2", footprint: [2, 1], color: "#c9b08d", url: "/modules/Iwan 2.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "main-1", name: "Main 1", footprint: [2, 2], color: "#d1a46f", url: "/modules/Main 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "main-2", name: "Main 2", footprint: [2, 2], color: "#d4aa78", url: "/modules/Main 2.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "tower-1", name: "Tower 1", footprint: [1, 1], color: "#77513c", url: "/modules/Tower 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "coridor-1", name: "Coridor 1", footprint: [2, 1], color: "#9d7658", url: "/modules/Coridor 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "corner-1", name: "Corner 1", footprint: [1, 1], color: "#c38755", url: "/modules/Corner 1.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "corner-2", name: "Corner 2", footprint: [1, 1], color: "#cf8f4e", url: "/modules/Corner 2.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "corner-3", name: "Corner 3", footprint: [1, 1], color: "#8f5c33", url: "/modules/Corner 3.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "corner-4", name: "Corner 4", footprint: [1, 1], color: "#b58a61", url: "/modules/Corner 4.stl.glb", scale: 1, rotation: [0, 0, 0] },
  { id: "corner-5", name: "Corner 5", footprint: [1, 1], color: "#bfa17a", url: "/modules/Corner 5.stl.glb", scale: 1, rotation: [0, 0, 0] }
];

const STYLES = {
  stone: {
    label: "Stone",
    background: "#dfe7e1",
    ground: "#cfc5b8",
    metalness: 0,
    roughness: 0.9,
    wireframe: false
  },
  clay: {
    label: "Clay",
    background: "#ead6bd",
    ground: "#caa57c",
    metalness: 0,
    roughness: 1,
    wireframe: false
  },
  schematic: {
    label: "Schematic",
    background: "#f4f7fb",
    ground: "#e7edf5",
    metalness: 0,
    roughness: 0.55,
    wireframe: true
  },
  dusk: {
    label: "Dusk",
    background: "#1c2430",
    ground: "#303846",
    metalness: 0.05,
    roughness: 0.75,
    wireframe: false
  },
  heritage: {
    label: "Heritage Export",
    background: "#ceedf8",
    ground: "#beb9b1",
    metalness: 0,
    roughness: 0.88,
    wireframe: false,
    exportLook: true
  }
};

const EXPORT_RENDER_STYLES = {
  conceptual: { label: "Conceptual", mode: "conceptual" },
  hidden: {
    label: "Hidden",
    mode: "hidden",
    colorOverride: "#ffffff",
    metalness: 0,
    roughness: 0.96,
    wireframe: false
  },
  realistic: {
    label: "Realistic",
    mode: "realistic",
    metalness: 0,
    roughness: 0.92,
    wireframe: false,
    realisticLook: true
  }
};

const loader = new GLTFLoader();
const assetCache = new Map();
const MODULE_STORAGE_KEY = "caravansary.modules.v1";
const MODEL_LOCATIONS_STORAGE_KEY = "caravansary.locationModels.v1";
const MODULE_DB_NAME = "caravansary-module-assets";
const MODULE_DB_STORE = "assets";
const EDGE_SNAP_DISTANCE = 1.15;
const LIVE_SNAP_STRENGTH = 0.58;
const EXTERNAL_FACE_TOLERANCE = 0.12;
const EXPORT_QUALITY_OPTIONS = {
  standard: { label: "Standard", scale: 3, maxSide: 6000, shadowMapSize: 4096 },
  high: { label: "High", scale: 4, maxSide: 8192, shadowMapSize: 4096 },
  ultra: { label: "Ultra", scale: 6, maxSide: 10000, shadowMapSize: 8192 }
};
const SECTION_LINE_LENGTH = 120;
const SECTION_LINE_PICK_DISTANCE = 0.45;
const DIMENSION_UNITS = {
  stage: { label: "stage", factor: 1 },
  px: { label: "px", factor: 100 }
};

function getModuleHeight(module) {
  return module.height ?? 1;
}

function darkenHexColor(hex, amount = 0.4) {
  const color = new THREE.Color(hex);
  color.r *= 1 - amount;
  color.g *= 1 - amount;
  color.b *= 1 - amount;
  return `#${color.getHexString()}`;
}

function formatDimensionInput(value, unitKey) {
  const unit = DIMENSION_UNITS[unitKey] ?? DIMENSION_UNITS.stage;
  const converted = value * unit.factor;
  return converted.toFixed(2);
}

function createSectionCutConfigs({ xEnabled, xOffset, yEnabled, yOffset, planEnabled, planHeight }) {
  const cuts = [];
  if (xEnabled) {
    cuts.push({
      key: "x",
      label: "X section",
      type: "vertical",
      normal: new THREE.Vector3(0, 0, 1),
      direction: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0),
      offset: xOffset,
      clippingPlane: new THREE.Plane(new THREE.Vector3(0, 0, -1), xOffset)
    });
  }
  if (yEnabled) {
    cuts.push({
      key: "y",
      label: "Y section",
      type: "vertical",
      normal: new THREE.Vector3(1, 0, 0),
      direction: new THREE.Vector3(0, 0, 1),
      up: new THREE.Vector3(0, 1, 0),
      offset: yOffset,
      clippingPlane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), yOffset)
    });
  }
  if (planEnabled) {
    cuts.push({
      key: "plan",
      label: "Plan cut",
      type: "horizontal",
      normal: new THREE.Vector3(0, 1, 0),
      direction: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 0, 1),
      offset: planHeight,
      clippingPlane: new THREE.Plane(new THREE.Vector3(0, -1, 0), planHeight)
    });
  }
  return cuts;
}

function dimensionInputToStage(value, unitKey, fallback) {
  const unit = DIMENSION_UNITS[unitKey] ?? DIMENSION_UNITS.stage;
  return asNumber(value, fallback * unit.factor) / unit.factor;
}

function getDesiredDimensions(module) {
  if (module.customDimensions) {
    return module.customDimensions;
  }

  const scale = module.scale ?? 1;
  return {
    width: module.footprint[0] * GRID_SIZE * scale,
    length: module.footprint[1] * GRID_SIZE * scale,
    height: getModuleHeight(module) * GRID_SIZE * scale
  };
}

function stripModelExtension(filename) {
  return filename.replace(/\.stl\.glb$/i, "").replace(/\.(glb|gltf)$/i, "");
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadSavedModules() {
  try {
    const saved = window.localStorage.getItem(MODULE_STORAGE_KEY);
    if (!saved) return DEFAULT_MODULES;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_MODULES;
    return parsed;
  } catch {
    return DEFAULT_MODULES;
  }
}

function serializeModulesForStorage(modules) {
  return modules.map((module) => {
    if (module.source !== "upload") return module;
    const storedModule = { ...module };
    delete storedModule.url;
    return storedModule;
  });
}

function openModuleDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = window.indexedDB.open(MODULE_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(MODULE_DB_STORE);
    };
  });
}

async function withModuleStore(mode, callback) {
  const db = await openModuleDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MODULE_DB_STORE, mode);
    const store = transaction.objectStore(MODULE_DB_STORE);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function saveUploadedAsset(assetKey, file) {
  return withModuleStore("readwrite", (store) => store.put(file, assetKey));
}

function loadUploadedAsset(assetKey) {
  return withModuleStore("readonly", (store) => {
    const request = store.get(assetKey);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function clearUploadedAssets() {
  return withModuleStore("readwrite", (store) => store.clear());
}

function getSupabaseAssetUrl(path) {
  if (!supabase || !path) return null;
  return supabase.storage.from(MODULE_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

function getSafeAssetName(name) {
  return name
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function uploadSupabaseModuleAsset(moduleId, file) {
  if (!supabase) return null;
  const path = `${moduleId}/${Date.now()}-${getSafeAssetName(file.name || "module.glb")}`;
  const { error } = await supabase.storage
    .from(MODULE_ASSET_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "model/gltf-binary",
      upsert: true
    });
  if (error) throw error;
  return { path, url: getSupabaseAssetUrl(path) };
}

async function loadSupabaseModuleLibrary() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("module_libraries")
    .select("modules")
    .eq("id", MODULE_LIBRARY_ID)
    .maybeSingle();
  if (error) throw error;
  if (!Array.isArray(data?.modules) || data.modules.length === 0) return null;
  return data.modules.map((module) => {
    if (module.assetPath && !module.url) {
      return { ...module, url: getSupabaseAssetUrl(module.assetPath) };
    }
    return module;
  });
}

async function saveSupabaseModuleLibrary(modules) {
  if (!supabase) return;
  const cloudModules = modules.map((module) => {
    const snapshot = serializeModulesForStorage([module])[0];
    if (snapshot.url?.startsWith("blob:")) {
      delete snapshot.url;
    }
    return snapshot;
  });
  const { error } = await supabase
    .from("module_libraries")
    .upsert(
      {
        id: MODULE_LIBRARY_ID,
        modules: cloudModules,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
  if (error) throw error;
}

function getRuntimeModule(module) {
  if (!module) return module;
  if (module.assetPath && !module.url) {
    return { ...module, url: getSupabaseAssetUrl(module.assetPath) };
  }
  return module;
}

async function getRuntimeModuleWithAsset(module) {
  const runtimeModule = getRuntimeModule(module);
  if (!runtimeModule?.assetKey || runtimeModule.url || runtimeModule.assetPath) {
    return runtimeModule;
  }

  try {
    const blob = await loadUploadedAsset(runtimeModule.assetKey);
    return blob ? { ...runtimeModule, url: URL.createObjectURL(blob) } : runtimeModule;
  } catch {
    return runtimeModule;
  }
}

function loadLocalLocationModels() {
  try {
    const saved = window.localStorage.getItem(MODEL_LOCATIONS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLocationModels(models) {
  window.localStorage.setItem(MODEL_LOCATIONS_STORAGE_KEY, JSON.stringify(models));
}

async function loadSupabaseLocationModels() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("location_models")
    .select("id,name,lat,lon,zoom,design,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function saveSupabaseLocationModel(model) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("location_models")
    .upsert(
      {
        id: model.id,
        name: model.name,
        lat: model.lat,
        lon: model.lon,
        zoom: model.zoom,
        design: model.design,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("id,name,lat,lon,zoom,design,updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function deleteSupabaseLocationModel(modelId) {
  if (!supabase) return;
  const { error } = await supabase
    .from("location_models")
    .delete()
    .eq("id", modelId);
  if (error) throw error;
}

function createModelLocationId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getGoogleSatelliteUrl(lat, lon, zoom) {
  const safeLat = asNumber(lat, 0);
  const safeLon = asNumber(lon, 0);
  const safeZoom = Math.round(THREE.MathUtils.clamp(asNumber(zoom, 18), 1, 21));
  return `https://maps.google.com/maps?q=${safeLat},${safeLon}&z=${safeZoom}&t=k&output=embed`;
}

function getGoogleStaticMapUrl(lat, lon, zoom) {
  const safeLat = asNumber(lat, 0);
  const safeLon = asNumber(lon, 0);
  const safeZoom = Math.round(THREE.MathUtils.clamp(asNumber(zoom, 18), 1, 21));
  const params = new URLSearchParams({
    lat: String(safeLat),
    lon: String(safeLon),
    zoom: String(safeZoom)
  });
  return `/api/static-map?${params.toString()}`;
}

function getGoogleOverviewMapUrl(models, bounds, size) {
  const points = models
    .map((model) => `${asNumber(model.lat, 0)},${asNumber(model.lon, 0)}`)
    .join("|");
  return `/api/overview-map?${new URLSearchParams({
    points,
    lat: String(bounds.centerLat),
    lon: String(bounds.centerLon),
    zoom: String(bounds.zoom),
    width: String(size.width),
    height: String(size.height)
  }).toString()}`;
}

function getTaggedMapBounds(models) {
  const points = models
    .map((model) => ({ lat: asNumber(model.lat, 0), lon: asNumber(model.lon, 0) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (points.length === 0) {
    return {
      minLat: 24,
      maxLat: 42,
      minLon: 44,
      maxLon: 64,
      centerLat: 33,
      centerLon: 54,
      zoom: 5
    };
  }

  let minLat = Math.min(...points.map((point) => point.lat));
  let maxLat = Math.max(...points.map((point) => point.lat));
  let minLon = Math.min(...points.map((point) => point.lon));
  let maxLon = Math.max(...points.map((point) => point.lon));
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.02);
  const lonPad = Math.max((maxLon - minLon) * 0.18, 0.02);
  minLat -= latPad;
  maxLat += latPad;
  minLon -= lonPad;
  maxLon += lonPad;
  const spread = Math.max(maxLat - minLat, maxLon - minLon);
  const zoom = spread > 20 ? 3 : spread > 10 ? 4 : spread > 5 ? 5 : spread > 2 ? 6 : spread > 0.8 ? 8 : 10;

  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
    zoom
  };
}

function getMercatorPoint(lat, lon) {
  const sinLat = Math.sin(THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat, -85, 85)));
  return {
    x: 256 * (0.5 + lon / 360),
    y: 256 * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))
  };
}

function getMapOverviewPinStyle(model, bounds, size) {
  const zoomScale = 2 ** Math.round(THREE.MathUtils.clamp(asNumber(bounds.zoom, 5), 1, 21));
  const center = getMercatorPoint(bounds.centerLat, bounds.centerLon);
  const point = getMercatorPoint(asNumber(model.lat, 0), asNumber(model.lon, 0));
  const x = (point.x - center.x) * zoomScale + size.width / 2;
  const y = (point.y - center.y) * zoomScale + size.height / 2;
  const visible = x >= -24 && x <= size.width + 24 && y >= -24 && y <= size.height + 24;
  return {
    display: visible ? undefined : "none",
    left: `${(x / size.width) * 100}%`,
    top: `${(y / size.height) * 100}%`
  };
}

function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || "model/gltf-binary";
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function getObjectBox(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

function makeVerticalFaceSegment(pointA, pointB) {
  const start = new THREE.Vector2(pointA.x, pointA.z);
  const end = new THREE.Vector2(pointB.x, pointB.z);
  const vector = end.clone().sub(start);
  const length = vector.length();
  if (length <= 0.08) return null;
  const direction = vector.multiplyScalar(1 / length);
  const normal = new THREE.Vector2(-direction.y, direction.x);
  const startProjection = start.dot(direction);
  const endProjection = end.dot(direction);
  return {
    start,
    end,
    direction,
    normal,
    min: Math.min(startProjection, endProjection),
    max: Math.max(startProjection, endProjection)
  };
}

function cross2D(origin, pointA, pointB) {
  return (pointA.x - origin.x) * (pointB.y - origin.y) - (pointA.y - origin.y) * (pointB.x - origin.x);
}

function getConvexHull2D(points) {
  const unique = [];
  points.forEach((point) => {
    if (!unique.some((item) => item.distanceToSquared(point) <= 0.000001)) {
      unique.push(point.clone());
    }
  });
  if (unique.length <= 3) return unique;

  unique.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower = [];
  unique.forEach((point) => {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (upper.length >= 2 && cross2D(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function distanceToSegment2D(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 0.000001) return point.distanceTo(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  return point.distanceTo(start.clone().add(segment.multiplyScalar(t)));
}

function isSegmentOnHull(segment, hull, tolerance = EXTERNAL_FACE_TOLERANCE) {
  if (hull.length < 2) return true;
  const midpoint = segment.start.clone().add(segment.end).multiplyScalar(0.5);
  return hull.some((start, index) => {
    const end = hull[(index + 1) % hull.length];
    const hullDirection = end.clone().sub(start).normalize();
    const parallel = Math.abs(hullDirection.dot(segment.direction));
    return parallel >= 0.96 && distanceToSegment2D(midpoint, start, end) <= tolerance;
  });
}

function getExternalVerticalFaceSegments(segments) {
  if (segments.length <= 4) return segments;
  const hull = getConvexHull2D(segments.flatMap((segment) => [segment.start, segment.end]));
  const external = segments.filter((segment) => isSegmentOnHull(segment, hull));
  return external.length > 0 ? external : segments;
}

function getVisibleVerticalFaceSegments(object) {
  const segments = [];
  const parentInverse = new THREE.Matrix4();
  object.parent?.updateWorldMatrix(true, false);
  if (object.parent) {
    parentInverse.copy(object.parent.matrixWorld).invert();
  }

  const vertexA = new THREE.Vector3();
  const vertexB = new THREE.Vector3();
  const vertexC = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const projected = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    if (
      !child.isMesh ||
      child.userData?.isExportEdge ||
      child.userData?.isSectionCap ||
      !child.visible ||
      !child.geometry?.attributes?.position
    ) {
      return;
    }

    child.updateWorldMatrix(true, false);
    const position = child.geometry.attributes.position;
    const index = child.geometry.index;
    const triangleCount = index ? index.count / 3 : position.count / 3;

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const aIndex = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
      const bIndex = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
      const cIndex = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;

      vertexA.fromBufferAttribute(position, aIndex).applyMatrix4(child.matrixWorld).applyMatrix4(parentInverse);
      vertexB.fromBufferAttribute(position, bIndex).applyMatrix4(child.matrixWorld).applyMatrix4(parentInverse);
      vertexC.fromBufferAttribute(position, cIndex).applyMatrix4(child.matrixWorld).applyMatrix4(parentInverse);

      normal.crossVectors(edgeA.subVectors(vertexB, vertexA), edgeB.subVectors(vertexC, vertexA)).normalize();
      if (!Number.isFinite(normal.x) || Math.abs(normal.y) > 0.18) continue;
      if (Math.max(vertexA.y, vertexB.y, vertexC.y) - Math.min(vertexA.y, vertexB.y, vertexC.y) <= 0.08) continue;

      projected[0].copy(vertexA);
      projected[1].copy(vertexB);
      projected[2].copy(vertexC);
      let bestPair = null;
      [
        [projected[0], projected[1]],
        [projected[1], projected[2]],
        [projected[2], projected[0]]
      ].forEach(([start, end]) => {
        const distance = Math.hypot(start.x - end.x, start.z - end.z);
        if (!bestPair || distance > bestPair.distance) {
          bestPair = { start, end, distance };
        }
      });

      const segment = bestPair ? makeVerticalFaceSegment(bestPair.start, bestPair.end) : null;
      if (segment) segments.push(segment);
    }
  });

  return getExternalVerticalFaceSegments(segments);
}

function getVerticalFaceSnapDelta(movingSegment, targetSegment, maxDistance = EDGE_SNAP_DISTANCE) {
  const parallel = Math.abs(movingSegment.direction.dot(targetSegment.direction));
  if (parallel < 0.985) return null;

  const targetStart = targetSegment.start.dot(movingSegment.direction);
  const targetEnd = targetSegment.end.dot(movingSegment.direction);
  const targetMin = Math.min(targetStart, targetEnd);
  const targetMax = Math.max(targetStart, targetEnd);
  const overlap = Math.min(movingSegment.max, targetMax) - Math.max(movingSegment.min, targetMin);

  const signedDistance = movingSegment.start.clone().sub(targetSegment.start).dot(targetSegment.normal);
  const normalDistance = Math.abs(signedDistance);
  if (normalDistance > maxDistance) return null;

  const edgeAlignmentCandidates = [
    targetMin - movingSegment.min,
    targetMax - movingSegment.max,
    targetMin - movingSegment.max,
    targetMax - movingSegment.min
  ]
    .map((value) => ({ value, distance: Math.abs(value) }))
    .filter((candidate) => candidate.distance <= maxDistance * 0.7)
    .sort((a, b) => a.distance - b.distance);

  const hasFaceContact = overlap > 0.08;
  const bestEdgeAlignment = edgeAlignmentCandidates[0] ?? null;
  if (!hasFaceContact && !bestEdgeAlignment) return null;

  const normalDelta = targetSegment.normal.clone().multiplyScalar(-signedDistance);
  const edgeDelta = bestEdgeAlignment
    ? movingSegment.direction.clone().multiplyScalar(bestEdgeAlignment.value)
    : new THREE.Vector2(0, 0);
  const alignedOverlap = Math.max(0, overlap);
  const edgeDistance = bestEdgeAlignment?.distance ?? maxDistance;
  const score = normalDistance * 0.65 + edgeDistance * 0.12 - alignedOverlap * 0.03;
  return {
    distance: score,
    normalDistance,
    edgeDistance,
    overlap,
    delta: normalDelta.add(edgeDelta)
  };
}

function applyExactDimensions(group, dimensions) {
  group.updateWorldMatrix(true, true);
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  group.scale.set(
    group.scale.x * (dimensions.width / Math.max(size.x, 0.001)),
    group.scale.y * (dimensions.height / Math.max(size.y, 0.001)),
    group.scale.z * (dimensions.length / Math.max(size.z, 0.001))
  );
  group.updateWorldMatrix(true, true);
}

function createRealisticMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: "#c99a67",
    metalness: 0,
    roughness: 0.92
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vRealisticWorldPosition;
varying vec3 vRealisticWorldNormal;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 realisticWorldPosition = modelMatrix * vec4(transformed, 1.0);
vRealisticWorldPosition = realisticWorldPosition.xyz;
vRealisticWorldNormal = normalize(mat3(modelMatrix) * normal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vRealisticWorldPosition;
varying vec3 vRealisticWorldNormal;

float realisticHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float realisticNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = realisticHash(i);
  float b = realisticHash(i + vec2(1.0, 0.0));
  float c = realisticHash(i + vec2(0.0, 1.0));
  float d = realisticHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 realisticNormal = abs(normalize(vRealisticWorldNormal));
float realisticVerticalMask = 1.0 - smoothstep(0.28, 0.56, realisticNormal.y);
vec2 realisticUv = realisticNormal.x > realisticNormal.z ? vRealisticWorldPosition.zy : vRealisticWorldPosition.xy;
realisticUv *= vec2(6.8889, 18.4444);
float realisticRow = floor(realisticUv.y);
realisticUv.x += mod(realisticRow, 2.0) * 0.5;
vec2 realisticCell = fract(realisticUv);
float realisticMortar = step(realisticCell.x, 0.045) + step(0.955, realisticCell.x) + step(realisticCell.y, 0.055) + step(0.945, realisticCell.y);
realisticMortar = clamp(realisticMortar, 0.0, 1.0);
float realisticGrain = realisticNoise(realisticUv * 8.0) * 0.16 + realisticNoise(realisticUv * 23.0) * 0.06;
float realisticStrata = sin((realisticUv.y + realisticNoise(realisticUv * 1.2)) * 18.0) * 0.035;
float realisticEdgeWear = smoothstep(0.0, 0.16, min(min(realisticCell.x, 1.0 - realisticCell.x), min(realisticCell.y, 1.0 - realisticCell.y)));
vec3 realisticBrick = vec3(0.78, 0.54, 0.32) + realisticGrain + realisticStrata;
realisticBrick = mix(realisticBrick * 0.84, realisticBrick, realisticEdgeWear);
vec3 realisticJoint = vec3(0.50, 0.42, 0.33);
vec2 realisticTopUv = vRealisticWorldPosition.xz * 4.2;
float realisticTopGrain = realisticNoise(realisticTopUv * 4.0) * 0.045 + realisticNoise(realisticTopUv * 14.0) * 0.025;
float realisticTopStrata = sin((realisticTopUv.x + realisticNoise(realisticTopUv * 0.8)) * 12.0) * 0.008;
vec3 realisticTopSurface = vec3(1.26, 1.18, 1.02) + realisticTopGrain + realisticTopStrata;
vec3 realisticVerticalSurface = mix(realisticBrick, realisticJoint, realisticMortar * 0.72);
diffuseColor.rgb *= mix(realisticTopSurface, realisticVerticalSurface, realisticVerticalMask);`
      );
  };
  material.customProgramCacheKey = () => "caravansary-realistic-masonry-v3";
  return material;
}

function createRealisticGroundMaterial(baseColor = "#beb9b1") {
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: 0,
    roughness: 0.98
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vSoilWorldPosition;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vSoilWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vSoilWorldPosition;

float soilHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.23, 289.71))) * 39142.349);
}

float soilNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = soilHash(i);
  float b = soilHash(i + vec2(1.0, 0.0));
  float c = soilHash(i + vec2(0.0, 1.0));
  float d = soilHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 soilUv = vSoilWorldPosition.xz * 3.2;
float soilFine = soilNoise(soilUv * 10.0) * 0.13;
float soilCoarse = soilNoise(soilUv * 2.0) * 0.18;
float soilRidges = sin((soilUv.x + soilNoise(soilUv * 0.55)) * 16.0) * 0.035;
vec3 soilA = vec3(0.56, 0.47, 0.36);
vec3 soilB = vec3(0.72, 0.63, 0.49);
diffuseColor.rgb *= mix(soilA, soilB, soilCoarse + soilFine) + soilRidges;`
      );
  };
  material.customProgramCacheKey = () => "caravansary-realistic-soil-v1";
  return material;
}

function createMaterial(module, style) {
  if (style.mode === "hidden") {
    return new THREE.MeshBasicMaterial({
      color: style.colorOverride
    });
  }

  if (style.mode === "realistic") {
    return createRealisticMaterial(module);
  }

  if (style.exportLook) {
    return new THREE.MeshStandardMaterial({
      color: module.color,
      metalness: 0,
      roughness: 0.72
    });
  }

  const material = new THREE.MeshStandardMaterial({
    color: style.wireframe ? "#255b8f" : module.color,
    metalness: style.metalness,
    roughness: style.roughness,
    wireframe: style.wireframe
  });
  return material;
}

function setObjectMaterialSide(root, side) {
  const previous = [];
  root.traverse((child) => {
    if (!child.isMesh || child.userData?.isExportEdge) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      previous.push({ material, side: material.side });
      material.side = side;
      material.needsUpdate = true;
    });
  });
  return previous;
}

function restoreMaterialSides(previous) {
  previous.forEach(({ material, side }) => {
    material.side = side;
    material.needsUpdate = true;
  });
}

function setObjectClippingPlanes(root, planes) {
  const previous = [];
  root.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      previous.push({
        material,
        clippingPlanes: material.clippingPlanes,
        clipIntersection: material.clipIntersection,
        clipShadows: material.clipShadows
      });
      material.clippingPlanes = planes;
      material.clipIntersection = false;
      material.clipShadows = true;
      material.needsUpdate = true;
    });
  });
  return previous;
}

function restoreObjectClippingPlanes(previous) {
  previous.forEach(({ material, clippingPlanes, clipIntersection, clipShadows }) => {
    material.clippingPlanes = clippingPlanes;
    material.clipIntersection = clipIntersection;
    material.clipShadows = clipShadows;
    material.needsUpdate = true;
  });
}

function clearSectionCaps(group) {
  if (!group) return;
  group.children.forEach((child) => {
    child.geometry?.dispose();
    child.material?.dispose();
  });
  group.clear();
}

function getPlaneTriangleIntersection(a, b, c, normal, offset) {
  const vertices = [a, b, c];
  const distances = vertices.map((vertex) => normal.dot(vertex) - offset);
  const points = [];
  const addPoint = (point) => {
    const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
    if (!points.some((item) => item.key === key)) {
      points.push({ key, point });
    }
  };

  for (let index = 0; index < 3; index += 1) {
    const nextIndex = (index + 1) % 3;
    const start = vertices[index];
    const end = vertices[nextIndex];
    const startDistance = distances[index];
    const endDistance = distances[nextIndex];

    if (Math.abs(startDistance) < 0.00001) {
      addPoint(start.clone());
    }
    if (Math.abs(endDistance) < 0.00001) {
      addPoint(end.clone());
    }
    if (startDistance * endDistance < 0) {
      const t = startDistance / (startDistance - endDistance);
      addPoint(start.clone().lerp(end, t));
    }
  }

  if (points.length < 2) return null;
  return [points[0].point, points[1].point];
}

function getConvexHull(points) {
  const unique = Array.from(
    new Map(points.map((point) => [`${point.x.toFixed(4)},${point.y.toFixed(4)}`, point])).values()
  ).sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 2) return unique;

  const cross = (origin, a, b) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const lower = [];
  unique.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  });
  const upper = [];
  [...unique].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function createHatchSegmentsForPolygon(points, matrix) {
  const positions = [];
  if (points.length < 3) return positions;

  const hatchDirection = new THREE.Vector2(1, 1).normalize();
  const hatchNormal = new THREE.Vector2(-hatchDirection.y, hatchDirection.x);
  const projections = points.map((point) => hatchNormal.dot(point));
  const minProjection = Math.min(...projections);
  const maxProjection = Math.max(...projections);
  const spacing = 0.09;

  for (let projection = minProjection + spacing * 0.5; projection <= maxProjection; projection += spacing) {
    const intersections = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      const pointDistance = hatchNormal.dot(point) - projection;
      const nextDistance = hatchNormal.dot(next) - projection;
      if (pointDistance === 0) {
        intersections.push(hatchDirection.dot(point));
      }
      if (pointDistance * nextDistance < 0) {
        const t = pointDistance / (pointDistance - nextDistance);
        const intersection = {
          x: point.x + (next.x - point.x) * t,
          y: point.y + (next.y - point.y) * t
        };
        intersections.push(hatchDirection.dot(intersection));
      }
    });
    intersections.sort((a, b) => a - b);
    for (let index = 0; index < intersections.length - 1; index += 2) {
      const start2 = hatchDirection.clone().multiplyScalar(intersections[index]).addScaledVector(hatchNormal, projection);
      const end2 = hatchDirection.clone().multiplyScalar(intersections[index + 1]).addScaledVector(hatchNormal, projection);
      const start = new THREE.Vector3(start2.x, start2.y, 0).applyMatrix4(matrix);
      const end = new THREE.Vector3(end2.x, end2.y, 0).applyMatrix4(matrix);
      positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    }
  }

  return positions;
}

function buildSectionLoops(segments) {
  const unused = segments.map((segment, index) => ({ ...segment, index }));
  const loops = [];
  const stitchDistance = 0.12;
  const stitchDistanceSq = stitchDistance * stitchDistance;
  const distanceSq2 = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  const polygonArea = (points) =>
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0) / 2
    );

  while (unused.length > 0) {
    const first = unused.shift();
    const loop = [first.a, first.b];
    const startPoint = first.a;
    let currentPoint = first.b;

    while (unused.length > 0 && distanceSq2(currentPoint, startPoint) > stitchDistanceSq) {
      let nextIndex = -1;
      let nextPoint = null;
      let bestDistance = stitchDistanceSq;
      unused.forEach((segment, index) => {
        const distanceToA = distanceSq2(currentPoint, segment.a);
        if (distanceToA <= bestDistance) {
          nextIndex = index;
          nextPoint = segment.b;
          bestDistance = distanceToA;
        }
        const distanceToB = distanceSq2(currentPoint, segment.b);
        if (distanceToB <= bestDistance) {
          nextIndex = index;
          nextPoint = segment.a;
          bestDistance = distanceToB;
        }
      });
      if (nextIndex === -1) break;
      unused.splice(nextIndex, 1);
      loop.push(nextPoint);
      currentPoint = nextPoint;
    }

    if (loop.length >= 3 && distanceSq2(currentPoint, startPoint) <= stitchDistanceSq && polygonArea(loop) > 0.002) {
      loops.push(loop);
    }
  }

  return loops;
}

function rebuildSectionCapsForCut({ capGroup, placedItems, cut }) {
  if (!capGroup) return;
  const normal = cut.normal.clone().normalize();
  const direction = cut.direction.clone().normalize();
  const up = cut.up.clone().normalize();
  const offset = cut.offset;
  const planePoint = normal.clone().multiplyScalar(offset);
  const matrix = new THREE.Matrix4().makeBasis(direction, up, normal).setPosition(planePoint);
  const outlinePositions = [];
  const hatchPositions = [];
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: "#928f8f",
    side: THREE.DoubleSide,
    depthTest: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const maxSegments = 9000;

  placedItems.forEach((item) => {
    item.mesh.updateWorldMatrix(true, true);
    item.mesh.traverse((child) => {
      if (!child.isMesh || child.userData?.isExportEdge || child.userData?.isSectionCap) return;
      const geometry = child.geometry;
      const position = geometry?.attributes?.position;
      if (!position) return;

      const index = geometry.index;
      const triangleCount = index ? index.count / 3 : position.count / 3;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const sectionSegments = [];

      for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
        if (outlinePositions.length / 6 > maxSegments) return;
        const i0 = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
        const i1 = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
        const i2 = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
        a.fromBufferAttribute(position, i0).applyMatrix4(child.matrixWorld);
        b.fromBufferAttribute(position, i1).applyMatrix4(child.matrixWorld);
        c.fromBufferAttribute(position, i2).applyMatrix4(child.matrixWorld);

        const intersection = getPlaneTriangleIntersection(a, b, c, normal, offset);
        if (!intersection) continue;
        const [start, end] = intersection;
        if (start.distanceToSquared(end) < 0.0001) continue;
        outlinePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
        sectionSegments.push({
          a: {
            x: direction.dot(start.clone().sub(planePoint)),
            y: up.dot(start.clone().sub(planePoint))
          },
          b: {
            x: direction.dot(end.clone().sub(planePoint)),
            y: up.dot(end.clone().sub(planePoint))
          }
        });
      }

      buildSectionLoops(sectionSegments).forEach((loop) => {
        const polygon = loop.length >= 3 ? loop : getConvexHull(loop);
        if (polygon.length < 3) return;
        const shape = new THREE.Shape(polygon.map((point) => new THREE.Vector2(point.x, point.y)));
        const fillGeometry = new THREE.ShapeGeometry(shape);
        fillGeometry.applyMatrix4(matrix);
        const fill = new THREE.Mesh(fillGeometry, fillMaterial.clone());
        fill.renderOrder = 20;
        fill.userData.isSectionCap = true;
        capGroup.add(fill);
        hatchPositions.push(...createHatchSegmentsForPolygon(polygon, matrix));
      });
    });
  });

  if (outlinePositions.length > 0) {
    const outlineGeometry = new THREE.BufferGeometry();
    outlineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(outlinePositions, 3));
    const outline = new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: "#070707", depthTest: false })
    );
    outline.renderOrder = 22;
    outline.userData.isSectionCap = true;
    capGroup.add(outline);
  }

  if (hatchPositions.length > 0) {
    const hatchGeometry = new THREE.BufferGeometry();
    hatchGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hatchPositions, 3));
    const hatch = new THREE.LineSegments(
      hatchGeometry,
      new THREE.LineBasicMaterial({ color: "#424040", depthTest: false})
    );
    hatch.renderOrder = 21;
    hatch.userData.isSectionCap = true;
    capGroup.add(hatch);
  }

  fillMaterial.dispose();
}

function rebuildSectionCaps({ capGroup, placedItems, cuts }) {
  if (!capGroup) return;
  clearSectionCaps(capGroup);
  cuts.forEach((cut) => {
    rebuildSectionCapsForCut({ capGroup, placedItems, cut });
  });
}

function removeExportEdges(root) {
  const edgeObjects = [];
  root.traverse((child) => {
    if (child.userData?.isExportEdge) {
      edgeObjects.push(child);
    }
  });
  edgeObjects.forEach((edge) => {
    edge.parent?.remove(edge);
    edge.geometry?.dispose();
    edge.material?.dispose();
  });
}

function applyExportEdges(root, style, edgeOptions = {}) {
  removeExportEdges(root);
  const color = edgeOptions.color ?? "#005aa0";
  const thickness = edgeOptions.thickness ?? (style.exportLook ? 1 : 0);
  if (thickness <= 0) return;

  const yAxis = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const radius = Math.max(0.006, thickness * 0.012);

  root.traverse((child) => {
    if (!child.isMesh || child.userData?.isExportEdge || !child.geometry) return;
    const edgeGeometry = new THREE.EdgesGeometry(child.geometry, 24);
    const positions = edgeGeometry.attributes.position;
    const edgeCount = Math.floor(positions.count / 2);
    if (edgeCount === 0) {
      edgeGeometry.dispose();
      return;
    }

    const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    const material = new THREE.MeshBasicMaterial({
      color,
      depthTest: true,
      depthWrite: false
    });
    const edges = new THREE.InstancedMesh(cylinderGeometry, material, edgeCount);

    for (let index = 0; index < edgeCount; index += 1) {
      start.fromBufferAttribute(positions, index * 2);
      end.fromBufferAttribute(positions, index * 2 + 1);
      direction.subVectors(end, start);
      const length = direction.length();
      if (length <= 0.00001) {
        scale.set(0, 0, 0);
        matrix.compose(start, quaternion.identity(), scale);
        edges.setMatrixAt(index, matrix);
        continue;
      }
      midpoint.addVectors(start, end).multiplyScalar(0.5);
      quaternion.setFromUnitVectors(yAxis, direction.normalize());
      scale.set(radius, length, radius);
      matrix.compose(midpoint, quaternion, scale);
      edges.setMatrixAt(index, matrix);
    }

    edges.instanceMatrix.needsUpdate = true;
    edgeGeometry.dispose();
    edges.userData.isExportEdge = true;
    edges.renderOrder = 8;
    child.add(edges);
  });
}

function updateExportEdgeResolution(root, width, height) {
  if (!root) return;
  root.traverse((child) => {
    if (child.userData?.isExportEdge && child.material?.isLineMaterial) {
      child.material.resolution.set(Math.max(1, width), Math.max(1, height));
    }
  });
}

function setExportEdgesVisible(root, visible) {
  if (!root) return;
  root.traverse((child) => {
    if (child.userData?.isExportEdge) {
      child.visible = visible;
    }
  });
}

function markSceneMaterialsForUpdate(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      material.needsUpdate = true;
    });
  });
}

function cloneAsset(source) {
  const clone = source.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return clone;
}

function createAnchoredAsset(model, module) {
  const box = new THREE.Box3().setFromObject(model);
  const pivot = new THREE.Group();
  const anchor = new THREE.Vector3(box.min.x, box.min.y, box.min.z);

  model.position.set(-anchor.x, -anchor.y, -anchor.z);
  pivot.scale.setScalar(module.scale ?? 1);
  pivot.rotation.set(
    THREE.MathUtils.degToRad(module.rotation?.[0] ?? 0),
    THREE.MathUtils.degToRad(module.rotation?.[1] ?? 0),
    THREE.MathUtils.degToRad(module.rotation?.[2] ?? 0)
  );
  pivot.add(model);
  return pivot;
}

function applyStyleToAsset(group, module, style) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.userData.originalColor && child.material?.color) {
      child.userData.originalColor = child.material.color.clone();
    }
    child.material = createMaterial(module, style);
  });
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
}

async function createAssetModuleMesh(module, style) {
  if (!assetCache.has(module.url)) {
    assetCache.set(module.url, loader.loadAsync(module.url));
  }
  const gltf = await assetCache.get(module.url);
  const group = new THREE.Group();
  const model = cloneAsset(gltf.scene);
  applyStyleToAsset(model, module, style);
  group.add(createAnchoredAsset(model, module));
  if (module.customDimensions) {
    applyExactDimensions(group, module.customDimensions);
  }
  applyExportEdges(group, style);
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  group.userData = {
    moduleId: module.id,
    width: size.x,
    depth: size.z
  };
  return group;
}

function addBox(group, module, style, width, depth, height, y = height / 2) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, createMaterial(module, style));
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createPlaceholderModuleMesh(module, style) {
  const group = new THREE.Group();
  const width = module.footprint[0] * GRID_SIZE;
  const depth = module.footprint[1] * GRID_SIZE;
  const height = getModuleHeight(module) * GRID_SIZE;

  addBox(group, module, style, width, depth, height);

  if (module.id.includes("tower") || module.id === "watch-post") {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.55, width * 0.72, height * 0.35, 8),
      createMaterial(module, style)
    );
    cap.position.y = height + height * 0.18;
    cap.castShadow = true;
    group.add(cap);
  }

  if (module.id.includes("portal") || module.id === "gatehouse") {
    addBox(group, module, style, width * 0.32, depth * 1.04, height * 0.62, height * 0.31);
    addBox(group, module, style, width * 0.32, depth * 1.04, height * 0.62, height * 0.31).position.x =
      width * 0.34;
    group.children[group.children.length - 2].position.x = -width * 0.34;
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.22, width * 0.22, depth * 1.06, 24, 1, false, 0, Math.PI),
      createMaterial(module, style)
    );
    arch.rotation.x = Math.PI / 2;
    arch.position.y = height * 0.66;
    arch.castShadow = true;
    group.add(arch);
  }

  if (module.id === "fountain" || module.id === "cistern") {
    group.clear();
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.38, width * 0.48, height, 28),
      createMaterial(module, style)
    );
    bowl.position.y = height / 2;
    bowl.castShadow = true;
    group.add(bowl);
  }

  if (module.id === "colonnade" || module.id === "loggia") {
    for (let i = -1; i <= 1; i += 1) {
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, height * 0.78, 14),
        createMaterial(module, style)
      );
      column.position.set(i * width * 0.3, height * 0.39, -depth * 0.24);
      column.castShadow = true;
      group.add(column);
    }
  }

  if (module.customDimensions) {
    applyExactDimensions(group, module.customDimensions);
  }
  applyExportEdges(group, style);
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  group.userData = {
    moduleId: module.id,
    width: size.x,
    depth: size.z
  };
  return group;
}

function getModuleInitials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getModuleThumbnail(module) {
  if (module.thumbnailUrl) return module.thumbnailUrl;
  const label = getModuleInitials(module.name);
  const color = module.color;
  const dark = "#26353a";
  const light = "#f8fbf8";
  const name = module.name.toLowerCase();
  const base = `<path d="M8 37 32 24l24 13-24 13z" fill="${dark}" opacity=".13"/>`;
  const block = `<path d="M13 23 32 12l19 11-19 11z" fill="${color}"/><path d="M13 23v13l19 11V34z" fill="${color}" opacity=".72"/><path d="M51 23v13L32 47V34z" fill="${color}" opacity=".92"/>`;
  const longBlock = `<path d="M8 25 31 12l25 14-23 13z" fill="${color}"/><path d="M8 25v9l25 14v-9z" fill="${color}" opacity=".72"/><path d="M56 26v9L33 48v-9z" fill="${color}" opacity=".92"/>`;
  const tower = `<path d="M22 16 32 10l10 6-10 6z" fill="${color}"/><path d="M22 16v23l10 6V22z" fill="${color}" opacity=".7"/><path d="M42 16v23l-10 6V22z" fill="${color}" opacity=".9"/><path d="M18 14 32 6l14 8-14 8z" fill="${color}" opacity=".82"/>`;
  const gate = `<path d="M11 24 23 17l9 5-12 7z" fill="${color}"/><path d="M41 17 53 24l-9 5-12-7z" fill="${color}"/><path d="M11 24v15l9 5V29z" fill="${color}" opacity=".72"/><path d="M53 24v15l-9 5V29z" fill="${color}" opacity=".92"/><path d="M20 20 32 13l12 7-12 7z" fill="${color}" opacity=".84"/><path d="M25 30c0-6 14-6 14 0v9l-7 4-7-4z" fill="${light}"/>`;
  const corner = `<path d="M13 20 30 10l8 5-10 6 12 7-8 5-20-11z" fill="${color}"/><path d="M13 20v14l19 11V33z" fill="${color}" opacity=".72"/><path d="M40 28v13l-8 4V33z" fill="${color}" opacity=".92"/>`;
  const shape = name.includes("tower")
    ? tower
    : name.includes("gate") || name.includes("iwan")
      ? gate
      : name.includes("coridor")
        ? longBlock
        : name.includes("corner")
          ? corner
          : block;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="56" viewBox="0 0 72 56"><rect width="72" height="56" rx="8" fill="#eef3f0"/><path d="M8 43h56" stroke="#c4cfca" stroke-width="1"/><g transform="translate(4 0)">${base}${shape}</g><text x="36" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#344348">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getModuleThumbnailSignature(module) {
  return JSON.stringify({
    id: module.id,
    name: module.name,
    color: module.color,
    url: module.url,
    scale: module.scale,
    rotation: module.rotation,
    customDimensions: module.customDimensions,
    footprint: module.footprint
  });
}

async function renderModuleTopThumbnail(module, style) {
  const width = 112;
  const height = 84;
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(1.5);
  renderer.setSize(width, height, false);
  renderer.setClearColor("#eef3f0", 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef3f0");
  scene.add(new THREE.AmbientLight("#ffffff", 2.2));
  const light = new THREE.DirectionalLight("#ffffff", 1.2);
  light.position.set(3, 7, 4);
  scene.add(light);

  const mesh = module.url
    ? await createAssetModuleMesh(module, style)
    : createPlaceholderModuleMesh(module, style);
  scene.add(mesh);

  const box = new THREE.Box3().setFromObject(mesh);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const viewHeight = Math.max(size.x, size.z, 1) / 0.78;
    const viewWidth = viewHeight * (width / height);
    const camera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      Math.max(100, size.y + viewHeight * 5)
    );
    camera.position.set(center.x, box.max.y + viewHeight * 2.6, center.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  const dataUrl = canvas.toDataURL("image/png");
  disposeObject(mesh);
  renderer.dispose();
  return dataUrl;
}

function createStageLabel(text, color, options = {}) {
  const width = options.width ?? 192;
  const height = options.height ?? 96;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.font = `900 ${options.fontSize ?? 58}px Inter, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(255, 255, 255, 0.85)";
  context.fillStyle = color;
  context.strokeText(text, width / 2, height / 2);
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.scaleX ?? 2.2, options.scaleY ?? 1.1, 1);
  sprite.renderOrder = 30;
  sprite.userData.isStageMarker = true;
  return sprite;
}

function disposeStageMarkerGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    }
  });
}

function createStageDirectionMarkers() {
  const group = new THREE.Group();
  group.userData.isStageMarker = true;
  const axisLength = 36;
  const axisY = 0.075;

  const xAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, axisY, 0),
      new THREE.Vector3(axisLength, axisY, 0)
    ]),
    new THREE.LineBasicMaterial({ color: "#c9473d", depthTest: true })
  );
  const yAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, axisY, -axisLength),
      new THREE.Vector3(0, axisY, axisLength)
    ]),
    new THREE.LineBasicMaterial({ color: "#226cc8", depthTest: true })
  );
  xAxis.renderOrder = 1;
  yAxis.renderOrder = 1;
  group.add(xAxis, yAxis);

  const xLabel = createStageLabel("X", "#c9473d", { scaleX: 1.25, scaleY: 0.75, fontSize: 62 });
  xLabel.position.set(axisLength + 1.8, 0.75, 0);
  const yLabel = createStageLabel("Y", "#226cc8", { scaleX: 1.25, scaleY: 0.75, fontSize: 62 });
  yLabel.position.set(0, 0.75, axisLength + 1.8);
  const northLabel = createStageLabel("NORTH", "#172024", { scaleX: 3.4, scaleY: 0.92, fontSize: 42 });
  northLabel.position.set(-4.2, 0.82, -axisLength - 1.4);
  const southLabel = createStageLabel("SOUTH", "#172024", { scaleX: 3.4, scaleY: 0.92, fontSize: 42 });
  southLabel.position.set(-4.2, 0.82, axisLength + 1.4);
  group.add(xLabel, yLabel, northLabel, southLabel);

  return group;
}

function createSelectionBoxHelper(color = "#f2c94c") {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Array(72).fill(0), 3));
  const material = new THREE.LineBasicMaterial({ color, depthTest: false });
  const helper = new THREE.LineSegments(geometry, material);
  helper.renderOrder = 20;
  helper.frustumCulled = false;
  return helper;
}

function updateSelectionBoxHelper(helper, object) {
  const box = getObjectBox(object);
  const min = box.min;
  const max = box.max;
  const corners = [
    [min.x, min.y, min.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z],
    [min.x, max.y, max.z]
  ];
  const edges = [
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7
  ];
  const positions = helper.geometry.attributes.position;
  edges.forEach((cornerIndex, index) => {
    positions.setXYZ(index, ...corners[cornerIndex]);
  });
  positions.needsUpdate = true;
  helper.geometry.computeBoundingSphere();
}

export default function App() {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const mapOverviewPreviewCanvasRef = useRef(null);
  const mapOverviewBodyRef = useRef(null);
  const sectionCanvasRef = useRef(null);
  const sceneRef = useRef(null);
  const previewSceneRef = useRef(null);
  const previewRendererRef = useRef(null);
  const previewControlsRef = useRef(null);
  const requestPreviewRenderRef = useRef(() => {});
  const sectionRendererRef = useRef(null);
  const requestSectionRenderRef = useRef(() => {});
  const previewModelRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const requestRenderRef = useRef(() => {});
  const modelGroupRef = useRef(null);
  const ambientLightRef = useRef(null);
  const sunLightRef = useRef(null);
  const sectionLinesRef = useRef({ x: null, y: null });
  const sectionCapGroupRef = useRef(null);
  const builderSectionSidesRef = useRef([]);
  const builderSectionClipsRef = useRef([]);
  const builderLocalClippingRef = useRef(false);
  const walkKeysRef = useRef(new Set());
  const walkAnimationRef = useRef(null);
  const walkHeightRef = useRef(1.65);
  const placedRef = useRef([]);
  const selectedPlacedRef = useRef(null);
  const selectedPlacedIdsRef = useRef([]);
  const selectionHelpersRef = useRef(new Map());
  const lastModuleRotationRef = useRef(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const floorRef = useRef(null);
  const gridRef = useRef(null);
  const stageMapRef = useRef({ mesh: null, material: null, texture: null });
  const dragRef = useRef({
    active: false,
    object: null,
    itemIds: [],
    startPoint: null,
    startPositions: new Map(),
    historySnapshot: null,
    rotateOnClick: false,
    startX: 0,
    startY: 0,
    moved: false
  });
  const sectionDragRef = useRef(null);
  const fileInputRef = useRef(null);
  const moduleLibraryInputRef = useRef(null);
  const openDesignInputRef = useRef(null);
  const importDesignInputRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const openLocationModelRef = useRef(null);
  const [activeView, setActiveView] = useState("builder");
  const [modules, setModules] = useState(loadSavedModules);
  const [styleKey] = useState("stone");
  const [exportRenderStyle, setExportRenderStyle] = useState("conceptual");
  const [exportBackgroundColor, setExportBackgroundColor] = useState(STYLES.heritage.background);
  const [exportStageColor, setExportStageColor] = useState(STYLES.heritage.ground);
  const [edgeColor, setEdgeColor] = useState("#b28d2a");
  const [edgeThickness, setEdgeThickness] = useState(1);
  const [exportSeamlessSolid, setExportSeamlessSolid] = useState(false);
  const [exportMode, setExportMode] = useState("heritage");
  const [exportFormat, setExportFormat] = useState("png");
  const [exportQuality, setExportQuality] = useState("high");
  const [exportShadows, setExportShadows] = useState(false);
  const [exportObjectShadows, setExportObjectShadows] = useState(false);
  const [sectionXEnabled, setSectionXEnabled] = useState(false);
  const [sectionXOffset, setSectionXOffset] = useState(0);
  const [sectionYEnabled, setSectionYEnabled] = useState(false);
  const [sectionYOffset, setSectionYOffset] = useState(0);
  const [planSectionEnabled, setPlanSectionEnabled] = useState(false);
  const [planSectionHeight, setPlanSectionHeight] = useState(0.5);
  const [walkMode, setWalkMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [modelScale, setModelScale] = useState(1);
  const [placed, setPlaced] = useState([]);
  const [, setSelectedPlaced] = useState(null);
  const [selectedPlacedIds, setSelectedPlacedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [mapGuideOpen, setMapGuideOpen] = useState(false);
  const [mapOverviewOpen, setMapOverviewOpen] = useState(false);
  const [mapOverviewSize, setMapOverviewSize] = useState({ width: 640, height: 360 });
  const [hoveredMapModelId, setHoveredMapModelId] = useState(null);
  const [mapStageVisible, setMapStageVisible] = useState(false);
  const [mobileModulePanelOpen, setMobileModulePanelOpen] = useState(false);
  const [mobileRibbonOpen, setMobileRibbonOpen] = useState(false);
  const [mobileMapPanelOpen, setMobileMapPanelOpen] = useState(false);
  const [mapLat, setMapLat] = useState(35.6892);
  const [mapLon, setMapLon] = useState(51.389);
  const [mapZoom, setMapZoom] = useState(18);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [locationModelName, setLocationModelName] = useState("New site model");
  const [locationModels, setLocationModels] = useState(loadLocalLocationModels);
  const [moduleTopThumbnails, setModuleTopThumbnails] = useState({});
  const [dimensionUnit, setDimensionUnit] = useState("stage");
  const [keepDimensionRatio, setKeepDimensionRatio] = useState(true);
  const [measuredDimensions, setMeasuredDimensions] = useState(null);
  const [selectedModule, setSelectedModule] = useState(DEFAULT_MODULES[0].id);
  const [editingModule, setEditingModule] = useState(DEFAULT_MODULES[0].id);
  const [saveStatus, setSaveStatus] = useState("Loaded");
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  const editing = useMemo(
    () => modules.find((module) => module.id === editingModule) ?? modules[0],
    [editingModule, modules]
  );
  const sortedModules = useMemo(
    () =>
      [...modules].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      ),
    [modules]
  );
  const mapOverviewBounds = useMemo(() => getTaggedMapBounds(locationModels), [locationModels]);
  const hoveredMapModel = useMemo(
    () => locationModels.find((model) => model.id === hoveredMapModelId) ?? null,
    [hoveredMapModelId, locationModels]
  );
  const mapOverviewFallbackUrl = useMemo(
    () => getGoogleOverviewMapUrl(locationModels, mapOverviewBounds, mapOverviewSize),
    [locationModels, mapOverviewBounds, mapOverviewSize]
  );
  const mapOverviewPins = useMemo(
    () =>
      locationModels.map((model) => ({
        model,
        style: getMapOverviewPinStyle(model, mapOverviewBounds, mapOverviewSize)
      })),
    [locationModels, mapOverviewBounds, mapOverviewSize]
  );

  const requestSceneRender = useCallback(() => {
    requestRenderRef.current();
  }, []);

  const requestAdminPreviewRender = useCallback(() => {
    requestPreviewRenderRef.current();
  }, []);

  const requestSectionViewportRender = useCallback(() => {
    requestSectionRenderRef.current();
  }, []);

  const activeSectionCuts = useMemo(
    () =>
      createSectionCutConfigs({
        xEnabled: sectionXEnabled,
        xOffset: sectionXOffset,
        yEnabled: sectionYEnabled,
        yOffset: sectionYOffset,
        planEnabled: planSectionEnabled,
        planHeight: planSectionHeight
      }),
    [
      sectionXEnabled,
      sectionXOffset,
      sectionYEnabled,
      sectionYOffset,
      planSectionEnabled,
      planSectionHeight
    ]
  );
  const primarySectionCut = activeSectionCuts[0] ?? createSectionCutConfigs({
    xEnabled: true,
    xOffset: sectionXOffset,
    yEnabled: false,
    yOffset: 0,
    planEnabled: false,
    planHeight: planSectionHeight
  })[0];

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured) return undefined;

    async function hydrateCloudModules() {
      const cloudModules = await loadSupabaseModuleLibrary();
      if (cancelled || !cloudModules) return;
      setModules(cloudModules);
      setSelectedModule((current) =>
        cloudModules.some((module) => module.id === current) ? current : cloudModules[0].id
      );
      setEditingModule((current) =>
        cloudModules.some((module) => module.id === current) ? current : cloudModules[0].id
      );
      window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(serializeModulesForStorage(cloudModules)));
      setSaveStatus("Cloud loaded");
    }

    hydrateCloudModules().catch(() => setSaveStatus("Cloud load failed"));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLocationModels() {
      const cloudModels = isSupabaseConfigured ? await loadSupabaseLocationModels() : null;
      if (cancelled) return;
      const nextModels = cloudModels ?? loadLocalLocationModels();
      setLocationModels(nextModels);
      if (nextModels[0]) {
        setMapLat(nextModels[0].lat);
        setMapLon(nextModels[0].lon);
        setMapZoom(nextModels[0].zoom ?? 18);
      }
    }

    hydrateLocationModels().catch(() => {
      setLocationModels(loadLocalLocationModels());
      setSaveStatus("Map models local only");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateUploadedModules() {
      const uploadedModules = modules.filter(
        (module) => module.source === "upload" && module.assetKey && !module.url
      );
      if (uploadedModules.length === 0) return;

      const hydrated = await Promise.all(
        uploadedModules.map(async (module) => {
          if (module.assetPath) {
            return { id: module.id, url: getSupabaseAssetUrl(module.assetPath) };
          }
          const blob = await loadUploadedAsset(module.assetKey);
          return blob ? { id: module.id, url: URL.createObjectURL(blob) } : null;
        })
      );

      if (cancelled) {
        hydrated.forEach((item) => {
          if (item?.url) URL.revokeObjectURL(item.url);
        });
        return;
      }

      const hydratedById = new Map(hydrated.filter(Boolean).map((item) => [item.id, item.url]));
      setModules((current) =>
        current.map((module) => {
          const url = hydratedById.get(module.id);
          return url ? { ...module, url } : module;
        })
      );
    }

    hydrateUploadedModules().catch(() => setSaveStatus("Some uploads could not load"));

    return () => {
      cancelled = true;
    };
  }, [modules]);

  useEffect(() => {
    let cancelled = false;
    const style = STYLES[styleKey];

    async function buildTopThumbnails() {
      for (const module of modules) {
        const signature = getModuleThumbnailSignature(module);
        if (cancelled) return;
        if (moduleTopThumbnails[module.id]?.signature === signature) continue;

        try {
          const url = await renderModuleTopThumbnail(module, style);
          if (cancelled) return;
          setModuleTopThumbnails((current) => ({
            ...current,
            [module.id]: { signature, url }
          }));
        } catch {
          if (cancelled) return;
          setModuleTopThumbnails((current) => ({
            ...current,
            [module.id]: { signature, url: getModuleThumbnail(module) }
          }));
        }
      }
    }

    buildTopThumbnails();

    return () => {
      cancelled = true;
    };
  }, [modules, moduleTopThumbnails, styleKey]);

  useEffect(() => {
    const element = mapOverviewBodyRef.current;
    if (!mapOverviewOpen || !element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const maxSide = 640;
      const scale = Math.min(maxSide / rect.width, maxSide / rect.height, 1);
      setMapOverviewSize({
        width: Math.max(240, Math.round(rect.width * scale)),
        height: Math.max(180, Math.round(rect.height * scale))
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mapOverviewOpen]);

  useEffect(() => {
    const canvas = mapOverviewPreviewCanvasRef.current;
    const design = hoveredMapModel?.design;
    if (!canvas || !design || !Array.isArray(design.placed) || design.placed.length === 0) return undefined;

    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef4f0");
    scene.add(new THREE.AmbientLight("#ffffff", 2.4));
    const light = new THREE.DirectionalLight("#ffffff", 1.2);
    light.position.set(4, 8, 6);
    scene.add(light);
    const group = new THREE.Group();
    scene.add(group);

    async function renderHoveredModelPreview() {
      const style = STYLES[styleKey];
      const designModules = await Promise.all((design.modules ?? []).map(getRuntimeModuleWithAsset));
      const designModuleById = new Map(designModules.map((module) => [module.id, module]));

      for (const savedItem of design.placed) {
        if (disposed) return;
        const savedRuntimeModule = savedItem.module ? await getRuntimeModuleWithAsset(savedItem.module) : null;
        const baseModule = designModuleById.get(savedItem.moduleId) ?? savedRuntimeModule;
        if (!baseModule) continue;
        const module = savedItem.colorOverride ? { ...baseModule, color: savedItem.colorOverride } : baseModule;
        const mesh = module.url
          ? await createAssetModuleMesh(module, style)
          : createPlaceholderModuleMesh(module, style);
        if (disposed) {
          disposeObject(mesh);
          return;
        }
        const position = savedItem.position ?? [0, 0, 0];
        mesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
        mesh.rotation.y = savedItem.rotationY ?? 0;
        mesh.scale.multiplyScalar(savedItem.instanceScale ?? 1);
        applyExportEdges(mesh, style, { color: edgeColor, thickness: edgeThickness });
        group.add(mesh);
      }

      if (disposed) return;
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      const box = new THREE.Box3().setFromObject(group);
      if (box.isEmpty()) {
        renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10));
        return;
      }
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.z, 1);
      const viewHeight = maxSize / 0.82;
      const viewWidth = viewHeight * (width / height);
      const camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        Math.max(100, size.y + maxSize * 4)
      );
      camera.position.set(center.x, box.max.y + maxSize * 2, center.z);
      camera.up.set(0, 0, -1);
      camera.lookAt(center.x, center.y, center.z);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }

    renderHoveredModelPreview().catch(() => {
      if (!disposed) {
        renderer.clear();
      }
    });

    return () => {
      disposed = true;
      group.children.forEach((child) => disposeObject(child));
      group.clear();
      renderer.dispose();
    };
  }, [hoveredMapModel, styleKey, edgeColor, edgeThickness]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    const modelGroup = new THREE.Group();

    sceneRef.current = scene;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    modelGroupRef.current = modelGroup;

    camera.position.set(18, 16, 20);
    controls.target.set(0, 0, 0);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.48;

    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambient = new THREE.HemisphereLight("#ffffff", "#8d735d", 1.35);
    const sun = new THREE.DirectionalLight("#ffffff", 3.2);
    ambientLightRef.current = ambient;
    sunLightRef.current = sun;
    sun.position.set(18, 28, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    scene.add(ambient, sun, modelGroup);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: STYLES.stone.ground, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.isFloor = true;
    floorRef.current = floor;
    scene.add(floor);

    const grid = new THREE.GridHelper(80, 40, "#3e5160", "#9faab3");
    grid.position.y = 0.02;
    gridRef.current = grid;
    scene.add(grid);

    const stageMapMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.58,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const stageMap = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), stageMapMaterial);
    stageMap.rotation.x = -Math.PI / 2;
    stageMap.position.y = 0.015;
    stageMap.visible = false;
    stageMap.renderOrder = 2;
    stageMap.userData.isStageMap = true;
    stageMapRef.current = { mesh: stageMap, material: stageMapMaterial, texture: null };
    scene.add(stageMap);

    const stageMarkers = createStageDirectionMarkers();
    scene.add(stageMarkers);

    const createSectionLine = (color) => {
      const sectionGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-SECTION_LINE_LENGTH / 2, 0.08, 0),
        new THREE.Vector3(SECTION_LINE_LENGTH / 2, 0.08, 0)
      ]);
      const sectionLine = new THREE.Line(
        sectionGeometry,
        new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false })
      );
      sectionLine.renderOrder = 25;
      sectionLine.visible = false;
      scene.add(sectionLine);
      return sectionLine;
    };
    const sectionLineX = createSectionLine("#c9473d");
    const sectionLineY = createSectionLine("#226cc8");
    sectionLinesRef.current = { x: sectionLineX, y: sectionLineY };

    const sectionCapGroup = new THREE.Group();
    sectionCapGroup.visible = false;
    sectionCapGroupRef.current = sectionCapGroup;
    scene.add(sectionCapGroup);

    let frameId = null;

    function requestRender() {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        controls.update();
        renderer.render(scene, camera);
      });
    }

    requestRenderRef.current = requestRender;

    function resize() {
      const parent = canvas.parentElement;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateExportEdgeResolution(modelGroup, renderer.domElement.width, renderer.domElement.height);
      requestRender();
    }

    function handleControlsChange() {
      requestRender();
    }

    resize();
    controls.addEventListener("change", handleControlsChange);
    window.addEventListener("resize", resize);
    requestRender();

    return () => {
      window.removeEventListener("resize", resize);
      controls.removeEventListener("change", handleControlsChange);
      if (frameId !== null) cancelAnimationFrame(frameId);
      requestRenderRef.current = () => {};
      Object.values(sectionLinesRef.current).forEach((line) => {
        line?.geometry.dispose();
        line?.material.dispose();
      });
      sectionLinesRef.current = { x: null, y: null };
      stageMap.geometry.dispose();
      stageMapMaterial.map?.dispose();
      stageMapMaterial.dispose();
      stageMapRef.current = { mesh: null, material: null, texture: null };
      disposeStageMarkerGroup(stageMarkers);
      clearSectionCaps(sectionCapGroup);
      sectionCapGroupRef.current = null;
      ambientLightRef.current = null;
      sunLightRef.current = null;
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (activeView !== "admin" || !canvas) return undefined;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    const modelGroup = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: "#d6ddd8", roughness: 0.92 })
    );
    const ambient = new THREE.HemisphereLight("#ffffff", "#8c7a69", 2.1);
    const key = new THREE.DirectionalLight("#ffffff", 2.5);

    previewSceneRef.current = scene;
    previewRendererRef.current = renderer;
    previewControlsRef.current = controls;
    previewModelRef.current = modelGroup;
    let stopped = false;

    camera.position.set(4.5, 3.5, 5);
    controls.target.set(0, 0.6, 0);
    controls.enableDamping = false;

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    key.position.set(4, 7, 5);
    scene.background = new THREE.Color("#eef3f0");
    scene.add(ambient, key, floor, modelGroup);

    let frameId = null;

    function requestPreviewRender() {
      if (stopped || frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        controls.update();
        renderer.render(scene, camera);
      });
    }

    requestPreviewRenderRef.current = requestPreviewRender;

    function resize() {
      const parent = canvas.parentElement;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestPreviewRender();
    }

    resize();
    controls.addEventListener("change", requestPreviewRender);
    window.addEventListener("resize", resize);
    requestPreviewRender();

    return () => {
      stopped = true;
      window.removeEventListener("resize", resize);
      controls.removeEventListener("change", requestPreviewRender);
      if (frameId !== null) cancelAnimationFrame(frameId);
      requestPreviewRenderRef.current = () => {};
      floor.geometry.dispose();
      floor.material.dispose();
      controls.dispose();
      renderer.dispose();
      previewSceneRef.current = null;
      previewRendererRef.current = null;
      previewControlsRef.current = null;
      previewModelRef.current = null;
    };
  }, [activeView]);

  useEffect(() => {
    const canvas = sectionCanvasRef.current;
    const scene = sceneRef.current;
    if (activeSectionCuts.length === 0 || !canvas || !scene) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.1, 2000);
    let frameId = null;
    let stopped = false;
    sectionRendererRef.current = renderer;

    function renderSection() {
      const modelGroup = modelGroupRef.current;
      const lines = Object.values(sectionLinesRef.current);
      const floor = floorRef.current;
      const grid = gridRef.current;
      const parent = canvas.parentElement;
      if (!parent || !modelGroup) return;

      const width = Math.max(1, parent.clientWidth);
      const height = Math.max(1, parent.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(exportBackgroundColor, 1);
      renderer.localClippingEnabled = true;
      renderer.clippingPlanes = [];

      const box = new THREE.Box3().setFromObject(modelGroup);
      const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
      const size = hasPlacedItems ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(8, 3, 8);
      const center = hasPlacedItems ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
      const maxSize = Math.max(size.x, size.y, size.z, 8);
      const cut = primarySectionCut;
      const normal = cut.normal.clone().normalize();
      const sectionCenter = normal.clone().multiplyScalar(cut.offset);
      if (cut.type === "vertical") {
        sectionCenter.y = center.y;
      }
      const viewHeight = Math.max(maxSize * 1.15, 6);
      const viewWidth = viewHeight * (width / height);
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      if (cut.type === "horizontal") {
        camera.position.set(center.x, sectionCenter.y + maxSize * 2.2, center.z);
        camera.up.set(0, 0, -1);
        camera.lookAt(center.x, sectionCenter.y, center.z);
      } else {
        camera.position.copy(sectionCenter).add(normal.clone().multiplyScalar(maxSize * 2.2));
        camera.position.y = Math.max(center.y + size.y * 0.45, 2);
        camera.up.set(0, 1, 0);
        camera.lookAt(sectionCenter.x, Math.max(center.y + size.y * 0.35, 0.8), sectionCenter.z);
      }
      camera.updateProjectionMatrix();

      const lineVisible = lines.map((line) => line?.visible ?? false);
      const floorVisible = floor?.visible ?? false;
      const gridVisible = grid?.visible ?? false;
      const materialSides = setObjectMaterialSide(modelGroup, THREE.DoubleSide);
      lines.forEach((line) => {
        if (line) line.visible = false;
      });
      if (floor) floor.visible = false;
      if (grid) grid.visible = false;
      renderer.render(scene, camera);
      restoreMaterialSides(materialSides);
      lines.forEach((line, index) => {
        if (line) line.visible = lineVisible[index];
      });
      if (floor) floor.visible = floorVisible;
      if (grid) grid.visible = gridVisible;
    }

    function requestSectionRender() {
      if (stopped || frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        renderSection();
      });
    }

    requestSectionRenderRef.current = requestSectionRender;
    requestSectionRender();
    window.addEventListener("resize", requestSectionRender);

    return () => {
      stopped = true;
      window.removeEventListener("resize", requestSectionRender);
      if (frameId !== null) cancelAnimationFrame(frameId);
      renderer.dispose();
      renderer.clippingPlanes = [];
      sectionRendererRef.current = null;
      requestSectionRenderRef.current = () => {};
    };
  }, [activeSectionCuts, primarySectionCut, exportBackgroundColor]);

  useEffect(() => {
    const style = STYLES[styleKey];
    const scene = sceneRef.current;
    const floor = floorRef.current;
    if (!scene || !floor) return;

    scene.background = new THREE.Color(exportBackgroundColor || style.background);
    floor.material.color.set(exportStageColor || style.ground);
    placedRef.current.forEach(({ mesh, module }) => {
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.dispose();
          child.material = createMaterial(module, style);
        }
      });
      applyExportEdges(mesh, style, { color: edgeColor, thickness: edgeThickness });
      });
    updateExportEdgeResolution(modelGroupRef.current, rendererRef.current?.domElement.width ?? 1, rendererRef.current?.domElement.height ?? 1);
    requestSceneRender();
    requestSectionViewportRender();
  }, [
    styleKey,
    exportBackgroundColor,
    exportStageColor,
    edgeColor,
    edgeThickness,
    requestSceneRender,
    requestSectionViewportRender
  ]);

  useEffect(() => {
    let cancelled = false;
    const modelGroup = modelGroupRef.current;
    if (!modelGroup || placedRef.current.length === 0) return undefined;

    async function rebuildPlacedModules() {
      const style = STYLES[styleKey];
      const rebuiltItems = await Promise.all(
        placedRef.current.map(async (item) => {
          const baseModule = modules.find((module) => module.id === item.module.id) ?? item.module;
          const updatedModule = item.colorOverride ? { ...baseModule, color: item.colorOverride } : baseModule;
          const position = item.mesh.position.clone();
          const nextMesh = updatedModule.url
            ? await createAssetModuleMesh(updatedModule, style)
            : createPlaceholderModuleMesh(updatedModule, style);
          nextMesh.position.copy(position);
          nextMesh.rotation.y = item.rotationY ?? 0;
          nextMesh.scale.multiplyScalar(item.instanceScale ?? 1);
          nextMesh.userData.itemId = item.id;
          applyExportEdges(nextMesh, style, { color: edgeColor, thickness: edgeThickness });
          return { ...item, module: updatedModule, mesh: nextMesh };
        })
      );

      if (cancelled) {
        rebuiltItems.forEach((item) => disposeObject(item.mesh));
        return;
      }

      placedRef.current.forEach((item) => {
        modelGroup.remove(item.mesh);
        disposeObject(item.mesh);
      });
      rebuiltItems.forEach((item) => modelGroup.add(item.mesh));
      placedRef.current = rebuiltItems;
      setPlaced(rebuiltItems.map(({ id, module }) => ({ id, moduleId: module.id })));
      requestSceneRender();
      requestSectionViewportRender();
    }

    void rebuildPlacedModules();

    return () => {
      cancelled = true;
    };
  }, [modules, styleKey, edgeColor, edgeThickness, requestSceneRender, requestSectionViewportRender]);

  useEffect(() => {
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.y = THREE.MathUtils.degToRad(rotation);
      modelGroupRef.current.scale.setScalar(modelScale);
      selectionHelpersRef.current.forEach((helper, itemId) => {
        const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
        if (item) updateSelectionBoxHelper(helper, item.mesh);
      });
      requestSceneRender();
      requestSectionViewportRender();
    }
  }, [modelScale, rotation, requestSceneRender, requestSectionViewportRender]);

  useEffect(() => {
    const stageMap = stageMapRef.current.mesh;
    const stageMapMaterial = stageMapRef.current.material;
    if (!stageMap || !stageMapMaterial) return undefined;

    if (!mapStageVisible) {
      stageMap.visible = false;
      requestSceneRender();
      return undefined;
    }

    const textureUrl = getGoogleStaticMapUrl(mapLat, mapLon, mapZoom);
    let cancelled = false;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    textureLoader.load(
      textureUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(rendererRef.current?.capabilities.getMaxAnisotropy?.() ?? 1, 8);
        stageMapRef.current.texture?.dispose();
        stageMapRef.current.texture = texture;
        stageMapMaterial.map = texture;
        stageMapMaterial.needsUpdate = true;
        stageMap.visible = true;
        requestSceneRender();
      },
      undefined,
      () => {
        if (!cancelled) {
          stageMap.visible = false;
          setSaveStatus("Stage map API blocked");
          requestSceneRender();
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [mapLat, mapLon, mapStageVisible, mapZoom, requestSceneRender]);

  useEffect(() => {
    const lineX = sectionLinesRef.current.x;
    const lineY = sectionLinesRef.current.y;
    const capGroup = sectionCapGroupRef.current;
    if (lineX) {
      lineX.position.set(0, 0.08, sectionXOffset);
      lineX.rotation.set(0, 0, 0);
      lineX.visible = sectionXEnabled;
    }
    if (lineY) {
      lineY.position.set(sectionYOffset, 0.08, 0);
      lineY.rotation.set(0, Math.PI / 2, 0);
      lineY.visible = sectionYEnabled;
    }
    if (capGroup) {
      capGroup.visible = activeSectionCuts.length > 0;
      if (activeSectionCuts.length > 0) {
        rebuildSectionCaps({
          capGroup,
          placedItems: placedRef.current,
          cuts: activeSectionCuts
        });
      } else {
        clearSectionCaps(capGroup);
      }
    }
    requestSceneRender();
    requestSectionViewportRender();
  }, [
    sectionXEnabled,
    sectionXOffset,
    sectionYEnabled,
    sectionYOffset,
    activeSectionCuts,
    placed.length,
    requestSceneRender,
    requestSectionViewportRender
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const modelGroup = modelGroupRef.current;
    if (!renderer || !modelGroup) return;

    restoreObjectClippingPlanes(builderSectionClipsRef.current);
    restoreMaterialSides(builderSectionSidesRef.current);
    builderSectionClipsRef.current = [];
    builderSectionSidesRef.current = [];

    if (activeSectionCuts.length > 0) {
      builderLocalClippingRef.current = renderer.localClippingEnabled;
      renderer.localClippingEnabled = true;
      renderer.clippingPlanes = [];
      builderSectionClipsRef.current = setObjectClippingPlanes(
        modelGroup,
        activeSectionCuts.map((cut) => cut.clippingPlane)
      );
      builderSectionSidesRef.current = setObjectMaterialSide(modelGroup, THREE.DoubleSide);
    } else {
      renderer.localClippingEnabled = builderLocalClippingRef.current;
      renderer.clippingPlanes = [];
    }

    requestSceneRender();
    requestSectionViewportRender();

    return () => {
      const currentRenderer = rendererRef.current;
      restoreObjectClippingPlanes(builderSectionClipsRef.current);
      restoreMaterialSides(builderSectionSidesRef.current);
      builderSectionClipsRef.current = [];
      builderSectionSidesRef.current = [];
      if (currentRenderer) {
        currentRenderer.localClippingEnabled = builderLocalClippingRef.current;
        currentRenderer.clippingPlanes = [];
      }
    requestRenderRef.current();
    };
  }, [
    activeSectionCuts,
    placed.length,
    modules,
    styleKey,
    edgeColor,
    edgeThickness,
    requestSceneRender,
    requestSectionViewportRender
  ]);

  useEffect(() => {
    const ambient = ambientLightRef.current;
    const sun = sunLightRef.current;
    const renderer = rendererRef.current;
    const modelGroup = modelGroupRef.current;
    if (!ambient || !sun || !renderer) return;

    if (walkMode) {
      ambient.intensity = 0.08;
      ambient.groundColor.set("#1e1a14");
      sun.intensity = 3.8;
      sun.position.set(22, 32, 12);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      sun.shadow.needsUpdate = true;
      setExportEdgesVisible(modelGroup, false);
      markSceneMaterialsForUpdate(modelGroup);
    } else {
      ambient.intensity = 1.35;
      ambient.groundColor.set("#8d735d");
      sun.intensity = 3.2;
      sun.position.set(18, 28, 16);
      renderer.shadowMap.enabled = false;
      setExportEdgesVisible(modelGroup, true);
      markSceneMaterialsForUpdate(modelGroup);
    }
    requestSceneRender();
    requestSectionViewportRender();
  }, [walkMode, placed.length, edgeColor, edgeThickness, requestSceneRender, requestSectionViewportRender]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = controls?.object;
    if (!controls || !camera) return undefined;

    const eyeHeight = walkHeightRef.current;
    const box = modelGroupRef.current ? new THREE.Box3().setFromObject(modelGroupRef.current) : new THREE.Box3();
    const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
    const center = hasPlacedItems ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const start = hasPlacedItems
      ? new THREE.Vector3(center.x, eyeHeight, box.max.z + Math.max(2.5, box.getSize(new THREE.Vector3()).z * 0.18))
      : new THREE.Vector3(0, eyeHeight, 8);

    if (walkMode) {
      camera.fov = 68;
      camera.updateProjectionMatrix();
      camera.position.copy(start);
      controls.target.copy(getWalkFocusPoint(camera.position));
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.maxPolarAngle = Math.PI * 0.62;
      controls.minPolarAngle = Math.PI * 0.18;
      controls.update();
      requestSceneRender();
    } else {
      walkKeysRef.current.clear();
      controls.enablePan = true;
      controls.enableZoom = true;
      camera.fov = 45;
      camera.updateProjectionMatrix();
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minPolarAngle = 0;
      if (walkAnimationRef.current !== null) {
        cancelAnimationFrame(walkAnimationRef.current);
        walkAnimationRef.current = null;
      }
      return undefined;
    }

    const walkKeys = walkKeysRef.current;

    function moveWalkCamera() {
      walkAnimationRef.current = null;
      const keys = walkKeys;
      if (keys.size === 0 || !walkMode) return;

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const movement = new THREE.Vector3();
      if (keys.has("KeyW") || keys.has("ArrowUp")) movement.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) movement.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) movement.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) movement.sub(right);
      if (keys.has("KeyE")) movement.y += 1;
      if (keys.has("KeyQ")) movement.y -= 1;

      if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(keys.has("ShiftLeft") || keys.has("ShiftRight") ? 0.28 : 0.14);
        camera.position.add(movement);
        walkHeightRef.current = THREE.MathUtils.clamp(camera.position.y, 0.15, 24);
        camera.position.y = walkHeightRef.current;
        controls.target.copy(getWalkFocusPoint(camera.position));
        controls.update();
        requestSceneRender();
        requestSectionViewportRender();
      }
      walkAnimationRef.current = requestAnimationFrame(moveWalkCamera);
    }

    function scheduleWalk() {
      if (walkAnimationRef.current === null) {
        walkAnimationRef.current = requestAnimationFrame(moveWalkCamera);
      }
    }

    function handleKeyDown(event) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyE",
          "KeyQ",
          "ArrowUp",
          "ArrowLeft",
          "ArrowDown",
          "ArrowRight",
          "ShiftLeft",
          "ShiftRight"
        ].includes(event.code)
      ) {
        event.preventDefault();
        walkKeys.add(event.code);
        scheduleWalk();
      }
    }

    function handleKeyUp(event) {
      walkKeys.delete(event.code);
      if (walkKeys.size === 0 && walkAnimationRef.current !== null) {
        cancelAnimationFrame(walkAnimationRef.current);
        walkAnimationRef.current = null;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      walkKeys.clear();
      if (walkAnimationRef.current !== null) {
        cancelAnimationFrame(walkAnimationRef.current);
        walkAnimationRef.current = null;
      }
    };
  }, [walkMode, placed.length, requestSceneRender, requestSectionViewportRender]);

  useEffect(() => {
    let cancelled = false;
    const previewGroup = previewModelRef.current;
    if (activeView !== "admin" || !previewGroup || !editing) return undefined;

    async function renderPreview() {
      const style = STYLES[styleKey];
      const mesh = editing.url
        ? await createAssetModuleMesh(editing, style)
        : createPlaceholderModuleMesh(editing, style);

      if (cancelled) {
        disposeObject(mesh);
        return;
      }

      previewGroup.children.forEach((child) => disposeObject(child));
      previewGroup.clear();
      previewGroup.add(mesh);
      requestAdminPreviewRender();

      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      setMeasuredDimensions({
        moduleId: editing.id,
        width: size.x,
        length: size.z,
        height: size.y
      });
      const controls = previewControlsRef.current;
      if (controls) {
        controls.target.set(center.x, Math.max(size.y * 0.35, 0.5), center.z);
        controls.object.position.set(
          center.x + Math.max(size.x, size.z, 3) * 1.6,
          Math.max(size.y, 2.5),
          center.z + Math.max(size.x, size.z, 3) * 1.8
        );
        controls.update();
        requestAdminPreviewRender();
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [activeView, editing, styleKey, requestAdminPreviewRender]);

  async function placeModule(module, x, z, { recordHistory = true } = {}) {
    if (recordHistory) {
      pushUndoSnapshot();
    }
    const style = STYLES[styleKey];
    const mesh = module.url
      ? await createAssetModuleMesh(module, style)
      : createPlaceholderModuleMesh(module, style);
    const rotationY = lastModuleRotationRef.current.get(module.id) ?? 0;
    const item = {
      id: `${module.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      module,
      mesh,
      colorOverride: null,
      instanceScale: 1,
      rotationY
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotationY;
    mesh.userData.itemId = item.id;
    applyExportEdges(mesh, style, { color: edgeColor, thickness: edgeThickness });
    modelGroupRef.current.add(mesh);
    snapMeshToObjectEdges(mesh);
    placedRef.current.push(item);
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    selectPlacedItems([item.id]);
    return item;
  }

  function addModuleAtCenter(module) {
    setSelectedModule(module.id);
    void placeModule(module, 0, 0);
  }

  function snapMeshToObjectEdges(mesh, { maxDistance = EDGE_SNAP_DISTANCE, strength = 1, passes = 2 } = {}) {
    for (let pass = 0; pass < passes; pass += 1) {
      const movingSegments = getVisibleVerticalFaceSegments(mesh);
      let bestSnap = null;

      placedRef.current.forEach((item) => {
        if (item.mesh === mesh) return;
        const targetSegments = getVisibleVerticalFaceSegments(item.mesh);
        movingSegments.forEach((movingSegment) => {
          targetSegments.forEach((targetSegment) => {
            const candidate = getVerticalFaceSnapDelta(movingSegment, targetSegment, maxDistance);
            if (
              candidate &&
              (!bestSnap ||
                candidate.distance < bestSnap.distance - 0.02 ||
                (candidate.distance === bestSnap.distance && candidate.overlap > bestSnap.overlap))
            ) {
              bestSnap = candidate;
            }
          });
        });
      });

      if (!bestSnap || bestSnap.delta.length() <= 0.0001) {
        break;
      }
      const snapStrength = THREE.MathUtils.clamp(strength, 0, 1);
      mesh.position.x += bestSnap.delta.x * snapStrength;
      mesh.position.z += bestSnap.delta.y * snapStrength;
    }
  }

  function setPointer(event) {
    const bounds = canvasRef.current.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function getPlacedItemAtPointer(event) {
    setPointer(event);
    raycasterRef.current.setFromCamera(pointerRef.current, controlsRef.current.object);
    const meshes = placedRef.current.flatMap(({ mesh }) => mesh.children);
    const hit = raycasterRef.current.intersectObjects(meshes, true)[0];
    if (!hit) return null;
    let root = hit.object;
    while (root.parent && root.parent !== modelGroupRef.current) {
      root = root.parent;
    }
    const item = placedRef.current.find((placedItem) => placedItem.mesh === root);
    return item ? { item, root } : null;
  }

  function getFloorPoint(event) {
    setPointer(event);
    raycasterRef.current.setFromCamera(pointerRef.current, controlsRef.current.object);
    const hit = raycasterRef.current.intersectObject(floorRef.current)[0];
    return hit?.point;
  }

  function getSectionLineAtPoint(point) {
    if (!point) return null;
    if (sectionXEnabled && Math.abs(point.z - sectionXOffset) <= SECTION_LINE_PICK_DISTANCE) {
      return "x";
    }
    if (sectionYEnabled && Math.abs(point.x - sectionYOffset) <= SECTION_LINE_PICK_DISTANCE) {
      return "y";
    }
    return null;
  }

  function updateSectionOffsetFromPoint(sectionKey, point) {
    if (!point) return;
    if (sectionKey === "x") {
      setSectionXOffset(Number(point.z.toFixed(2)));
    }
    if (sectionKey === "y") {
      setSectionYOffset(Number(point.x.toFixed(2)));
    }
  }

  function handleCanvasDrop(event) {
    event.preventDefault();
    const moduleId = event.dataTransfer.getData("module-id") || selectedModule;
    const module = modules.find((item) => item.id === moduleId);
    const point = getFloorPoint(event);
    if (module && point) {
      void placeModule(module, point.x, point.z);
    }
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    if (walkMode) return;
    setContextMenu(null);
    const point = getFloorPoint(event);
    const sectionLineKey = getSectionLineAtPoint(point);
    if (sectionLineKey) {
      sectionDragRef.current = sectionLineKey;
      updateSectionOffsetFromPoint(sectionLineKey, point);
      controlsRef.current.enabled = false;
      return;
    }
    const hit = getPlacedItemAtPointer(event);
    if (!hit) {
      selectPlacedItems([]);
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      return;
    }
    const wasSelected = selectedPlacedIdsRef.current.includes(hit.item.id);
    const dragItemIds = wasSelected ? selectedPlacedIdsRef.current : [hit.item.id];
    if (!wasSelected) {
      selectPlacedItems(dragItemIds);
    }
    dragRef.current = {
      active: true,
      object: hit.root,
      itemIds: dragItemIds,
      startPoint: point ? point.clone() : null,
      startPositions: new Map(
        placedRef.current
          .filter((item) => dragItemIds.includes(item.id))
          .map((item) => [item.id, item.mesh.position.clone()])
      ),
      historySnapshot: serializeDesign(),
      rotateOnClick: wasSelected,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    controlsRef.current.enabled = false;
  }

  function handlePointerMove(event) {
    if (sectionDragRef.current) {
      updateSectionOffsetFromPoint(sectionDragRef.current, getFloorPoint(event));
      return;
    }
    if (!dragRef.current.active) return;
    const pointerDistance = Math.hypot(
      event.clientX - dragRef.current.startX,
      event.clientY - dragRef.current.startY
    );
    if (pointerDistance <= 5) {
      return;
    }
    dragRef.current.moved = true;
    const point = getFloorPoint(event);
    if (!point) return;
    const drag = dragRef.current;
    if (drag.itemIds.length > 1 && drag.startPoint) {
      const deltaX = point.x - drag.startPoint.x;
      const deltaZ = point.z - drag.startPoint.z;
      drag.itemIds.forEach((itemId) => {
        const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
        const startPosition = drag.startPositions.get(itemId);
        if (!item || !startPosition) return;
        item.mesh.position.x = startPosition.x + deltaX;
        item.mesh.position.z = startPosition.z + deltaZ;
      });
    } else {
      drag.object.position.x = point.x;
      drag.object.position.z = point.z;
      snapMeshToObjectEdges(drag.object, { strength: LIVE_SNAP_STRENGTH, passes: 1 });
    }
    refreshSelectionHelpers();
  }

  function handlePointerUp() {
    if (sectionDragRef.current) {
      sectionDragRef.current = null;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      requestSceneRender();
      requestSectionViewportRender();
      return;
    }
    const drag = dragRef.current;
    if (drag.active && drag.moved) {
      if (drag.itemIds.length === 1 && drag.object) {
        snapMeshToObjectEdges(drag.object, { strength: 1, passes: 2 });
        refreshSelectionHelpers();
      }
      pushUndoSnapshot(drag.historySnapshot);
      setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    } else if (drag.active && !drag.moved && drag.rotateOnClick) {
      const item = placedRef.current.find((placedItem) => placedItem.mesh === drag.object);
      if (item) {
        rotatePlacedItems(drag.itemIds.length > 0 ? drag.itemIds : [item.id]);
      }
    } else if (drag.active && !drag.moved) {
      selectPlacedItems(drag.itemIds);
    }
    dragRef.current = {
      active: false,
      object: null,
      itemIds: [],
      startPoint: null,
      startPositions: new Map(),
      historySnapshot: null,
      rotateOnClick: false,
      startX: 0,
      startY: 0,
      moved: false
    };
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
  }

  function handleContextMenu(event) {
    event.preventDefault();
    const hit = getPlacedItemAtPointer(event);
    if (!hit) {
      setContextMenu(null);
      return;
    }

    selectPlacedItems([hit.item.id]);
    const menuWidth = 180;
    const menuHeight = 150;
    setContextMenu({
      itemId: hit.item.id,
      x: Math.min(event.clientX, window.innerWidth - menuWidth),
      y: Math.min(event.clientY, window.innerHeight - menuHeight)
    });
  }

  function clearDesign({ recordHistory = true } = {}) {
    if (recordHistory && placedRef.current.length > 0) {
      pushUndoSnapshot();
    }
    setContextMenu(null);
    clearSelectionHelpers();
    selectedPlacedRef.current = null;
    selectedPlacedIdsRef.current = [];
    setSelectedPlaced(null);
    setSelectedPlacedIds([]);
    placedRef.current.forEach(({ mesh }) => {
      modelGroupRef.current.remove(mesh);
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    });
    placedRef.current = [];
    setPlaced([]);
    requestSceneRender();
    requestSectionViewportRender();
  }

  function getStoredModuleSnapshot(module) {
    const snapshot = { ...module };
    if (snapshot.source === "upload") {
      delete snapshot.url;
    }
    return snapshot;
  }

  function serializeDesign() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      section: {
        xEnabled: sectionXEnabled,
        xOffset: sectionXOffset,
        yEnabled: sectionYEnabled,
        yOffset: sectionYOffset,
        planEnabled: planSectionEnabled,
        planHeight: planSectionHeight
      },
      transform: {
        rotation,
        scale: modelScale
      },
      render: {
        edgeColor,
        edgeThickness,
        seamlessSolid: exportSeamlessSolid
      },
      modules: modules.map(getStoredModuleSnapshot),
      placed: placedRef.current.map((item) => ({
        moduleId: item.module.id,
        module: getStoredModuleSnapshot(item.module),
        position: [item.mesh.position.x, item.mesh.position.y, item.mesh.position.z],
        rotationY: item.rotationY ?? 0,
        instanceScale: item.instanceScale ?? 1,
        colorOverride: item.colorOverride ?? null
      }))
    };
  }

  function updateHistoryCounts() {
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length
    });
  }

  function pushUndoSnapshot(snapshot = serializeDesign()) {
    if (!snapshot) return;
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 60) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    updateHistoryCounts();
  }

  async function restoreDesignSnapshot(snapshot, { frameModel = false } = {}) {
    if (Array.isArray(snapshot?.modules) && snapshot.modules.length > 0) {
      const runtimeModules = await Promise.all(snapshot.modules.map(getRuntimeModuleWithAsset));
      setModules(runtimeModules);
      setSelectedModule((current) =>
        runtimeModules.some((module) => module.id === current) ? current : runtimeModules[0].id
      );
      setEditingModule((current) =>
        runtimeModules.some((module) => module.id === current) ? current : runtimeModules[0].id
      );
    }
    await addDesignToStage(snapshot, { clearCurrent: true, recordHistory: false });
    if (frameModel) {
      frameWholeModelInView(0.9);
    }
    updateHistoryCounts();
  }

  async function undoDesign() {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    redoStackRef.current.push(serializeDesign());
    await restoreDesignSnapshot(snapshot);
  }

  async function redoDesign() {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;
    undoStackRef.current.push(serializeDesign());
    await restoreDesignSnapshot(snapshot);
  }

  function saveDesignFile() {
    const blob = new Blob([JSON.stringify(serializeDesign(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `caravansary-model-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function addDesignToStage(design, { clearCurrent, recordHistory = true }) {
    if (!Array.isArray(design?.placed)) return;
    if (recordHistory) {
      pushUndoSnapshot();
    }
    const restoredEdgeColor = clearCurrent && typeof design.render?.edgeColor === "string" ? design.render.edgeColor : edgeColor;
    const restoredEdgeThickness = clearCurrent ? Math.max(0, asNumber(design.render?.edgeThickness, 1)) : edgeThickness;
    if (clearCurrent) {
      clearDesign({ recordHistory: false });
      if (design.section) {
        setSectionXEnabled(Boolean(design.section.xEnabled ?? design.section.enabled));
        setSectionXOffset(asNumber(design.section.xOffset ?? design.section.offset, 0));
        setSectionYEnabled(Boolean(design.section.yEnabled, false));
        setSectionYOffset(asNumber(design.section.yOffset, 0));
        setPlanSectionEnabled(Boolean(design.section.planEnabled));
        setPlanSectionHeight(asNumber(design.section.planHeight, 0.5));
      }
      if (design.transform) {
        setRotation(THREE.MathUtils.clamp(asNumber(design.transform.rotation, 0), -180, 180));
        setModelScale(THREE.MathUtils.clamp(asNumber(design.transform.scale, 1), 0.05, 10));
      }
      setEdgeColor(restoredEdgeColor);
      setEdgeThickness(restoredEdgeThickness);
      setExportSeamlessSolid(Boolean(design.render?.seamlessSolid));
    }

    const style = STYLES[styleKey];
    const nextItems = [];
    const designModules = await Promise.all((design.modules ?? []).map(getRuntimeModuleWithAsset));
    const designModuleById = new Map(designModules.map((module) => [module.id, module]));
    const moduleById = new Map(modules.map((module) => [module.id, module]));
    if (clearCurrent && designModules.length > 0) {
      setModules(designModules);
      setSelectedModule((current) =>
        designModules.some((module) => module.id === current) ? current : designModules[0].id
      );
      setEditingModule((current) =>
        designModules.some((module) => module.id === current) ? current : designModules[0].id
      );
    }

    for (const savedItem of design.placed) {
      const savedRuntimeModule = savedItem.module ? await getRuntimeModuleWithAsset(savedItem.module) : null;
      const baseModule =
        designModuleById.get(savedItem.moduleId) ??
        moduleById.get(savedItem.moduleId) ??
        savedRuntimeModule;
      if (!baseModule) continue;

      const module = savedItem.colorOverride ? { ...baseModule, color: savedItem.colorOverride } : baseModule;
      const mesh = module.url
        ? await createAssetModuleMesh(module, style)
        : createPlaceholderModuleMesh(module, style);
      const position = savedItem.position ?? [0, 0, 0];
      const id = `${module.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item = {
        id,
        module,
        mesh,
        colorOverride: savedItem.colorOverride ?? null,
        instanceScale: savedItem.instanceScale ?? 1,
        rotationY: savedItem.rotationY ?? 0
      };

      mesh.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
      mesh.rotation.y = item.rotationY;
      mesh.scale.multiplyScalar(item.instanceScale);
      mesh.userData.itemId = id;
      applyExportEdges(mesh, style, { color: restoredEdgeColor, thickness: restoredEdgeThickness });
      modelGroupRef.current.add(mesh);
      nextItems.push(item);
    }

    placedRef.current = [...placedRef.current, ...nextItems];
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    selectPlacedItems(nextItems.map((item) => item.id));
  }

  async function handleDesignFile(event, mode) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const design = await readJsonFile(file);
      await addDesignToStage(design, { clearCurrent: mode === "open" });
      if (mode === "open") {
        setRotation(THREE.MathUtils.clamp(asNumber(design.transform?.rotation, 0), -180, 180));
        setModelScale(THREE.MathUtils.clamp(asNumber(design.transform?.scale, 1), 0.05, 10));
        frameWholeModelInView(0.9);
      }
    } catch {
      setSaveStatus("Open failed");
    }
  }

  async function saveCurrentModelToLocation() {
    if (placedRef.current.length === 0) {
      setSaveStatus("Nothing to tag");
      return;
    }

    const model = {
      id: createModelLocationId(),
      name: locationModelName.trim() || `Site ${locationModels.length + 1}`,
      lat: asNumber(mapLat, 0),
      lon: asNumber(mapLon, 0),
      zoom: Math.round(THREE.MathUtils.clamp(asNumber(mapZoom, 18), 1, 21)),
      design: serializeDesign(),
      updated_at: new Date().toISOString()
    };

    try {
      const saved = isSupabaseConfigured ? await saveSupabaseLocationModel(model) : model;
      const nextModels = [saved, ...locationModels.filter((item) => item.id !== saved.id)];
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setSaveStatus(isSupabaseConfigured ? "Location model saved to cloud" : "Location model saved");
    } catch {
      const nextModels = [model, ...locationModels.filter((item) => item.id !== model.id)];
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setSaveStatus("Location saved locally");
    }
  }

  async function openLocationModel(model) {
    try {
      setMapLat(model.lat);
      setMapLon(model.lon);
      setMapZoom(model.zoom ?? 18);
      setMapRefreshKey((current) => current + 1);
      setLocationModelName(model.name);
      await restoreDesignSnapshot(model.design, { frameModel: true });
      setSaveStatus(`Loaded ${model.name}`);
    } catch {
      setSaveStatus("Location load failed");
    }
  }

  function updateLocationModelDraft(modelId, field, value) {
    setLocationModels((current) =>
      current.map((model) => {
        if (model.id !== modelId) return model;
        if (field === "name") return { ...model, name: value };
        if (field === "zoom") {
          return { ...model, zoom: Math.round(THREE.MathUtils.clamp(asNumber(value, model.zoom ?? 18), 1, 21)) };
        }
        return { ...model, [field]: asNumber(value, model[field] ?? 0) };
      })
    );
  }

  async function saveLocationModelEdits(model) {
    try {
      const nextModel = {
        ...model,
        name: model.name.trim() || "Untitled model",
        lat: asNumber(model.lat, 0),
        lon: asNumber(model.lon, 0),
        zoom: Math.round(THREE.MathUtils.clamp(asNumber(model.zoom, 18), 1, 21)),
        updated_at: new Date().toISOString()
      };
      const saved = isSupabaseConfigured ? await saveSupabaseLocationModel(nextModel) : nextModel;
      const nextModels = locationModels.map((item) => (item.id === saved.id ? saved : item));
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setMapLat(saved.lat);
      setMapLon(saved.lon);
      setMapZoom(saved.zoom ?? 18);
      setMapRefreshKey((current) => current + 1);
      setSaveStatus(isSupabaseConfigured ? "Location updated in cloud" : "Location updated");
    } catch {
      const nextModel = {
        ...model,
        name: model.name.trim() || "Untitled model",
        lat: asNumber(model.lat, 0),
        lon: asNumber(model.lon, 0),
        zoom: Math.round(THREE.MathUtils.clamp(asNumber(model.zoom, 18), 1, 21)),
        updated_at: new Date().toISOString()
      };
      const nextModels = locationModels.map((item) => (item.id === nextModel.id ? nextModel : item));
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setSaveStatus("Location updated locally");
    }
  }

  async function deleteLocationModel(modelId) {
    try {
      if (isSupabaseConfigured) {
        await deleteSupabaseLocationModel(modelId);
      }
      const nextModels = locationModels.filter((model) => model.id !== modelId);
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setSaveStatus("Location deleted");
    } catch {
      const nextModels = locationModels.filter((model) => model.id !== modelId);
      setLocationModels(nextModels);
      saveLocalLocationModels(nextModels);
      setSaveStatus("Location deleted locally");
    }
  }

  function deletePlacedItem(itemId) {
    const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
    if (!item || !modelGroupRef.current) return;

    pushUndoSnapshot();
    modelGroupRef.current.remove(item.mesh);
    disposeObject(item.mesh);
    placedRef.current = placedRef.current.filter((placedItem) => placedItem.id !== itemId);
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    setContextMenu(null);

    if (selectedPlacedRef.current === itemId) {
      selectedPlacedRef.current = null;
      setSelectedPlaced(null);
    }
    const nextSelectedIds = selectedPlacedIdsRef.current.filter((id) => id !== itemId);
    selectPlacedItems(nextSelectedIds);
  }

  function updatePlacedItemColor(itemId, color) {
    const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
    if (!item) return;

    pushUndoSnapshot();
    const style = STYLES[styleKey];
    item.colorOverride = color;
    item.module = { ...item.module, color };
    item.mesh.traverse((child) => {
      if (child.isMesh) {
        child.material.dispose();
        child.material = createMaterial(item.module, style);
      }
    });
    applyExportEdges(item.mesh, style, { color: edgeColor, thickness: edgeThickness });
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    refreshSelectionHelpers();
    requestSectionViewportRender();
  }

  function resetCamera() {
    setWalkMode(false);
    walkHeightRef.current = 1.65;
    controlsRef.current.object.position.set(18, 16, 20);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    requestSceneRender();
  }

  function frameWholeModelInView(fillRatio = 0.9) {
    if (placedRef.current.length === 0 || !controlsRef.current) {
      resetCamera();
      return;
    }
    const box = new THREE.Box3();
    placedRef.current.forEach((item) => {
      box.union(getObjectBox(item.mesh));
    });
    if (box.isEmpty()) {
      resetCamera();
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 1);
    const camera = controlsRef.current.object;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const fov = Math.min(verticalFov, horizontalFov);
    const distance = radius / Math.sin(fov * Math.max(0.1, Math.min(fillRatio, 0.95)) * 0.5);
    const viewDirection = new THREE.Vector3(1, 0.78, 1).normalize();

    setWalkMode(false);
    walkHeightRef.current = 1.65;
    camera.position.copy(center).addScaledVector(viewDirection, distance);
    camera.near = Math.max(0.01, distance / 1000);
    camera.far = Math.max(2000, distance * 8);
    camera.updateProjectionMatrix();
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
    requestSceneRender();
  }

  function getWalkFocusPoint(position) {
    const fallback = position.clone().add(new THREE.Vector3(0, 0, -3));
    if (placedRef.current.length === 0) return fallback;

    let best = null;
    placedRef.current.forEach((item) => {
      const box = getObjectBox(item.mesh);
      const center = box.getCenter(new THREE.Vector3());
      const contains =
        position.x >= box.min.x &&
        position.x <= box.max.x &&
        position.z >= box.min.z &&
        position.z <= box.max.z;
      const distance = contains
        ? 0
        : Math.hypot(position.x - center.x, position.z - center.z);
      if (!best || distance < best.distance) {
        best = { center, distance };
      }
    });

    if (!best) return fallback;
    return new THREE.Vector3(best.center.x, position.y, best.center.z);
  }

  function centerWholeModel() {
    if (placedRef.current.length === 0) return;
    const box = new THREE.Box3();
    placedRef.current.forEach((item) => {
      box.union(getObjectBox(item.mesh));
    });
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    if (!Number.isFinite(center.x) || !Number.isFinite(center.z)) return;

    pushUndoSnapshot();
    placedRef.current.forEach((item) => {
      item.mesh.position.x -= center.x;
      item.mesh.position.z -= center.z;
    });
    resetCamera();
    refreshSelectionHelpers();
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    requestSceneRender();
    requestSectionViewportRender();
  }

  async function downloadRender() {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const modelGroup = modelGroupRef.current;
    const floor = floorRef.current;
    const grid = gridRef.current;
    const controls = controlsRef.current;
    if (!renderer || !scene || !modelGroup || !floor || !controls) return;

    const currentStyle = STYLES[styleKey];
    const selectedExportRenderStyle =
      exportRenderStyle === "conceptual"
        ? currentStyle
        : {
            ...currentStyle,
            ...EXPORT_RENDER_STYLES[exportRenderStyle],
            wireframe: false,
            exportLook: false
          };
    const heritageExportStyle = {
      ...selectedExportRenderStyle,
      background: exportBackgroundColor,
      ground: exportStageColor
    };
    const currentBackground = scene.background ? scene.background.clone() : null;
    const currentFloorMaterial = floor.material;
    const currentFloorColor = floor.material.color.clone();
    const currentFloorVisible = floor.visible;
    const currentGridVisible = grid?.visible ?? true;
    const currentAutoClear = renderer.autoClear;
    const currentShadowEnabled = renderer.shadowMap.enabled;
    const currentShadowType = renderer.shadowMap.type;
    const currentClippingPlanes = renderer.clippingPlanes;
    const currentClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const currentClearAlpha = renderer.getClearAlpha();
    const currentPixelRatio = renderer.getPixelRatio();
    const currentSize = renderer.getSize(new THREE.Vector2());
    const activeCamera = controls.object;
    const currentCameraFov = activeCamera.isPerspectiveCamera ? activeCamera.fov : null;
    const currentCameraAspect = activeCamera.isPerspectiveCamera ? activeCamera.aspect : null;
    const quality = EXPORT_QUALITY_OPTIONS[exportQuality] ?? EXPORT_QUALITY_OPTIONS.high;
    const formatMaxSide = exportFormat === "png" ? quality.maxSide : Math.min(quality.maxSide, 7200);
    const exportScale = Math.min(
      quality.scale,
      formatMaxSide / Math.max(currentSize.x, currentSize.y, 1)
    );
    const exportSuffix = `${exportScale.toFixed(2).replace(/\.?0+$/, "")}x`;
    const hiddenHelpers = [];
    const shadowSettings = [];
    let temporaryFloorMaterial = null;
    let exportShadowQualityApplied = false;

    selectionHelpersRef.current.forEach((helper) => {
      if (helper.visible) {
        hiddenHelpers.push(helper);
        helper.visible = false;
      }
    });
    scene.traverse((object) => {
      if ((object.userData?.isStageMarker || object.userData?.isStageMap) && object.visible) {
        hiddenHelpers.push(object);
        object.visible = false;
      }
    });

    function applyRenderStyle(style, options = {}) {
      scene.background = new THREE.Color(options.background ?? exportBackgroundColor);
      if (options.updateFloor !== false && floor.material.color) {
        floor.material.color.set(options.ground ?? exportStageColor);
      }
      const renderEdgeThickness = exportSeamlessSolid ? 0 : edgeThickness;
      placedRef.current.forEach(({ mesh, module }) => {
        mesh.traverse((child) => {
          if (child.isMesh) {
            child.material.dispose();
            child.material = createMaterial(module, style);
          }
        });
        applyExportEdges(mesh, style, { color: edgeColor, thickness: renderEdgeThickness });
      });
      updateExportEdgeResolution(modelGroup, renderer.domElement.width, renderer.domElement.height);
    }

    function applyExportGroundMaterial(style) {
      if (style.mode !== "realistic") {
        if (floor.material.color) {
          floor.material.color.set(exportStageColor);
        }
        return;
      }
      if (floor.material === currentFloorMaterial) {
        temporaryFloorMaterial = createRealisticGroundMaterial(exportStageColor);
        floor.material = temporaryFloorMaterial;
      }
      floor.material.needsUpdate = true;
    }

    function createExportGroundBackdropMaterial() {
      if (selectedExportRenderStyle.mode === "realistic") {
        return createRealisticGroundMaterial(exportStageColor);
      }
      return new THREE.MeshBasicMaterial({ color: exportStageColor, side: THREE.DoubleSide });
    }

    function forEachMaterial(material, callback) {
      if (Array.isArray(material)) {
        material.forEach(callback);
      } else if (material) {
        callback(material);
      }
    }

    function prepareExportShadows(force = false) {
      const shouldRenderShadows = exportShadows || exportObjectShadows || force;
      if (!shouldRenderShadows) return;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.needsUpdate = true;
      if (!exportShadowQualityApplied) {
        scene.traverse((object) => {
          if (object.isLight && object.castShadow && object.shadow) {
            shadowSettings.push({
              shadow: object.shadow,
              width: object.shadow.mapSize.width,
              height: object.shadow.mapSize.height,
              bias: object.shadow.bias,
              normalBias: object.shadow.normalBias,
              radius: object.shadow.radius
            });
            object.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
            object.shadow.bias = -0.0002;
            object.shadow.normalBias = 0.015;
            object.shadow.radius = 2.5;
          }
        });
        exportShadowQualityApplied = true;
      }
      scene.traverse((object) => {
        if (object.isLight && object.castShadow && object.shadow) {
          object.shadow.needsUpdate = true;
        }
        if (object.isMesh) {
          object.castShadow = object !== floor && (exportShadows || exportObjectShadows || force);
          object.receiveShadow = object === floor ? exportShadows || force : exportObjectShadows || force;
          forEachMaterial(object.material, (material) => {
            material.needsUpdate = true;
          });
        }
      });
    }

    function applyWalkExportLighting(options = {}) {
      const ambient = ambientLightRef.current;
      const sun = sunLightRef.current;
      if (!ambient || !sun) return;
      const darkExport = options.darkExport === true;
      ambient.intensity = darkExport ? 0.015 : 0.08;
      ambient.groundColor.set(darkExport ? "#050403" : "#1e1a14");
      sun.intensity = darkExport ? 1.85 : 3.8;
      sun.position.set(22, 32, 12);
    }

    function forceWalkExportStage() {
      scene.background = new THREE.Color(exportBackgroundColor);
      if (floor.material !== currentFloorMaterial) {
        temporaryFloorMaterial = floor.material;
        floor.material = currentFloorMaterial;
      }
      applyExportGroundMaterial(selectedExportRenderStyle);
      floor.visible = true;
      floor.receiveShadow = true;
      floor.frustumCulled = false;
      if (grid) grid.visible = false;
    }

    function darkenWalkExportMaterials() {
      placedRef.current.forEach(({ mesh }) => {
        mesh.traverse((child) => {
          if (!child.isMesh || child.userData?.isExportEdge || child.userData?.isSectionCap) return;
          forEachMaterial(child.material, (material) => {
            if (material.color) {
              material.color.multiplyScalar(0.58);
            }
            if (material.emissive) {
              material.emissive.set("#000000");
            }
            material.needsUpdate = true;
          });
        });
      });
    }

    function forceWalkExportShadows() {
      const sun = sunLightRef.current;
      const shouldRenderShadows = exportShadows || exportObjectShadows;
      if (!shouldRenderShadows) {
        renderer.shadowMap.enabled = false;
        floor.receiveShadow = false;
        modelGroup.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = false;
            object.receiveShadow = false;
          }
        });
        return;
      }
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.needsUpdate = true;
      if (sun?.shadow) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
        sun.shadow.bias = -0.0002;
        sun.shadow.normalBias = 0.015;
        sun.shadow.radius = 2.5;
        sun.shadow.needsUpdate = true;
      }
      floor.receiveShadow = exportShadows;
      modelGroup.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = object !== floor && (exportShadows || exportObjectShadows);
          object.receiveShadow = exportObjectShadows;
          forEachMaterial(object.material, (material) => {
            material.needsUpdate = true;
          });
        }
      });
    }

    function restoreScene() {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, currentSize.x, currentSize.y);
      renderer.setPixelRatio(currentPixelRatio);
      renderer.setSize(currentSize.x, currentSize.y, false);
      updateExportEdgeResolution(modelGroup, currentSize.x, currentSize.y);
      renderer.autoClear = currentAutoClear;
      renderer.shadowMap.enabled = currentShadowEnabled;
      renderer.shadowMap.type = currentShadowType;
      renderer.clippingPlanes = currentClippingPlanes;
      renderer.setClearColor(currentClearColor, currentClearAlpha);
      if (activeCamera.isPerspectiveCamera && currentCameraFov !== null && currentCameraAspect !== null) {
        activeCamera.fov = walkMode ? 68 : currentCameraFov;
        activeCamera.aspect = currentCameraAspect;
        activeCamera.updateProjectionMatrix();
      }
      scene.background = currentBackground;
      if (floor.material !== currentFloorMaterial) {
        temporaryFloorMaterial = floor.material;
        floor.material = currentFloorMaterial;
      }
      floor.material.color.copy(currentFloorColor);
      floor.visible = currentFloorVisible;
      if (grid) grid.visible = currentGridVisible;
      hiddenHelpers.forEach((helper) => {
        helper.visible = true;
      });
      placedRef.current.forEach(({ mesh, module }) => {
        mesh.traverse((child) => {
          if (child.isMesh) {
            child.material.dispose();
            child.material = createMaterial(module, currentStyle);
          }
        });
        applyExportEdges(mesh, currentStyle, { color: edgeColor, thickness: edgeThickness });
      });
      updateExportEdgeResolution(modelGroup, currentSize.x, currentSize.y);
      if (walkMode) {
        floor.visible = true;
        floor.material.color.copy(currentFloorColor);
        floor.material.needsUpdate = true;
        floor.receiveShadow = true;
        if (grid) grid.visible = false;
        setExportEdgesVisible(modelGroup, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.needsUpdate = true;
        markSceneMaterialsForUpdate(modelGroup);
      }
      if (activeSectionCuts.length > 0) {
        restoreObjectClippingPlanes(builderSectionClipsRef.current);
        restoreMaterialSides(builderSectionSidesRef.current);
        builderSectionClipsRef.current = setObjectClippingPlanes(
          modelGroup,
          activeSectionCuts.map((cut) => cut.clippingPlane)
        );
        builderSectionSidesRef.current = setObjectMaterialSide(modelGroup, THREE.DoubleSide);
        renderer.localClippingEnabled = true;
      }
      if (temporaryFloorMaterial) {
        temporaryFloorMaterial.dispose();
        temporaryFloorMaterial = null;
      }
      shadowSettings.forEach((setting) => {
        setting.shadow.mapSize.set(setting.width, setting.height);
        setting.shadow.bias = setting.bias;
        setting.shadow.normalBias = setting.normalBias;
        setting.shadow.radius = setting.radius;
        setting.shadow.needsUpdate = true;
      });
      if (walkMode) {
        applyWalkExportLighting();
      }
      renderer.render(scene, controls.object);
    }

    function bytesFromAscii(text) {
      const bytes = new Uint8Array(text.length);
      for (let index = 0; index < text.length; index += 1) {
        bytes[index] = text.charCodeAt(index);
      }
      return bytes;
    }

    function concatBytes(parts) {
      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const output = new Uint8Array(totalLength);
      let offset = 0;
      parts.forEach((part) => {
        output.set(part, offset);
        offset += part.length;
      });
      return output;
    }

    function canvasToBlob(canvas, type, qualityValue) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, qualityValue);
      });
    }

    async function createPdfBlob(canvas) {
      const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
      if (!jpegBlob) throw new Error("Could not create PDF image");
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const dpi = 300;
      const pageWidth = (canvas.width / dpi) * 72;
      const pageHeight = (canvas.height / dpi) * 72;
      const content = `q\n${pageWidth.toFixed(3)} 0 0 ${pageHeight.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`;
      const objects = [
        bytesFromAscii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
        bytesFromAscii("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
        bytesFromAscii(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`),
        concatBytes([
          bytesFromAscii(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`),
          jpegBytes,
          bytesFromAscii("\nendstream\nendobj\n")
        ]),
        bytesFromAscii(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)
      ];
      const header = bytesFromAscii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
      const parts = [header];
      const offsets = [0];
      let byteOffset = header.length;
      objects.forEach((objectBytes) => {
        offsets.push(byteOffset);
        parts.push(objectBytes);
        byteOffset += objectBytes.length;
      });
      const xrefOffset = byteOffset;
      const xrefRows = offsets
        .map((offset, index) => (index === 0 ? "0000000000 65535 f \n" : `${String(offset).padStart(10, "0")} 00000 n \n`))
        .join("");
      parts.push(bytesFromAscii(`xref\n0 ${offsets.length}\n${xrefRows}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
      return new Blob([concatBytes(parts)], { type: "application/pdf" });
    }

    async function saveRenderedCanvas(filenameBase, canvas = renderer.domElement) {
      if (exportFormat === "pdf") {
        downloadBlob(`${filenameBase}.pdf`, await createPdfBlob(canvas));
        return;
      }
      if (exportFormat === "svg") {
        const imageBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
        if (!imageBlob) throw new Error("Could not create SVG image");
        const imageData = `data:image/jpeg;base64,${arrayBufferToBase64(await imageBlob.arrayBuffer())}`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${imageData}" width="${canvas.width}" height="${canvas.height}" /></svg>`;
        downloadBlob(`${filenameBase}.svg`, new Blob([svg], { type: "image/svg+xml" }));
        return;
      }
      const pngBlob = await canvasToBlob(canvas, "image/png");
      if (!pngBlob) throw new Error("Could not create PNG image");
      downloadBlob(`${filenameBase}.png`, pngBlob);
    }

    function arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 32768;
      let binary = "";
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      return window.btoa(binary);
    }

    async function saveLabeledCanvas(filenameBase, labels, borders = []) {
      const output = document.createElement("canvas");
      output.width = renderer.domElement.width;
      output.height = renderer.domElement.height;
      const context = output.getContext("2d");
      context.drawImage(renderer.domElement, 0, 0);
      borders.forEach((border) => {
        context.strokeStyle = border.color ?? darkenHexColor(exportBackgroundColor, 0.6);
        context.lineWidth = border.width ?? Math.max(3, Math.round(output.width * 0.002));
        context.strokeRect(border.x, border.y, border.widthPx, border.heightPx);
      });
      context.fillStyle = darkenHexColor(exportBackgroundColor, 0.6);
      context.font = `800 ${Math.max(38, Math.round(output.width * 0.026))}px Inter, Arial, sans-serif`;
      context.textBaseline = "top";
      context.textAlign = "left";
      labels.filter((label) => label.text).forEach((label) => {
        context.fillText(label.text, label.x, label.y);
      });
      await saveRenderedCanvas(filenameBase, output);
    }

    async function saveAndRestore(savePromise) {
      try {
        await savePromise;
      } finally {
        restoreScene();
      }
    }

    function createOrthoCamera(box, view, aspect, zoom = 1, options = {}) {
      const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
      const size = hasPlacedItems ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(8, 3, 8);
      const center = hasPlacedItems ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
      const maxSize = Math.max(size.x, size.y, size.z, 8);
      const viewHeight = maxSize * 1.8 * zoom;
      const viewWidth = viewHeight * aspect;
      const camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.1,
        2000
      );

      if (view === "top") {
        camera.position.set(center.x, center.y + maxSize * 2, center.z);
        camera.up.set(0, 0, -1);
      } else if (view === "front") {
        camera.position.set(center.x, center.y, center.z + maxSize * 2);
        camera.up.set(0, 1, 0);
      } else if (view === "side") {
        camera.position.set(center.x + maxSize * 2, center.y, center.z);
        camera.up.set(0, 1, 0);
      } else if (view === "section") {
        const cut = options.cut ?? primarySectionCut;
        const normal = cut.normal.clone().normalize();
        const sectionCenter = normal.clone().multiplyScalar(cut.offset);
        if (cut.type === "horizontal") {
          camera.position.set(center.x, sectionCenter.y + maxSize * 2, center.z);
          camera.up.set(0, 0, -1);
          camera.lookAt(center.x, sectionCenter.y, center.z);
        } else {
          sectionCenter.y = center.y + (options.verticalShift ?? 0);
          camera.position.copy(sectionCenter).add(normal.clone().multiplyScalar(maxSize * 2));
          camera.position.y = Math.max(center.y + size.y * 0.45, 2) + (options.verticalShift ?? 0);
          camera.up.set(0, 1, 0);
          camera.lookAt(
            sectionCenter.x,
            Math.max(center.y + size.y * 0.35, 0.8) + (options.verticalShift ?? 0),
            sectionCenter.z
          );
        }
        camera.updateProjectionMatrix();
        return camera;
      } else {
        camera.position.set(center.x + maxSize, center.y + maxSize * 0.9, center.z + maxSize);
        camera.up.set(0, 1, 0);
      }

      camera.lookAt(center);
      camera.updateProjectionMatrix();
      return camera;
    }

    const box = new THREE.Box3().setFromObject(modelGroup);
    const exportWidth = Math.max(1, Math.round(currentSize.x * exportScale));
    const exportHeight = Math.max(1, Math.round(currentSize.y * exportScale));

    renderer.setPixelRatio(1);
    renderer.setSize(exportWidth, exportHeight, false);
    updateExportEdgeResolution(modelGroup, exportWidth, exportHeight);
    if (activeCamera.isPerspectiveCamera) {
      activeCamera.fov = walkMode ? 68 : activeCamera.fov;
      activeCamera.aspect = exportWidth / exportHeight;
      activeCamera.updateProjectionMatrix();
    }
    renderer.shadowMap.enabled = exportShadows || exportObjectShadows;
    if (exportShadows || exportObjectShadows) {
      renderer.shadowMap.needsUpdate = true;
    }

    if (exportMode === "current") {
      if (walkMode) {
        applyRenderStyle(selectedExportRenderStyle, { updateFloor: false });
        forceWalkExportStage();
        applyWalkExportLighting({ darkExport: true });
        setExportEdgesVisible(modelGroup, false);
        if (exportRenderStyle === "conceptual") {
          darkenWalkExportMaterials();
        }
        forceWalkExportShadows();
        if (activeCamera.isPerspectiveCamera) {
          activeCamera.fov = 68;
          activeCamera.aspect = exportWidth / exportHeight;
          activeCamera.updateProjectionMatrix();
        }
        renderer.compile(scene, controls.object);
        renderer.render(scene, controls.object);
      } else if (exportShadows || exportObjectShadows) {
        applyRenderStyle(selectedExportRenderStyle);
        if (grid) grid.visible = false;
        applyExportGroundMaterial(selectedExportRenderStyle);
        floor.visible = true;
        floor.receiveShadow = exportShadows;
        prepareExportShadows();
        renderer.render(scene, controls.object);
      } else {
        applyRenderStyle(selectedExportRenderStyle);
        if (grid) grid.visible = false;
        applyExportGroundMaterial(selectedExportRenderStyle);
      }
      renderer.render(scene, controls.object);
      await saveAndRestore(saveRenderedCanvas(`caravansary-current-view-${exportSuffix}`));
      return;
    }

    if (exportMode === "views") {
      const solidStyle = {
        ...selectedExportRenderStyle,
        wireframe: false,
        exportLook: false
      };
      const gutter = 15 * exportScale;
      const halfWidth = Math.floor((exportWidth - gutter * 3) / 2);
      const halfHeight = Math.floor((exportHeight - gutter * 3) / 2);
      const topY = gutter * 2 + halfHeight;
      const panels = [
        { view: "front", label: "front", x: gutter, y: topY, style: solidStyle },
        { view: "top", label: "top", x: gutter * 2 + halfWidth, y: topY, style: solidStyle },
        { view: "side", label: "side", x: gutter, y: gutter, style: solidStyle },
        { view: "iso", label: "isometric", x: gutter * 2 + halfWidth, y: gutter, style: solidStyle }
      ];
      const panelWidth = halfWidth;
      const panelHeight = halfHeight;
      const viewGroundBackdrops = [];

      function addViewGroundBackdrop(view) {
        if (view !== "front" && view !== "side") return;
        const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
        const size = hasPlacedItems ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(8, 3, 8);
        const center = hasPlacedItems ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
        const maxSize = Math.max(size.x, size.y, size.z, 8);
        const modelBottom = hasPlacedItems ? box.min.y : 0;
        const width = maxSize * 4;
        const height = maxSize * 3;
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = createExportGroundBackdropMaterial();
        const backdrop = new THREE.Mesh(geometry, material);
        backdrop.matrixAutoUpdate = false;
        if (view === "front") {
          backdrop.matrix
            .makeBasis(
              new THREE.Vector3(1, 0, 0),
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(0, 0, 1)
            )
            .setPosition(new THREE.Vector3(center.x, modelBottom - height / 2, center.z - maxSize * 1.6));
        } else {
          backdrop.matrix
            .makeBasis(
              new THREE.Vector3(0, 0, 1),
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(1, 0, 0)
            )
            .setPosition(new THREE.Vector3(center.x - maxSize * 1.6, modelBottom - height / 2, center.z));
        }
        backdrop.renderOrder = -10;
        scene.add(backdrop);
        viewGroundBackdrops.push(backdrop);
      }

      function clearViewGroundBackdrops() {
        viewGroundBackdrops.forEach((backdrop) => {
          scene.remove(backdrop);
          backdrop.geometry.dispose();
          backdrop.material.dispose();
        });
        viewGroundBackdrops.length = 0;
      }

      if (grid) grid.visible = false;
      if (exportShadows) {
        temporaryFloorMaterial = new THREE.ShadowMaterial({
          color: "#000000",
          opacity: 0.28,
          transparent: true
        });
        floor.material = temporaryFloorMaterial;
        floor.visible = true;
      } else {
        floor.visible = false;
      }
      scene.background = new THREE.Color(exportBackgroundColor);
      renderer.setClearColor("#ffffff", 1);
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, exportWidth, exportHeight);
      renderer.clear(true, true, true);
      renderer.setScissorTest(true);
      panels.forEach((panel) => {
        clearViewGroundBackdrops();
        applyRenderStyle(panel.style, { updateFloor: false });
        floor.visible = exportShadows;
        addViewGroundBackdrop(panel.view);
        renderer.setViewport(panel.x, panel.y, panelWidth, panelHeight);
        renderer.setScissor(panel.x, panel.y, panelWidth, panelHeight);
        renderer.clear(true, true, true);
        prepareExportShadows();
        renderer.render(scene, createOrthoCamera(box, panel.view, panelWidth / panelHeight, 0.72));
      });
      clearViewGroundBackdrops();
      await saveAndRestore(saveLabeledCanvas(
        `caravansary-four-view-${exportSuffix}`,
        panels.map((panel) => ({
          text: panel.label,
          x: panel.x + Math.round(gutter * 0.4),
          y: exportHeight - panel.y - panelHeight + Math.round(gutter * 0.4)
        }))
      ));
      return;
    }

    if (exportMode === "section") {
      const solidStyle = {
        ...selectedExportRenderStyle,
        wireframe: false,
        exportLook: false
      };
      const gutter = 15 * exportScale;
      const insetSide = Math.floor(Math.sqrt(exportWidth * exportHeight * 0.08));
      const panels = [
        {
          view: "section",
          label: "section",
          x: 0,
          y: 0,
          width: exportWidth,
          height: exportHeight,
          clipping: true,
          line: false
        },
        {
          view: "top",
          label: "",
          x: exportWidth - insetSide - gutter,
          y: exportHeight - insetSide - gutter,
          width: insetSide,
          height: insetSide,
          clipping: false,
          line: true
        }
      ];
      const sectionCutsForExport = activeSectionCuts.length > 0 ? activeSectionCuts : [primarySectionCut];
      const lines = Object.values(sectionLinesRef.current);
      const lineVisible = lines.map((line) => line?.visible ?? false);
      const capGroup = sectionCapGroupRef.current;
      const capVisible = capGroup?.visible ?? false;
      const temporarySectionBackdrops = [];

      function addSectionStageBackdrop() {
        const cut = primarySectionCut;
        if (cut.type !== "vertical") return;
        const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
        const size = hasPlacedItems ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(8, 3, 8);
        const maxSize = Math.max(size.x, size.y, size.z, 8);
        const modelBottom = hasPlacedItems ? box.min.y : 0;
        const width = maxSize * 6;
        const height = maxSize * 4;
        const normal = cut.normal.clone().normalize();
        const direction = cut.direction.clone().normalize();
        const up = cut.up.clone().normalize();
        const planePoint = normal
          .clone()
          .multiplyScalar(cut.offset)
          .addScaledVector(normal, -maxSize * 1.6)
          .addScaledVector(up, modelBottom - height / 2);
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = createExportGroundBackdropMaterial();
        const backdrop = new THREE.Mesh(geometry, material);
        backdrop.matrixAutoUpdate = false;
        backdrop.matrix.makeBasis(direction, up, normal).setPosition(planePoint);
        backdrop.renderOrder = -10;
        backdrop.userData.isSectionBackdrop = true;
        scene.add(backdrop);
        temporarySectionBackdrops.push(backdrop);
      }

      function removeSectionStageBackdrops() {
        temporarySectionBackdrops.forEach((backdrop) => {
          scene.remove(backdrop);
          backdrop.geometry.dispose();
          backdrop.material.dispose();
        });
        temporarySectionBackdrops.length = 0;
      }

      applyRenderStyle(solidStyle);
      if (capGroup) {
        rebuildSectionCaps({
          capGroup,
          placedItems: placedRef.current,
          cuts: sectionCutsForExport
        });
      }
      if (grid) grid.visible = false;
      floor.visible = false;
      scene.background = new THREE.Color(exportBackgroundColor);
      renderer.setClearColor("#ffffff", 1);
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, exportWidth, exportHeight);
      renderer.clear(true, true, true);
      renderer.setScissorTest(true);

      panels.forEach((panel) => {
        removeSectionStageBackdrops();
        renderer.clippingPlanes = panel.clipping ? sectionCutsForExport.map((cut) => cut.clippingPlane) : [];
        const materialSides = panel.clipping ? setObjectMaterialSide(modelGroup, THREE.DoubleSide) : [];
        lines.forEach((line, index) => {
          const lineKey = index === 0 ? "x" : "y";
          if (line) line.visible = panel.line && sectionCutsForExport.some((cut) => cut.key === lineKey);
        });
        if (capGroup) capGroup.visible = panel.clipping;
        if (panel.view === "section") {
          addSectionStageBackdrop();
        }
        scene.background = new THREE.Color(panel.view === "top" ? "#ffffff" : exportBackgroundColor);
        renderer.setClearColor(panel.view === "top" ? "#ffffff" : exportBackgroundColor, 1);
        renderer.setViewport(panel.x, panel.y, panel.width, panel.height);
        renderer.setScissor(panel.x, panel.y, panel.width, panel.height);
        renderer.clear(true, true, true);
        prepareExportShadows();
        renderer.render(
          scene,
          createOrthoCamera(
            box,
            panel.view,
            panel.width / panel.height,
            panel.view === "top" ? 0.88 : 0.43,
            panel.view === "section" ? { verticalShift: -0.45 } : {}
          )
        );
        restoreMaterialSides(materialSides);
      });
      removeSectionStageBackdrops();

      lines.forEach((line, index) => {
        if (line) line.visible = lineVisible[index];
      });
      if (capGroup) capGroup.visible = capVisible;
      renderer.clippingPlanes = [];
      await saveAndRestore(saveLabeledCanvas(
        `caravansary-section-layout-${exportSuffix}`,
        panels.map((panel) => ({
          text: panel.label,
          x: panel.x + Math.round(gutter * 0.4),
          y: exportHeight - panel.y - panel.height + Math.round(gutter * 0.4)
        })),
        panels
          .filter((panel) => panel.view === "top")
          .map((panel) => ({
            x: panel.x,
            y: exportHeight - panel.y - panel.height,
            widthPx: panel.width,
            heightPx: panel.height,
            color: darkenHexColor(exportBackgroundColor, 0.6),
            width: Math.max(3, Math.round(exportScale * 2))
          }))
      ));
      return;
    }

    if (exportMode === "plan") {
      const solidStyle = {
        ...selectedExportRenderStyle,
        wireframe: false,
        exportLook: false
      };
      const gutter = 15 * exportScale;
      const insetSide = Math.floor(Math.sqrt(exportWidth * exportHeight * 0.08));
      const isoPanel = {
        view: "iso",
        label: "",
        x: exportWidth - insetSide - gutter,
        y: exportHeight - insetSide - gutter,
        width: insetSide,
        height: insetSide
      };
      const mainPanel = {
        view: "section",
        label: "plan",
        x: 0,
        y: 0,
        width: exportWidth,
        height: exportHeight
      };
      const planCut =
        activeSectionCuts.find((cut) => cut.key === "plan") ??
        createSectionCutConfigs({
          xEnabled: false,
          xOffset: 0,
          yEnabled: false,
          yOffset: 0,
          planEnabled: true,
          planHeight: planSectionHeight
        })[0];
      const lineVisible = Object.values(sectionLinesRef.current).map((line) => line?.visible ?? false);
      const capGroup = sectionCapGroupRef.current;
      const capVisible = capGroup?.visible ?? false;
      const panels = [mainPanel, isoPanel];

      applyRenderStyle(solidStyle);
      if (capGroup) {
        rebuildSectionCaps({
          capGroup,
          placedItems: placedRef.current,
          cuts: [planCut]
        });
      }
      Object.values(sectionLinesRef.current).forEach((line) => {
        if (line) line.visible = false;
      });
      if (grid) grid.visible = false;
      floor.visible = false;
      scene.background = new THREE.Color(exportBackgroundColor);
      renderer.setClearColor(exportBackgroundColor, 1);
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, exportWidth, exportHeight);
      renderer.clear(true, true, true);
      renderer.setScissorTest(true);

      panels.forEach((panel) => {
        const isMainPlan = panel === mainPanel;
        renderer.clippingPlanes = isMainPlan ? [planCut.clippingPlane] : [];
        const materialSides = isMainPlan ? setObjectMaterialSide(modelGroup, THREE.DoubleSide) : [];
        if (capGroup) capGroup.visible = isMainPlan;
        floor.visible = isMainPlan && selectedExportRenderStyle.mode === "realistic";
        if (floor.visible) {
          applyExportGroundMaterial(selectedExportRenderStyle);
        }
        const isHiddenPlanLayout = selectedExportRenderStyle.mode === "hidden";
        const panelBackground =
          panel === isoPanel
            ? isHiddenPlanLayout
              ? exportStageColor
              : "#ffffff"
            : isHiddenPlanLayout
              ? "#ffffff"
              : exportStageColor;
        scene.background = new THREE.Color(panelBackground);
        renderer.setClearColor(panelBackground, 1);
        renderer.setViewport(panel.x, panel.y, panel.width, panel.height);
        renderer.setScissor(panel.x, panel.y, panel.width, panel.height);
        renderer.clear(true, true, true);
        prepareExportShadows();
        const camera = createOrthoCamera(
          box,
          panel.view,
          panel.width / panel.height,
          isMainPlan ? 0.72 : 0.92,
          isMainPlan ? { cut: planCut } : {}
        );
        renderer.render(scene, camera);
        restoreMaterialSides(materialSides);
      });

      Object.values(sectionLinesRef.current).forEach((line, index) => {
        if (line) line.visible = lineVisible[index];
      });
      if (capGroup) capGroup.visible = capVisible;
      renderer.clippingPlanes = [];
      await saveAndRestore(saveLabeledCanvas(
        `caravansary-plan-layout-${exportSuffix}`,
        [],
        [{
          x: isoPanel.x,
          y: exportHeight - isoPanel.y - isoPanel.height,
          widthPx: isoPanel.width,
          heightPx: isoPanel.height,
          color: darkenHexColor(exportBackgroundColor, 0.6),
          width: Math.max(3, Math.round(exportScale * 2))
        }]
      ));
      return;
    }

    scene.background = new THREE.Color(heritageExportStyle.background);
    applyExportGroundMaterial(heritageExportStyle);
    if (grid) grid.visible = false;
    placedRef.current.forEach(({ mesh, module }) => {
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.dispose();
          child.material = createMaterial(module, heritageExportStyle);
        }
      });
      applyExportEdges(mesh, heritageExportStyle, {
        color: edgeColor,
        thickness: exportSeamlessSolid ? 0 : edgeThickness
      });
    });
    prepareExportShadows();

    const hasPlacedItems = placedRef.current.length > 0 && Number.isFinite(box.min.x);
    const size = hasPlacedItems ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(8, 3, 8);
    const center = hasPlacedItems ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const maxSize = Math.max(size.x, size.y, size.z, 8);
    const aspect = exportWidth / exportHeight;
    const viewHeight = maxSize * 1.8;
    const viewWidth = viewHeight * aspect;
    const exportCamera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      2000
    );
    exportCamera.position.set(center.x + maxSize, center.y + maxSize * 0.9, center.z + maxSize);
    exportCamera.lookAt(center);
    exportCamera.updateProjectionMatrix();

    renderer.render(scene, exportCamera);
    await saveAndRestore(saveRenderedCanvas(`caravansary-heritage-render-${exportSuffix}`));
  }

  function scalePlacedItems(delta) {
    const itemIds = selectedPlacedIdsRef.current;
    if (itemIds.length === 0) return;
    pushUndoSnapshot();
    itemIds.forEach((itemId) => {
      const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
      if (!item) return;
      const nextScale = Math.max(0.05, Number(((item.instanceScale ?? 1) + delta).toFixed(2)));
      const ratio = nextScale / Math.max(item.instanceScale ?? 1, 0.001);
      item.instanceScale = nextScale;
      item.mesh.scale.multiplyScalar(ratio);
    });
    refreshSelectionHelpers();
    requestSectionViewportRender();
  }

  function clearSelectionHelpers() {
    const scene = sceneRef.current;
    if (!scene) return;
    selectionHelpersRef.current.forEach((helper) => {
      scene.remove(helper);
      helper.geometry.dispose();
      helper.material.dispose();
    });
    selectionHelpersRef.current.clear();
  }

  function syncSelectionHelpers(ids) {
    const scene = sceneRef.current;
    if (!scene) return;
    const selectedIds = new Set(ids);

    selectionHelpersRef.current.forEach((helper, itemId) => {
      if (!selectedIds.has(itemId)) {
        scene.remove(helper);
        helper.geometry.dispose();
        helper.material.dispose();
        selectionHelpersRef.current.delete(itemId);
      }
    });

    ids.forEach((itemId) => {
      const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
      if (!item) return;
      let helper = selectionHelpersRef.current.get(itemId);
      if (!helper) {
        helper = createSelectionBoxHelper();
        scene.add(helper);
        selectionHelpersRef.current.set(itemId, helper);
      }
      updateSelectionBoxHelper(helper, item.mesh);
      helper.visible = true;
    });
    requestSceneRender();
    requestSectionViewportRender();
  }

  function selectPlacedItems(ids) {
    selectedPlacedIdsRef.current = ids;
    selectedPlacedRef.current = ids[ids.length - 1] ?? null;
    setSelectedPlacedIds(ids);
    setSelectedPlaced(ids[ids.length - 1] ?? null);
    syncSelectionHelpers(ids);
  }

  function refreshSelectionHelpers() {
    syncSelectionHelpers(selectedPlacedIdsRef.current);
    if (activeSectionCuts.length > 0 && sectionCapGroupRef.current) {
      rebuildSectionCaps({
        capGroup: sectionCapGroupRef.current,
        placedItems: placedRef.current,
        cuts: activeSectionCuts
      });
    }
  }

  function rotatePlacedItems(itemIds = selectedPlacedIdsRef.current, { recordHistory = true } = {}) {
    if (recordHistory && itemIds.length > 0) {
      pushUndoSnapshot();
    }
    itemIds.forEach((itemId) => {
      const item = placedRef.current.find((placedItem) => placedItem.id === itemId);
      if (!item) return;
      item.rotationY = ((item.rotationY ?? 0) + Math.PI / 4) % (Math.PI * 2);
      item.mesh.rotation.y = item.rotationY;
      lastModuleRotationRef.current.set(item.module.id, item.rotationY);
    });
    refreshSelectionHelpers();
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
  }

  function updateModule(moduleId, changes) {
    setSaveStatus("Unsaved changes");
    setModules((current) =>
      current.map((module) => (module.id === moduleId ? { ...module, ...changes } : module))
    );
  }

  function updateModuleNumber(moduleId, field, value) {
    const minimum = field === "scale" ? 0.05 : 0;
    const fallback = field === "scale" || field === "height" ? 1 : 0;
    const numericValue = Math.max(minimum, asNumber(value, fallback));
    updateModule(moduleId, { [field]: numericValue });
  }

  function updateRotation(moduleId, index, value) {
    const nextValue = asNumber(value, 0);
    setSaveStatus("Unsaved changes");
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) return module;
        const rotationValue = [...(module.rotation ?? [0, 0, 0])];
        rotationValue[index] = nextValue;
        return { ...module, rotation: rotationValue };
      })
    );
  }

  function updateExactDimension(moduleId, field, value) {
    setSaveStatus("Unsaved changes");
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) return module;
        const desired =
          measuredDimensions?.moduleId === moduleId ? measuredDimensions : getDesiredDimensions(module);
        const nextValue = Math.max(0.01, dimensionInputToStage(value, dimensionUnit, desired[field]));

        if (keepDimensionRatio) {
          const ratio = nextValue / Math.max(desired[field], 0.001);
          return {
            ...module,
            customDimensions: {
              width: desired.width * ratio,
              length: desired.length * ratio,
              height: desired.height * ratio
            }
          };
        }

        return {
          ...module,
          customDimensions: {
            width: field === "width" ? nextValue : desired.width,
            length: field === "length" ? nextValue : desired.length,
            height: field === "height" ? nextValue : desired.height
          }
        };
      })
    );
  }

  async function addUploadedModules(files) {
    if (!files) return;
    try {
      const nextModules = await Promise.all(
        Array.from(files)
          .filter((file) => /\.(glb|gltf)$/i.test(file.name))
          .map(async (file) => {
        const id = `uploaded-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await saveUploadedAsset(id, file);
        const cloudAsset = isSupabaseConfigured ? await uploadSupabaseModuleAsset(id, file) : null;
        return {
          id,
          assetKey: id,
          assetPath: cloudAsset?.path ?? null,
          name: stripModelExtension(file.name),
          footprint: [1, 1],
          height: 1,
          color: "#6d8790",
          url: cloudAsset?.url ?? URL.createObjectURL(file),
          scale: 1,
          rotation: [0, 0, 0],
          source: "upload"
        };
          })
      );

      if (nextModules.length === 0) return;
      setSaveStatus("Unsaved changes");
      setModules((current) => [...current, ...nextModules]);
      setSelectedModule(nextModules[0].id);
      setEditingModule(nextModules[0].id);
      setActiveView("admin");
    } catch {
      setSaveStatus("Upload failed");
    }
  }

  function removeModule(moduleId) {
    const nextModules = modules.filter((item) => item.id !== moduleId);
    if (nextModules.length === modules.length || nextModules.length === 0) return;
    const removedItems = placedRef.current.filter((item) => item.module.id === moduleId);
    if (removedItems.length > 0) {
      pushUndoSnapshot();
    }
    removedItems.forEach((item) => {
      modelGroupRef.current?.remove(item.mesh);
      disposeObject(item.mesh);
    });
    placedRef.current = placedRef.current.filter((item) => item.module.id !== moduleId);
    setPlaced(placedRef.current.map(({ id, module }) => ({ id, moduleId: module.id })));
    selectPlacedItems(selectedPlacedIdsRef.current.filter((id) => placedRef.current.some((item) => item.id === id)));
    setSaveStatus("Unsaved changes");
    setModules(nextModules);
    setSelectedModule((current) => (current === moduleId ? nextModules[0].id : current));
    setEditingModule((current) => (current === moduleId ? nextModules[0].id : current));
  }

  async function saveModules() {
    try {
      if (isSupabaseConfigured) {
        await saveSupabaseModuleLibrary(modules);
      }
      window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(serializeModulesForStorage(modules)));
      setSaveStatus(isSupabaseConfigured ? "Saved to cloud" : "Saved");
    } catch {
      setSaveStatus("Save failed");
    }
  }

  async function exportModuleLibrary() {
    try {
      const exportedModules = await Promise.all(
        modules.map(async (module) => {
          const snapshot = serializeModulesForStorage([module])[0];
          if (module.source === "upload" && module.assetKey) {
            const asset = await loadUploadedAsset(module.assetKey);
            if (asset) {
              snapshot.assetDataUrl = await blobToDataUrl(asset);
              snapshot.assetName = asset.name ?? `${module.name}.glb`;
              snapshot.assetType = asset.type || "model/gltf-binary";
            }
          }
          return snapshot;
        })
      );
      const library = {
        version: 1,
        exportedAt: new Date().toISOString(),
        modules: exportedModules
      };
      downloadBlob(
        `caravansary-module-library-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([JSON.stringify(library, null, 2)], { type: "application/json" })
      );
      setSaveStatus("Library exported");
    } catch {
      setSaveStatus("Export failed");
    }
  }

  async function importModuleLibrary(file) {
    if (!file) return;
    try {
      const library = await readJsonFile(file);
      const importedModules = Array.isArray(library) ? library : library.modules;
      if (!Array.isArray(importedModules) || importedModules.length === 0) {
        setSaveStatus("Import failed");
        return;
      }

      const restoredModules = await Promise.all(
        importedModules.map(async (module) => {
          const restored = { ...module };
          if (restored.source === "upload" && restored.assetDataUrl) {
            const assetKey = restored.assetKey || restored.id;
            const blob = dataUrlToBlob(restored.assetDataUrl);
            await saveUploadedAsset(assetKey, blob);
            if (isSupabaseConfigured) {
              const fileName = restored.assetName || `${restored.name || restored.id}.glb`;
              const file = new File([blob], fileName, { type: restored.assetType || blob.type || "model/gltf-binary" });
              const cloudAsset = await uploadSupabaseModuleAsset(restored.id, file);
              restored.assetPath = cloudAsset?.path ?? restored.assetPath;
              restored.url = cloudAsset?.url ?? URL.createObjectURL(blob);
            } else {
              restored.url = URL.createObjectURL(blob);
            }
            restored.assetKey = assetKey;
          } else if (restored.assetPath && !restored.url) {
            restored.url = getSupabaseAssetUrl(restored.assetPath);
          }
          delete restored.assetDataUrl;
          delete restored.assetName;
          delete restored.assetType;
          return restored;
        })
      );

      setModules(restoredModules);
      setSelectedModule(restoredModules[0].id);
      setEditingModule(restoredModules[0].id);
      if (isSupabaseConfigured) {
        await saveSupabaseModuleLibrary(restoredModules);
      }
      window.localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(serializeModulesForStorage(restoredModules)));
      setSaveStatus(isSupabaseConfigured ? "Library imported to cloud" : "Library imported");
    } catch {
      setSaveStatus("Import failed");
    } finally {
      if (moduleLibraryInputRef.current) {
        moduleLibraryInputRef.current.value = "";
      }
    }
  }

  function resetSavedModules() {
    window.localStorage.removeItem(MODULE_STORAGE_KEY);
    clearUploadedAssets().catch(() => {});
    setModules(DEFAULT_MODULES);
    setSelectedModule(DEFAULT_MODULES[0].id);
    setEditingModule(DEFAULT_MODULES[0].id);
    setSaveStatus("Reset");
  }

  const contextItem = contextMenu
    ? placedRef.current.find((item) => item.id === contextMenu.itemId)
    : null;
  const actualDimensions =
    measuredDimensions?.moduleId === editing?.id
      ? measuredDimensions
      : editing
        ? getDesiredDimensions(editing)
        : { width: 0, length: 0, height: 0 };
  const dimensionInputStep = dimensionUnit === "px" ? 1 : 0.01;
  const updateWholeModelRotation = (value) => {
    setRotation(THREE.MathUtils.clamp(asNumber(value, 0), -180, 180));
  };
  const updateWholeModelScale = (value) => {
    setModelScale(THREE.MathUtils.clamp(asNumber(value, 1), 0.05, 10));
  };
  const modulePanelClass = `module-panel${mobileModulePanelOpen ? " mobile-open" : ""}`;
  const toolbarClass = `workspace-toolbar${mobileRibbonOpen ? " mobile-open" : ""}`;
  const mapGuideClass = `map-guide${mobileMapPanelOpen ? " mobile-open" : ""}`;
  const toggleMapGuide = () => {
    const nextOpen = !(mapGuideOpen || mobileMapPanelOpen);
    setMapGuideOpen(nextOpen);
    setMobileMapPanelOpen(nextOpen);
  };
  openLocationModelRef.current = openLocationModel;

  return (
    <main className="designer-shell">
      <input
        ref={openDesignInputRef}
        className="hidden-file"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleDesignFile(event, "open")}
      />
      <input
        ref={importDesignInputRef}
        className="hidden-file"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleDesignFile(event, "import")}
      />
      {(mobileModulePanelOpen || mobileMapPanelOpen || mobileRibbonOpen || mapOverviewOpen) ? (
        <button
          type="button"
          className="mobile-scrim"
          aria-label="Close open panels"
          onClick={() => {
            setMobileModulePanelOpen(false);
            setMobileMapPanelOpen(false);
            setMobileRibbonOpen(false);
            setMapOverviewOpen(false);
          }}
        />
      ) : null}
      <aside className={modulePanelClass} aria-label="Module library">
        <div className="brand-block">
          <span className="brand-mark">
            <Box size={22} aria-hidden="true" />
          </span>
          <div>
            <h1>Caravansary</h1>
            <p>Modular 3D builder</p>
          </div>
          <button
            type="button"
            className="mobile-panel-close"
            aria-label="Close module list"
            onClick={() => setMobileModulePanelOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="view-tabs" aria-label="Workspace mode">
          <button
            type="button"
            className={activeView === "builder" ? "active" : ""}
            onClick={() => setActiveView("builder")}
          >
            <Layers size={16} aria-hidden="true" />
            Builder
          </button>
          <button
            type="button"
            className={activeView === "admin" ? "active" : ""}
            onClick={() => setActiveView("admin")}
          >
            <Settings size={16} aria-hidden="true" />
            Admin
          </button>
        </div>

        {activeView === "builder" ? (
          <>
            <div className="tool-group">
              <label htmlFor="export-render-style">Render Style</label>
              <select
                id="export-render-style"
                value={exportRenderStyle}
                onChange={(event) => setExportRenderStyle(event.target.value)}
              >
                {Object.entries(EXPORT_RENDER_STYLES).map(([key, style]) => (
                  <option key={key} value={key}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="tool-group">
              <label htmlFor="export-mode">Export Type</label>
              <select id="export-mode" value={exportMode} onChange={(event) => setExportMode(event.target.value)}>
                <option value="heritage">Heritage Isometric</option>
                <option value="current">Current View Real Color</option>
                <option value="views">4 View Solid Sheet</option>
                <option value="section">Section Layout</option>
                <option value="plan">Plan Layout</option>
              </select>
            </div>

            <div className="tool-group">
              <label htmlFor="export-format">Export Format</label>
              <select
                id="export-format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
              >
                <option value="png">PNG</option>
                <option value="pdf">PDF</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            <div className="tool-group">
              <label htmlFor="export-quality">Export Quality</label>
              <select
                id="export-quality"
                value={exportQuality}
                onChange={(event) => setExportQuality(event.target.value)}
              >
                {Object.entries(EXPORT_QUALITY_OPTIONS).map(([key, option]) => (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row render-colors">
              <label>
                Stage Color
                <input
                  type="color"
                  value={exportStageColor}
                  onChange={(event) => setExportStageColor(event.target.value)}
                />
              </label>
              <label>
                BG Color
                <input
                  type="color"
                  value={exportBackgroundColor}
                  onChange={(event) => setExportBackgroundColor(event.target.value)}
                />
              </label>
            </div>

            <div className="field-row render-colors">
              <label>
                Edge Color
                <input
                  type="color"
                  value={edgeColor}
                  onChange={(event) => setEdgeColor(event.target.value)}
                />
              </label>
              <label>
                Edge Thick
                <input
                  type="number"
                  min="0"
                  max="6"
                  step="0.25"
                  value={edgeThickness}
                  disabled={exportSeamlessSolid}
                  onChange={(event) => setEdgeThickness(Math.max(0, asNumber(event.target.value, 1)))}
                />
              </label>
            </div>

            <label className="export-shadow-toggle">
              <input
                type="checkbox"
                checked={exportSeamlessSolid}
                onChange={(event) => setExportSeamlessSolid(event.target.checked)}
              />
              Seamless solid
            </label>

            <label className="export-shadow-toggle">
              <input
                type="checkbox"
                checked={exportObjectShadows}
                onChange={(event) => setExportObjectShadows(event.target.checked)}
              />
              Object shadow
            </label>

            <label className="export-shadow-toggle">
              <input
                type="checkbox"
                checked={exportShadows}
                onChange={(event) => setExportShadows(event.target.checked)}
              />
              Cast shadow
            </label>

            <div className="section-control-grid">
              <label className="export-shadow-toggle">
                <input
                  type="checkbox"
                  checked={sectionXEnabled}
                  onChange={(event) => setSectionXEnabled(event.target.checked)}
                />
                X section
              </label>
              <label>
                X section pos
                <input
                  type="number"
                  step="0.25"
                  value={sectionXOffset}
                  onChange={(event) => setSectionXOffset(asNumber(event.target.value, 0))}
                />
              </label>

              <label className="export-shadow-toggle">
                <input
                  type="checkbox"
                  checked={sectionYEnabled}
                  onChange={(event) => setSectionYEnabled(event.target.checked)}
                />
                Y section
              </label>
              <label>
                Y section pos
                <input
                  type="number"
                  step="0.25"
                  value={sectionYOffset}
                  onChange={(event) => setSectionYOffset(asNumber(event.target.value, 0))}
                />
              </label>

              <label className="export-shadow-toggle">
                <input
                  type="checkbox"
                  checked={planSectionEnabled}
                  onChange={(event) => setPlanSectionEnabled(event.target.checked)}
                />
                Plan cut
              </label>
              <label>
                Plan height
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={planSectionHeight}
                  onChange={(event) => setPlanSectionHeight(asNumber(event.target.value, 0.5))}
                />
              </label>
            </div>

            <div className="tool-group">
              <label htmlFor="rotation">Whole Model Rotation</label>
              <div className="range-input-row">
                <input
                  id="rotation"
                  type="range"
                  min="-180"
                  max="180"
                  value={rotation}
                  onChange={(event) => updateWholeModelRotation(event.target.value)}
                />
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotation}
                  aria-label="Whole model rotation degrees"
                  onChange={(event) => updateWholeModelRotation(event.target.value)}
                />
              </div>
            </div>

            <div className="tool-group">
              <label htmlFor="model-scale">Whole Model Scale</label>
              <div className="range-input-row">
                <input
                  id="model-scale"
                  type="range"
                  min="0.05"
                  max="10"
                  step="0.05"
                  value={modelScale}
                  onChange={(event) => updateWholeModelScale(event.target.value)}
                />
                <input
                  type="number"
                  min="0.05"
                  max="10"
                  step="0.05"
                  value={modelScale}
                  aria-label="Whole model scale"
                  onChange={(event) => updateWholeModelScale(event.target.value)}
                />
              </div>
            </div>

            <div className="palette-header">
              <Grid3X3 size={18} aria-hidden="true" />
              <span>{modules.length} Modules</span>
            </div>
            <div className="module-grid">
              {sortedModules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  className={module.id === selectedModule ? "module-chip active" : "module-chip"}
                  draggable
                  onClick={() => addModuleAtCenter(module)}
                  onDragStart={(event) => event.dataTransfer.setData("module-id", module.id)}
                >
                  <img
                    className="module-preview"
                    src={moduleTopThumbnails[module.id]?.url ?? getModuleThumbnail(module)}
                    alt=""
                    draggable="false"
                  />
                  <span>{module.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="admin-panel">
            <input
              ref={fileInputRef}
              className="hidden-file"
              type="file"
              accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
              multiple
              onChange={(event) => void addUploadedModules(event.target.files)}
            />
            <input
              ref={moduleLibraryInputRef}
              className="hidden-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void importModuleLibrary(event.target.files?.[0])}
            />
            <button type="button" className="upload-button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={17} aria-hidden="true" />
              Upload GLB
            </button>

            <div className="save-strip">
              <span>{saveStatus}{isSupabaseConfigured ? " · Shared cloud" : " · Local browser"}</span>
              <button type="button" onClick={() => void saveModules()}>Save Edits</button>
              <button type="button" onClick={() => void exportModuleLibrary()}>Export Library</button>
              <button type="button" onClick={() => moduleLibraryInputRef.current?.click()}>Import Library</button>
              <button type="button" onClick={resetSavedModules}>Reset</button>
            </div>

            <div className="tool-group">
              <label htmlFor="module-select">Module</label>
              <select
                id="module-select"
                value={editing?.id}
                onChange={(event) => {
                  setEditingModule(event.target.value);
                  setSelectedModule(event.target.value);
                }}
              >
                {sortedModules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>

            {editing ? (
              <div className="editor-form">
                <div className="admin-preview">
                  <div className="admin-preview-header">
                    <span>Preview</span>
                    <strong>{editing.name}</strong>
                  </div>
                  <canvas ref={previewCanvasRef} />
                </div>
                <label>
                  Name
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(event) => updateModule(editing.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={editing.color}
                    onChange={(event) => updateModule(editing.id, { color: event.target.value })}
                  />
                </label>
                <div className="dimension-panel">
                  <div className="dimension-unit-row">
                    <span>Dimensions</span>
                    <div className="dimension-controls">
                      <label className="ratio-toggle">
                        <input
                          type="checkbox"
                          checked={keepDimensionRatio}
                          onChange={(event) => setKeepDimensionRatio(event.target.checked)}
                        />
                        Keep ratio
                      </label>
                      <select
                        aria-label="Dimension unit"
                        value={dimensionUnit}
                        onChange={(event) => setDimensionUnit(event.target.value)}
                      >
                        <option value="stage">Stage</option>
                        <option value="px">px</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="field-row thirds">
                  <label>
                    Width
                    <input
                      type="number"
                      min={dimensionInputStep}
                      step={dimensionInputStep}
                      value={formatDimensionInput(actualDimensions.width, dimensionUnit)}
                      onChange={(event) => updateExactDimension(editing.id, "width", event.target.value)}
                    />
                  </label>
                  <label>
                    Length
                    <input
                      type="number"
                      min={dimensionInputStep}
                      step={dimensionInputStep}
                      value={formatDimensionInput(actualDimensions.length, dimensionUnit)}
                      onChange={(event) => updateExactDimension(editing.id, "length", event.target.value)}
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="number"
                      min={dimensionInputStep}
                      step={dimensionInputStep}
                      value={formatDimensionInput(actualDimensions.height, dimensionUnit)}
                      onChange={(event) => updateExactDimension(editing.id, "height", event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Scale
                  <input
                    type="number"
                    min="0.05"
                    step="0.05"
                    value={editing.scale ?? 1}
                    onChange={(event) => updateModuleNumber(editing.id, "scale", event.target.value)}
                  />
                </label>
                <div className="field-row thirds">
                  <label>
                    Rotate X
                    <input
                      type="number"
                      step="5"
                      value={editing.rotation?.[0] ?? 0}
                      onChange={(event) => updateRotation(editing.id, 0, event.target.value)}
                    />
                  </label>
                  <label>
                    Rotate Y
                    <input
                      type="number"
                      step="5"
                      value={editing.rotation?.[1] ?? 0}
                      onChange={(event) => updateRotation(editing.id, 1, event.target.value)}
                    />
                  </label>
                  <label>
                    Rotate Z
                    <input
                      type="number"
                      step="5"
                      value={editing.rotation?.[2] ?? 0}
                      onChange={(event) => updateRotation(editing.id, 2, event.target.value)}
                    />
                  </label>
                </div>
                <div className="admin-actions">
                  <button type="button" onClick={() => setActiveView("builder")}>
                    Use In Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => removeModule(editing.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div className="mobile-only-module-list">
          <div className="palette-header">
            <Grid3X3 size={18} aria-hidden="true" />
            <span>{modules.length} Modules</span>
          </div>
          <div className="module-grid">
            {sortedModules.map((module) => (
              <button
                key={`mobile-${module.id}`}
                type="button"
                className={module.id === selectedModule ? "module-chip active" : "module-chip"}
                draggable
                onClick={() => {
                  addModuleAtCenter(module);
                  setMobileModulePanelOpen(false);
                }}
                onDragStart={(event) => event.dataTransfer.setData("module-id", module.id)}
              >
                <img
                  className="module-preview"
                  src={moduleTopThumbnails[module.id]?.url ?? getModuleThumbnail(module)}
                  alt=""
                  draggable="false"
                />
                <span>{module.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

        <section className="workspace">
          <div className={toolbarClass}>
            <div className="mobile-toolbar-brand">
              <span className="brand-mark">
                <Box size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>Caravansary</strong>
                <span>Modular 3D builder</span>
              </div>
            </div>
            <button
            type="button"
            className="mobile-module-toggle"
            aria-label={mobileModulePanelOpen ? "Close module list" : "Open module list"}
            aria-expanded={mobileModulePanelOpen}
            title="Modules"
            onClick={() => {
              setMobileModulePanelOpen((current) => !current);
              setMobileRibbonOpen(false);
              setMobileMapPanelOpen(false);
            }}
          >
            <Layers size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mobile-ribbon-toggle"
            aria-label="Open ribbon menu"
            aria-expanded={mobileRibbonOpen}
            onClick={() => {
              setMobileRibbonOpen((current) => !current);
              setMobileModulePanelOpen(false);
              setMobileMapPanelOpen(false);
            }}
          >
            {mobileRibbonOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
          <div className="toolbar-actions">
            <div className="mobile-view-tabs view-tabs" aria-label="Mobile workspace mode">
              <button
                type="button"
                className={activeView === "builder" ? "active" : ""}
                onClick={() => setActiveView("builder")}
              >
                <Layers size={16} aria-hidden="true" />
                Builder
              </button>
              <button
                type="button"
                className={activeView === "admin" ? "active" : ""}
                onClick={() => setActiveView("admin")}
              >
                <Settings size={16} aria-hidden="true" />
                Admin
              </button>
            </div>
            <div className="toolbar-group" aria-label="File">
              <span>File</span>
              <button type="button" onClick={() => openDesignInputRef.current?.click()} title="Open model">
                <FolderOpen size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={saveDesignFile} title="Save model">
                <FileDown size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => importDesignInputRef.current?.click()} title="Import model">
                <FileUp size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={downloadRender} title="Export render">
                <Download size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="toolbar-group" aria-label="History">
              <span>History</span>
              <button
                type="button"
                onClick={() => void undoDesign()}
                title="Undo"
                disabled={historyCounts.undo === 0}
              >
                <Undo2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => void redoDesign()}
                title="Redo"
                disabled={historyCounts.redo === 0}
              >
                <Redo2 size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="toolbar-group" aria-label="Transform">
              <span>Transform</span>
              <button
                type="button"
                onClick={() => scalePlacedItems(-0.1)}
                title="Scale selected down"
                disabled={selectedPlacedIds.length === 0}
              >
                <Minimize2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scalePlacedItems(0.1)}
                title="Scale selected up"
                disabled={selectedPlacedIds.length === 0}
              >
                <Maximize2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => rotatePlacedItems()}
                title="Rotate selected"
                disabled={selectedPlacedIds.length === 0}
              >
                <RotateCw size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="toolbar-group" aria-label="View">
              <span>View</span>
              <button
                type="button"
                onClick={centerWholeModel}
                title="Center whole model"
                disabled={placed.length === 0}
              >
                <Crosshair size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => selectPlacedItems(placedRef.current.map((item) => item.id))}
                title="Select all modules"
                className={placed.length > 0 && selectedPlacedIds.length === placed.length ? "active" : ""}
                disabled={walkMode}
              >
                <MousePointer2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setWalkMode((current) => !current)}
                title="Walk view"
                className={walkMode ? "active" : ""}
              >
                <Footprints size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={toggleMapGuide}
                title="Map guide"
                className={mapGuideOpen || mobileMapPanelOpen ? "active" : ""}
              >
                <MapPinned size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={resetCamera} title="Reset camera">
                <Camera size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRotation(0);
                  setModelScale(1);
                }}
                title="Reset model transform"
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={clearDesign} title="Clear design">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mobile-panel-settings">
              {activeView === "builder" ? (
                <>
                  <div className="tool-group">
                    <label htmlFor="mobile-export-render-style">Render Style</label>
                    <select
                      id="mobile-export-render-style"
                      value={exportRenderStyle}
                      onChange={(event) => setExportRenderStyle(event.target.value)}
                    >
                      {Object.entries(EXPORT_RENDER_STYLES).map(([key, style]) => (
                        <option key={key} value={key}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tool-group">
                    <label htmlFor="mobile-export-mode">Export Type</label>
                    <select
                      id="mobile-export-mode"
                      value={exportMode}
                      onChange={(event) => setExportMode(event.target.value)}
                    >
                      <option value="heritage">Heritage Isometric</option>
                      <option value="current">Current View Real Color</option>
                      <option value="views">4 View Solid Sheet</option>
                      <option value="section">Section Layout</option>
                      <option value="plan">Plan Layout</option>
                    </select>
                  </div>

                  <div className="tool-group">
                    <label htmlFor="mobile-export-format">Export Format</label>
                    <select
                      id="mobile-export-format"
                      value={exportFormat}
                      onChange={(event) => setExportFormat(event.target.value)}
                    >
                      <option value="png">PNG</option>
                      <option value="pdf">PDF</option>
                      <option value="svg">SVG</option>
                    </select>
                  </div>

                  <div className="tool-group">
                    <label htmlFor="mobile-export-quality">Export Quality</label>
                    <select
                      id="mobile-export-quality"
                      value={exportQuality}
                      onChange={(event) => setExportQuality(event.target.value)}
                    >
                      {Object.entries(EXPORT_QUALITY_OPTIONS).map(([key, option]) => (
                        <option key={key} value={key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-row render-colors">
                    <label>
                      Stage Color
                      <input
                        type="color"
                        value={exportStageColor}
                        onChange={(event) => setExportStageColor(event.target.value)}
                      />
                    </label>
                    <label>
                      BG Color
                      <input
                        type="color"
                        value={exportBackgroundColor}
                        onChange={(event) => setExportBackgroundColor(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="field-row render-colors">
                    <label>
                      Edge Color
                      <input type="color" value={edgeColor} onChange={(event) => setEdgeColor(event.target.value)} />
                    </label>
                    <label>
                      Edge Thick
                      <input
                        type="number"
                        min="0"
                        max="6"
                        step="0.25"
                        value={edgeThickness}
                        disabled={exportSeamlessSolid}
                        onChange={(event) => setEdgeThickness(Math.max(0, asNumber(event.target.value, 1)))}
                      />
                    </label>
                  </div>

                  <label className="export-shadow-toggle">
                    <input
                      type="checkbox"
                      checked={exportSeamlessSolid}
                      onChange={(event) => setExportSeamlessSolid(event.target.checked)}
                    />
                    Seamless solid
                  </label>

                  <label className="export-shadow-toggle">
                    <input
                      type="checkbox"
                      checked={exportObjectShadows}
                      onChange={(event) => setExportObjectShadows(event.target.checked)}
                    />
                    Object shadow
                  </label>

                  <label className="export-shadow-toggle">
                    <input
                      type="checkbox"
                      checked={exportShadows}
                      onChange={(event) => setExportShadows(event.target.checked)}
                    />
                    Cast shadow
                  </label>

                  <div className="section-control-grid">
                    <label className="export-shadow-toggle">
                      <input
                        type="checkbox"
                        checked={sectionXEnabled}
                        onChange={(event) => setSectionXEnabled(event.target.checked)}
                      />
                      X section
                    </label>
                    <label>
                      X section pos
                      <input
                        type="number"
                        step="0.25"
                        value={sectionXOffset}
                        onChange={(event) => setSectionXOffset(asNumber(event.target.value, 0))}
                      />
                    </label>

                    <label className="export-shadow-toggle">
                      <input
                        type="checkbox"
                        checked={sectionYEnabled}
                        onChange={(event) => setSectionYEnabled(event.target.checked)}
                      />
                      Y section
                    </label>
                    <label>
                      Y section pos
                      <input
                        type="number"
                        step="0.25"
                        value={sectionYOffset}
                        onChange={(event) => setSectionYOffset(asNumber(event.target.value, 0))}
                      />
                    </label>

                    <label className="export-shadow-toggle">
                      <input
                        type="checkbox"
                        checked={planSectionEnabled}
                        onChange={(event) => setPlanSectionEnabled(event.target.checked)}
                      />
                      Plan cut
                    </label>
                    <label>
                      Plan height
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={planSectionHeight}
                        onChange={(event) => setPlanSectionHeight(asNumber(event.target.value, 0.5))}
                      />
                    </label>
                  </div>

                  <div className="tool-group">
                    <label htmlFor="mobile-rotation">Whole Model Rotation</label>
                    <div className="range-input-row">
                      <input
                        id="mobile-rotation"
                        type="range"
                        min="-180"
                        max="180"
                        value={rotation}
                        onChange={(event) => updateWholeModelRotation(event.target.value)}
                      />
                      <input
                        type="number"
                        min="-180"
                        max="180"
                        step="1"
                        value={rotation}
                        aria-label="Whole model rotation degrees"
                        onChange={(event) => updateWholeModelRotation(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="tool-group">
                    <label htmlFor="mobile-model-scale">Whole Model Scale</label>
                    <div className="range-input-row">
                      <input
                        id="mobile-model-scale"
                        type="range"
                        min="0.05"
                        max="10"
                        step="0.05"
                        value={modelScale}
                        onChange={(event) => updateWholeModelScale(event.target.value)}
                      />
                      <input
                        type="number"
                        min="0.05"
                        max="10"
                        step="0.05"
                        value={modelScale}
                        aria-label="Whole model scale"
                        onChange={(event) => updateWholeModelScale(event.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="mobile-admin-note">
                  Admin editing is available in the desktop side panel.
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className="canvas-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleCanvasDrop}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={handleContextMenu}
        >
          {mapGuideOpen || mobileMapPanelOpen ? (
            <div
              className={mapGuideClass}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="map-guide-header">
                <span>Map Guide</span>
                <small>{locationModels.length} items</small>
                <div className="map-guide-header-actions">
                  <button
                    type="button"
                    className={`map-header-mobile-action${mapStageVisible ? " active" : ""}`}
                    onClick={() => setMapStageVisible((current) => !current)}
                  >
                    Stage
                  </button>
                  <button
                    type="button"
                    className={`map-header-mobile-action${mapOverviewOpen ? " active" : ""}`}
                    onClick={() => setMapOverviewOpen(true)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapGuideOpen(false);
                      setMobileMapPanelOpen(false);
                    }}
                    aria-label="Close map guide"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="map-tag-card">
                <iframe
                  key={`guide-map-${mapRefreshKey}-${mapLat}-${mapLon}-${mapZoom}`}
                  title="Google satellite map"
                  src={getGoogleSatelliteUrl(mapLat, mapLon, mapZoom)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="map-list-scroll">
                <div className="map-guide-controls">
                  <label className="map-name-field">
                    Name
                    <input
                      type="text"
                      value={locationModelName}
                      onChange={(event) => setLocationModelName(event.target.value)}
                    />
                  </label>
                  <div className="map-guide-coordinate-row">
                    <label>
                      Lat
                      <input
                        type="number"
                        step="0.000001"
                        value={mapLat}
                        onChange={(event) => setMapLat(asNumber(event.target.value, 0))}
                      />
                    </label>
                    <label>
                      Lon
                      <input
                        type="number"
                        step="0.000001"
                        value={mapLon}
                        onChange={(event) => setMapLon(asNumber(event.target.value, 0))}
                      />
                    </label>
                    <label>
                      Zoom
                      <input
                        type="number"
                        min="1"
                        max="21"
                        step="1"
                        value={mapZoom}
                        onChange={(event) =>
                          setMapZoom(THREE.MathUtils.clamp(asNumber(event.target.value, 18), 1, 21))
                        }
                      />
                    </label>
                  </div>
                  <div className="map-guide-actions">
                    <button type="button" onClick={() => void saveCurrentModelToLocation()}>
                      Tag
                    </button>
                    <button
                      type="button"
                      className={`map-secondary-action${mapStageVisible ? " active" : ""}`}
                      onClick={() => setMapStageVisible((current) => !current)}
                    >
                      Stage
                    </button>
                    <button
                      type="button"
                      className={`map-secondary-action${mapOverviewOpen ? " active" : ""}`}
                      onClick={() => setMapOverviewOpen(true)}
                    >
                      View
                    </button>
                  </div>
                </div>
                <div className="map-model-list">
                  {locationModels.length === 0 ? (
                    <span>No tagged models</span>
                  ) : (
                    locationModels.map((model, index) => (
                      <div key={model.id} className="map-model-item">
                        <div className="map-model-title-row">
                          <span className="map-model-number">{index + 1}</span>
                          <label>
                            Name
                            <input
                              type="text"
                              value={model.name}
                              onChange={(event) => updateLocationModelDraft(model.id, "name", event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="map-model-coordinate-row">
                          <label>
                            Lat
                            <input
                              type="number"
                              step="0.000001"
                              value={model.lat}
                              onChange={(event) => updateLocationModelDraft(model.id, "lat", event.target.value)}
                            />
                          </label>
                          <label>
                            Lon
                            <input
                              type="number"
                              step="0.000001"
                              value={model.lon}
                              onChange={(event) => updateLocationModelDraft(model.id, "lon", event.target.value)}
                            />
                          </label>
                          <label>
                            Zoom
                            <input
                              type="number"
                              min="1"
                              max="21"
                              step="1"
                              value={model.zoom ?? 18}
                              onChange={(event) => updateLocationModelDraft(model.id, "zoom", event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="map-model-actions">
                          <button type="button" onClick={() => void openLocationModel(model)}>Open</button>
                          <button type="button" onClick={() => void saveLocationModelEdits(model)}>Save</button>
                          <button type="button" className="danger" onClick={() => void deleteLocationModel(model.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {mapOverviewOpen ? (
            <div
              className="map-overview"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="map-overview-header">
                <div>
                  <strong>Tagged Models</strong>
                  <span>{locationModels.length} locations</span>
                </div>
                <button type="button" onClick={() => setMapOverviewOpen(false)} aria-label="Close map overview">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div
                ref={mapOverviewBodyRef}
                className="map-overview-body"
              >
                {locationModels.length > 0 ? (
                  <>
                    <img className="map-overview-fallback" src={mapOverviewFallbackUrl} alt="" />
                    <div className="map-overview-pins" aria-label="Tagged model locations">
                      {mapOverviewPins.map(({ model, style }) => (
                        <button
                          key={model.id}
                          type="button"
                          className="map-overview-pin"
                          style={style}
                          title={model.name}
                          onMouseEnter={() => setHoveredMapModelId(model.id)}
                          onMouseLeave={() =>
                            setHoveredMapModelId((current) => (current === model.id ? null : current))
                          }
                          onFocus={() => setHoveredMapModelId(model.id)}
                          onBlur={() => setHoveredMapModelId((current) => (current === model.id ? null : current))}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => void openLocationModel(model)}
                        >
                          <span>{model.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="map-overview-empty">No tagged models saved yet.</div>
                )}
                {hoveredMapModel ? (
                  <div className="map-overview-preview">
                    <strong>{hoveredMapModel.name}</strong>
                    <span>
                      {Number(asNumber(hoveredMapModel.lat, 0)).toFixed(4)},{" "}
                      {Number(asNumber(hoveredMapModel.lon, 0)).toFixed(4)}
                    </span>
                    <div className="map-overview-model-preview">
                      <canvas ref={mapOverviewPreviewCanvasRef} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {contextMenu && contextItem ? (
            <div
              className="placed-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="context-title">{contextItem.module.name}</div>
              <label>
                Color
                <input
                  type="color"
                  value={contextItem.module.color}
                  onChange={(event) => updatePlacedItemColor(contextItem.id, event.target.value)}
                />
              </label>
              <button type="button" onClick={() => deletePlacedItem(contextItem.id)}>
                Delete
              </button>
            </div>
          ) : null}
          {activeSectionCuts.length > 0 ? (
            <div className="section-viewport" onPointerDown={(event) => event.stopPropagation()}>
              <div className="section-viewport-header">
                <Scissors size={15} aria-hidden="true" />
                <span>{primarySectionCut.type === "horizontal" ? "Plan" : primarySectionCut.label}</span>
              </div>
              <canvas ref={sectionCanvasRef} />
            </div>
          ) : null}
          <canvas ref={canvasRef} />
        </div>
      </section>
    </main>
  );
}
