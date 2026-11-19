import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Check,
  Layers,
  LocateFixed,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { RoutePoint } from '../../types/convoy';
import { haversineMeters, LatLngPoint } from '../../utils/geo';
import {
  getTomTomTileUrl,
  reverseGeocodeTomTom,
  searchTomTomPlaces,
  TomTomPlaceResult,
} from '../../services/tomtomMapService';

interface TomTomRoutePickerModalProps {
  mode?: 'origin' | 'destination';
  initialPoint: RoutePoint;
  initialName: string;
  userGpsLocation?: LatLngPoint | null;
  darkMode?: boolean;
  onDismiss: () => void;
  onConfirm: (
    lat: number,
    lng: number,
    placeName: string,
    addressLabel: string
  ) => void;
}

interface LandmarkCoord {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const JAVA_TOURING_LANDMARKS: LandmarkCoord[] = [
  {
    name: 'Puncak Pass Resort',
    address: 'Jl. Raya Puncak KM 90, Cisarua, Bogor',
    lat: -6.7016,
    lng: 106.9949,
  },
  {
    name: 'Taman Safari Cisarua',
    address: 'Jl. Kapten Harun Kabir No. 724, Bogor',
    lat: -6.7169,
    lng: 106.9519,
  },
  {
    name: 'Rest Area KM 57',
    address: 'Tol Jakarta - Cikampek KM 57, Karawang',
    lat: -6.369,
    lng: 107.359,
  },
  {
    name: 'Lembang Highland',
    address: 'Jl. Raya Lembang No. 12, Bandung Barat',
    lat: -6.812,
    lng: 107.618,
  },
  {
    name: 'Simpang Gadog Ciawi',
    address: 'Simpang Gadog KM 45, Bogor',
    lat: -6.6542,
    lng: 106.8712,
  },
  {
    name: 'Kawah Putih Ciwidey',
    address: 'Kawasan Wisata Kawah Putih, Bandung Selatan',
    lat: -7.166,
    lng: 107.402,
  },
];

export function TomTomRoutePickerModal({
  mode = 'destination',
  initialPoint,
  initialName,
  userGpsLocation,
  darkMode = false,
  onDismiss,
  onConfirm,
}: TomTomRoutePickerModalProps) {
  const isOrigin = mode === 'origin';
  const [pin, setPin] = useState<LatLngPoint>({
    lat: initialPoint.latitude || (isOrigin ? -6.648 : -6.7016),
    lng: initialPoint.longitude || (isOrigin ? 106.845 : 106.9949),
  });
  const [placeName, setPlaceName] = useState(
    initialName || (isOrigin ? 'Titik Start Konvoi' : 'Tujuan Konvoi')
  );
  const [addressLabel, setAddressLabel] = useState(
    `${(initialPoint.latitude || -6.7016).toFixed(4)}, ${(initialPoint.longitude || 106.9949).toFixed(4)}`
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TomTomPlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null);

  const nearestLandmarkFallback = (lat: number, lng: number) => {
    let best = JAVA_TOURING_LANDMARKS[0];
    let bestMeters = Infinity;
    for (const lm of JAVA_TOURING_LANDMARKS) {
      const dist = haversineMeters({ lat, lng }, { lat: lm.lat, lng: lm.lng });
      if (dist < bestMeters) {
        bestMeters = dist;
        best = lm;
      }
    }
    return bestMeters < 4000
      ? {
          name: best.name,
          address: `${best.address} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        }
      : null;
  };

  const handleSelectCoord = async (lat: number, lng: number) => {
    setPin({ lat, lng });
    const landmark = nearestLandmarkFallback(lat, lng);
    if (landmark) {
      setPlaceName(landmark.name);
      setAddressLabel(landmark.address);
      return;
    }
    setPlaceName(`Memuat nama lokasi...`);
    setAddressLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const resolved = await reverseGeocodeTomTom(lat, lng);
    setPlaceName(resolved.name);
    setAddressLabel(resolved.address);
  };

  // Debounced TomTom Search API
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchTomTomPlaces(trimmed)
        .then((res) => setSearchResults(res))
        .finally(() => setIsSearching(false));
    }, 320);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initialize picker map
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [pin.lat, pin.lng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    map.on('click', (ev: L.LeafletMouseEvent) => {
      handleSelectCoord(ev.latlng.lat, ev.latlng.lng);
    });

    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      labelLayerRef.current = null;
      pinMarkerRef.current = null;
      gpsMarkerRef.current = null;
    };
  }, []);

  // Sync tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    if (labelLayerRef.current) map.removeLayer(labelLayerRef.current);

    if (mapType === 'hybrid') {
      baseLayerRef.current = L.tileLayer(getTomTomTileUrl('sat', 'main'), {
        maxZoom: 19,
        tileSize: 256,
      }).addTo(map);
      labelLayerRef.current = L.tileLayer(getTomTomTileUrl('labels', 'main'), {
        maxZoom: 19,
        tileSize: 256,
        pane: 'overlayPane',
      }).addTo(map);
    } else {
      baseLayerRef.current = L.tileLayer(
        getTomTomTileUrl('basic', darkMode ? 'night' : 'main'),
        { maxZoom: 19, tileSize: 256 }
      ).addTo(map);
    }
  }, [mapType, darkMode]);

  // Sync pin & user GPS marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pinMarkerRef.current) {
      map.removeLayer(pinMarkerRef.current);
    }

    const pinColor = isOrigin ? '#EA580C' : '#16A34A';
    const pinEmoji = isOrigin ? '🚩' : '🏁';
    const icon = L.divIcon({
      className: '',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      html: `
        <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
          <span style="padding:2px 8px;border-radius:8px;background:#0F172A;color:#fff;font-size:10px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.35);max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${placeName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </span>
          <span style="margin-top:3px;width:30px;height:30px;border-radius:9999px;background:${pinColor};border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">
            ${pinEmoji}
          </span>
        </div>
      `,
    });

    pinMarkerRef.current = L.marker([pin.lat, pin.lng], { icon }).addTo(map);

    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
      gpsMarkerRef.current = null;
    }
    if (userGpsLocation) {
      gpsMarkerRef.current = L.circleMarker(
        [userGpsLocation.lat, userGpsLocation.lng],
        {
          radius: 7,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#1D4ED8',
          fillOpacity: 1,
        }
      ).addTo(map);
    }
  }, [pin.lat, pin.lng, placeName, isOrigin, userGpsLocation?.lat, userGpsLocation?.lng]);

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[390px] h-[640px] max-h-[92vh] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">
              {isOrigin ? 'Pilih Titik Start di TomTom Maps' : 'Pilih Tujuan di TomTom Maps'}
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              {isOrigin
                ? 'Cari lokasi kumpul atau ketuk peta untuk menaruh pin start'
                : 'Cari tempat atau ketuk peta untuk menaruh pin tujuan'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup Peta"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TomTom Places Search */}
        <div className="relative px-3 py-2 bg-[#F8FAFC] dark:bg-[#0B1117] border-b border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center gap-2 px-3 min-h-[40px] rounded-xl bg-white dark:bg-[#141C24] border border-[#CBD5E1] dark:border-[#334155]">
            <Search className="w-4 h-4 text-[#64748B] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isOrigin
                  ? 'Cari titik keberangkatan (mis. Senayan, Gadog)...'
                  : 'Cari tujuan di TomTom (mis. Puncak, Lembang)...'
              }
              className="w-full bg-transparent text-xs outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                aria-label="Hapus pencarian"
                className="text-[#64748B] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {(isSearching || searchResults.length > 0) && (
            <div className="absolute left-3 right-3 top-[52px] z-30 rounded-xl bg-white dark:bg-[#141C24] border border-[#CBD5E1] dark:border-[#334155] shadow-xl max-h-52 overflow-y-auto divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {isSearching ? (
                <p className="p-3 text-[11px] text-[#64748B]">
                  Mencari lokasi di TomTom...
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPin({ lat: item.lat, lng: item.lng });
                      setPlaceName(item.name);
                      setAddressLabel(item.address);
                      setSearchQuery('');
                      setSearchResults([]);
                      mapRef.current?.setView([item.lat, item.lng], 14, {
                        animate: true,
                      });
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] cursor-pointer"
                  >
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {item.address}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Map Canvas */}
        <div className="relative flex-1 min-h-[240px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          <button
            type="button"
            onClick={() =>
              setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))
            }
            aria-label="Ubah Tampilan Peta"
            className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-xl border shadow-md flex items-center justify-center cursor-pointer ${
              mapType === 'hybrid'
                ? 'bg-[#1D4ED8] text-white border-[#1E40AF]'
                : 'bg-white dark:bg-[#141C24] border-[#CBD5E1] dark:border-[#334155]'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>

          {userGpsLocation && (
            <button
              type="button"
              onClick={() => {
                setPin(userGpsLocation);
                setPlaceName('Lokasi GPS Saya Saat Ini');
                setAddressLabel(
                  `${userGpsLocation.lat.toFixed(5)}, ${userGpsLocation.lng.toFixed(5)}`
                );
                mapRef.current?.setView(
                  [userGpsLocation.lat, userGpsLocation.lng],
                  14,
                  { animate: true }
                );
              }}
              className="absolute bottom-3 right-3 z-20 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#141C24] border border-[#CBD5E1] dark:border-[#334155] shadow-md text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Pin di GPS Saya</span>
            </button>
          )}
        </div>

        {/* Footer Confirm Panel */}
        <div className="px-3.5 pt-3.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isOrigin
                  ? 'bg-[#FFF7ED] dark:bg-[#431407] text-[#EA580C]'
                  : 'bg-[#ECFDF5] dark:bg-[#064E3B] text-[#16A34A]'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                aria-label={isOrigin ? 'Nama Titik Start' : 'Nama Lokasi Tujuan'}
                className="w-full text-xs font-bold bg-transparent border-b border-transparent focus:border-[#1D4ED8] outline-none pb-0.5"
              />
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                {addressLabel}
              </p>
              <p className="text-[10px] font-mono text-[#1D4ED8] dark:text-[#60A5FA]">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 min-h-[42px] rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirm(
                  pin.lat,
                  pin.lng,
                  placeName.trim() ||
                    (isOrigin ? 'Titik Start Konvoi' : 'Titik Tujuan Konvoi'),
                  addressLabel
                )
              }
              className={`flex-1 min-h-[42px] rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                isOrigin
                  ? 'bg-[#EA580C] hover:bg-[#C2410C]'
                  : 'bg-[#16A34A] hover:bg-[#15803D]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isOrigin ? 'Tetapkan Titik Start' : 'Tetapkan Tujuan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
