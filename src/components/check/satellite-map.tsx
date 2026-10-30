"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  displayImageryZoom,
  ESRI_ATTRIBUTION,
  ESRI_IMAGERY_TILES,
  ESRI_LABEL_TILES,
  MAX_IMAGERY_ZOOM,
} from "@/lib/imagery/esri";
import type { LatLon, MapView } from "./types";

const INDIA_CENTER: [number, number] = [22.5, 79];
/** Below this zoom every place has imagery, so there is nothing to check. */
const CHECK_FROM_ZOOM = 14;

function FlyTo({ view }: { view: MapView | null }) {
  const map = useMap();
  useEffect(() => {
    if (view) map.flyTo([view.lat, view.lon], view.zoom, { duration: 1.2 });
  }, [map, view]);
  return null;
}

function TapHandler({ onTap }: { onTap: (point: LatLon) => void }) {
  useMapEvents({
    click(event) {
      onTap({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Keeps imagery tiles at the highest zoom Esri actually has for the area in
 * view. Zooming further enlarges those tiles instead of loading "Map data
 * not yet available" placeholders.
 */
function ImageryZoomTracker({ onChange }: { onChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    let latest = 0;
    async function check() {
      if (map.getZoom() < CHECK_FROM_ZOOM) return;
      const request = ++latest;
      const { lat, lng } = map.getCenter();
      try {
        const zoom = await displayImageryZoom(lat, lng);
        if (request === latest) onChange(zoom);
      } catch {
        // Tile map unreachable: keep the current setting.
      }
    }
    map.on("moveend", check);
    return () => {
      map.off("moveend", check);
    };
  }, [map, onChange]);
  return null;
}

export default function SatelliteMap({
  view,
  point,
  onTap,
}: {
  view: MapView | null;
  point: LatLon | null;
  onTap: (point: LatLon) => void;
}) {
  const [nativeZoom, setNativeZoom] = useState(MAX_IMAGERY_ZOOM);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      minZoom={4}
      maxZoom={MAX_IMAGERY_ZOOM + 1}
      className="h-[60vh] max-h-[520px] min-h-[320px] w-full"
    >
      {/* Remounted when the native zoom changes, so Leaflet re-requests tiles at the new level. */}
      <TileLayer
        key={nativeZoom}
        url={ESRI_IMAGERY_TILES}
        attribution={ESRI_ATTRIBUTION}
        maxNativeZoom={nativeZoom}
        maxZoom={MAX_IMAGERY_ZOOM + 1}
      />
      <TileLayer url={ESRI_LABEL_TILES} maxNativeZoom={MAX_IMAGERY_ZOOM} maxZoom={MAX_IMAGERY_ZOOM + 1} />
      {point && (
        <CircleMarker
          center={[point.lat, point.lon]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#c2410c", fillOpacity: 1 }}
        />
      )}
      <FlyTo view={view} />
      <TapHandler onTap={onTap} />
      <ImageryZoomTracker onChange={setNativeZoom} />
    </MapContainer>
  );
}
