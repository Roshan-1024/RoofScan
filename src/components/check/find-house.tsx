"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type FormEvent } from "react";
import type { Dictionary, Locale } from "@/i18n";
import { isInIndiaBounds } from "@/lib/geo/india";
import { bestImageryZoom, captureSnapshot, type RoofSnapshot } from "@/lib/imagery/esri";
import { RoofUpload } from "./roof-upload";
import type { LatLon, MapView, Region } from "./types";

// Leaflet needs the browser's window, so the map renders on the client only.
const SatelliteMap = dynamic(() => import("./satellite-map"), {
  ssr: false,
  loading: () => <div className="h-[60vh] max-h-[520px] min-h-[320px] w-full animate-pulse bg-surface-muted" />,
});

interface Place {
  id: number;
  label: string;
  lat: number;
  lon: number;
}

type SearchState = "idle" | "loading" | "empty" | "error";
type CaptureState = "idle" | "capturing" | "noImagery" | "error";

/** Whether the pinned spot is confirmed to be in India, where PM Surya Ghar applies. */
type PlaceCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "inIndia"; region: Region }
  | { status: "outsideIndia" }
  | { status: "error" };

/**
 * Country, state and district for a point. Coordinates are rounded to about
 * 100 m, which is plenty for a state or district and lets the server reuse
 * cached answers.
 */
async function lookupRegion(point: LatLon): Promise<Region> {
  const response = await fetch(`/api/region?lat=${point.lat.toFixed(3)}&lon=${point.lon.toFixed(3)}`);
  if (!response.ok) throw new Error(`region lookup returned ${response.status}`);
  return (await response.json()) as Region;
}

export function FindHouse({
  locale,
  dict,
  uploadDict,
  imageDetail,
  onSelected,
}: {
  locale: Locale;
  dict: Dictionary["check"]["find"];
  uploadDict: Dictionary["check"]["upload"];
  imageDetail: string;
  onSelected: (site: { snapshot: RoofSnapshot; region: Region }) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [point, setPoint] = useState<LatLon | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [uploading, setUploading] = useState(false);
  const [placeCheck, setPlaceCheck] = useState<PlaceCheck>({ status: "idle" });
  // Ignores answers for pins the household has since moved.
  const latestCheck = useRef(0);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setSearchState("loading");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}&lang=${locale}`);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { places: Place[] };
      setPlaces(body.places);
      setSearchState(body.places.length ? "idle" : "empty");
    } catch {
      setPlaces([]);
      setSearchState("error");
    }
  }

  function choosePlace(place: Place) {
    setView({ lat: place.lat, lon: place.lon, zoom: 18 });
    setPoint(null);
    setPlaces([]);
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setView({ lat: position.coords.latitude, lon: position.coords.longitude, zoom: 19 });
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function selectPoint(next: LatLon) {
    setPoint(next);
    setCaptureState("idle");
    const check = ++latestCheck.current;
    // India's bounding box also covers parts of its neighbours, so the
    // country is confirmed by reverse geocoding.
    if (!isInIndiaBounds(next.lat, next.lon)) {
      setPlaceCheck({ status: "outsideIndia" });
      return;
    }
    setPlaceCheck({ status: "checking" });
    try {
      const region = await lookupRegion(next);
      if (check !== latestCheck.current) return;
      setPlaceCheck(region.countryCode === "in" ? { status: "inIndia", region } : { status: "outsideIndia" });
    } catch {
      if (check === latestCheck.current) setPlaceCheck({ status: "error" });
    }
  }

  async function measure() {
    if (!point || placeCheck.status !== "inIndia") return;
    setCaptureState("capturing");
    try {
      const zoom = await bestImageryZoom(point.lat, point.lon);
      if (zoom === null) {
        setCaptureState("noImagery");
        return;
      }
      const snapshot = await captureSnapshot(point.lat, point.lon, zoom);
      onSelected({ snapshot, region: placeCheck.region });
    } catch {
      setCaptureState("error");
    }
  }

  function handleUpload(snapshot: RoofSnapshot) {
    if (placeCheck.status === "inIndia") onSelected({ snapshot, region: placeCheck.region });
  }

  const canContinue = point !== null && placeCheck.status === "inIndia";

  if (uploading && canContinue) {
    return (
      <RoofUpload
        point={point}
        dict={uploadDict}
        imageDetail={imageDetail}
        onReady={handleUpload}
        onCancel={() => setUploading(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="address" className="sr-only">
          {dict.searchLabel}
        </label>
        <input
          id="address"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={dict.searchPlaceholder}
          autoComplete="street-address"
          minLength={3}
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3"
        />
        <button
          type="submit"
          disabled={searchState === "loading"}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-ink disabled:opacity-60"
        >
          {searchState === "loading" ? dict.searching : dict.searchButton}
        </button>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="rounded-xl border border-border bg-surface px-5 py-3 font-medium disabled:opacity-60"
        >
          {locating ? dict.locating : dict.useLocation}
        </button>
      </form>

      <div aria-live="polite" className="space-y-2">
        {searchState === "empty" && <p className="text-muted">{dict.noResults}</p>}
        {searchState === "error" && <p className="text-danger">{dict.searchError}</p>}
        {locationError && <p className="text-danger">{dict.locationError}</p>}
        {places.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => choosePlace(place)}
                  className="w-full px-4 py-3 text-left hover:bg-surface-muted"
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="font-medium">{point ? dict.selected : dict.tapRoof}</p>
      <div role="region" aria-label={dict.mapLabel} className="overflow-hidden rounded-2xl border border-border">
        <SatelliteMap view={view} point={point} onTap={selectPoint} />
      </div>

      <div aria-live="polite" className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={measure}
          disabled={!canContinue || captureState === "capturing"}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-ink disabled:opacity-50"
        >
          {captureState === "capturing" ? dict.capturing : dict.measure}
        </button>
        {canContinue && (
          <button
            type="button"
            onClick={() => setUploading(true)}
            className="rounded-full border border-border bg-surface px-5 py-3 font-medium"
          >
            {dict.uploadInstead}
          </button>
        )}
        {placeCheck.status === "checking" && <p className="text-muted">{dict.checkingPlace}</p>}
        {placeCheck.status === "outsideIndia" && <p className="text-danger">{dict.outsideIndia}</p>}
        {placeCheck.status === "error" && <p className="text-danger">{dict.placeCheckError}</p>}
        {captureState === "noImagery" && <p className="text-danger">{dict.noImagery}</p>}
        {captureState === "error" && <p className="text-danger">{dict.imageryError}</p>}
      </div>
    </div>
  );
}
