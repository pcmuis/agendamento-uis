'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

export type TrackingMarkerDetail = {
  label: string;
  valor: string;
};

export type TrackingMarker = {
  id: string;
  titulo: string;
  subtitulo?: string;
  status: 'online' | 'offline' | 'unknown';
  coordenadas: { latitude: number; longitude: number };
  detalhes: TrackingMarkerDetail[];
  urlMapa?: string;
};

export type TrackingMapProps = {
  markers: TrackingMarker[];
  focusId: string | null;
  center: { latitude: number; longitude: number };
  onFocusChange: (id: string) => void;
};

const criarIcone = (status: TrackingMarker['status']) =>
  L.divIcon({
    className: 'tracking-marker',
    html: `<span class="tracking-marker-dot tracking-marker-dot-${status}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });

type AtualizadorProps = {
  focus?: TrackingMarker;
  markerRefs: MutableRefObject<Record<string, L.Marker | null>>;
};

const AtualizadorMapa = ({ focus, markerRefs }: AtualizadorProps) => {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;
    map.setView([focus.coordenadas.latitude, focus.coordenadas.longitude], Math.max(map.getZoom(), 13), {
      animate: true,
    });
    const marker = markerRefs.current[focus.id];
    if (marker) {
      marker.openPopup();
    }
  }, [focus, map, markerRefs]);

  return null;
};

export default function TrackingMap({
  markers,
  focusId,
  center,
  onFocusChange,
}: TrackingMapProps) {
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const icons = useMemo(
    () => ({
      online: criarIcone('online'),
      offline: criarIcone('offline'),
      unknown: criarIcone('unknown'),
    }),
    []
  );
  const focusMarker = markers.find((marker) => marker.id === focusId);

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={6}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full rounded-md"
    >
      <ZoomControl position="topright" />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AtualizadorMapa focus={focusMarker} markerRefs={markerRefs} />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.coordenadas.latitude, marker.coordenadas.longitude]}
          icon={icons[marker.status]}
          riseOnHover
          eventHandlers={{
            click: () => onFocusChange(marker.id),
          }}
          ref={(ref) => {
            markerRefs.current[marker.id] = ref;
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={1}
            className="tracking-tooltip"
          >
            <span className="text-[11px] font-semibold text-gray-900">
              {marker.titulo}
            </span>
          </Tooltip>
          <Popup className="tracking-popup">
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-900">{marker.titulo}</p>
                {marker.subtitulo && (
                  <p className="text-[11px] text-gray-500">{marker.subtitulo}</p>
                )}
              </div>
              <div className="grid gap-1 text-xs text-gray-700">
                {marker.detalhes.map((detalhe) => (
                  <div key={`${marker.id}-${detalhe.label}`} className="flex gap-2">
                    <span className="min-w-[88px] text-gray-500">
                      {detalhe.label}
                    </span>
                    <span className="text-gray-900">{detalhe.valor}</span>
                  </div>
                ))}
              </div>
              {marker.urlMapa && (
                <a
                  href={marker.urlMapa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Abrir no OpenStreet
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
