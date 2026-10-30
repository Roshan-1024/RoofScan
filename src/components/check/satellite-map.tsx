"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ESRI_ATTRIBUTION, ESRI_IMAGERY_TILES, ESRI_LABEL_TILES, MAX_IMAGERY_ZOOM } from "@/lib/imagery/esri";
import type { LatLon, MapView } from "./types";

const INDIA_CENTER: [number, number] = [22.5, 79];

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

export default function SatelliteMap({
  view,
  point,
  onTap,
}: {
  view: MapView | null;
  point: LatLon | null;
  onTap: (point: LatLon) => void;
}) {
  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      minZoom={4}
      maxZoom={MAX_IMAGERY_ZOOM + 1}
      className="h-[60vh] max-h-[520px] min-h-[320px] w-full"
    >
      <TileLayer
        url={ESRI_IMAGERY_TILES}
        attribution={ESRI_ATTRIBUTION}
        maxNativeZoom={MAX_IMAGERY_ZOOM}
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
    </MapContainer>
  );
}
