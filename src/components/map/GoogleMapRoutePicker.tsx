import { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Check, Flag, LocateFixed, MapPin, X } from 'lucide-react';
import { RoutePoint } from '../../types/convoy';
import { haversineMeters, LatLngPoint } from '../../utils/geo';

interface GoogleMapRoutePickerModalProps {
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

function PlaceSearchBar({
  onSelectPlace,
}: {
  onSelectPlace: (lat: number, lng: number, name: string, address: string) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;
    const AutocompleteEl = (placesLib as unknown as {
      PlaceAutocompleteElement?: new (opts?: Record<string, unknown>) => HTMLElement;
    }).PlaceAutocompleteElement;

    if (!AutocompleteEl) return;

    const el = new AutocompleteEl({
      includedRegionCodes: ['id'],
    });
    el.style.width = '100%';
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(el);

    const handleSelect = async (ev: Event) => {
      try {
        const placePrediction = (ev as CustomEvent & { placePrediction?: any })
          .placePrediction;
        if (!placePrediction) return;
        const place = placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();
          map?.panTo({ lat, lng });
          map?.setZoom(14);
          onSelectPlace(
            lat,
            lng,
            place.displayName || 'Lokasi Dipilih',
            place.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          );
        }
      } catch (err) {
        const msg = String(err);
        if (/429|RESOURCE_EXHAUSTED|Quota/i.test(msg)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    };

    el.addEventListener('gmp-select', handleSelect);
    return () => {
      el.removeEventListener('gmp-select', handleSelect);
    };
  }, [placesLib, map]);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[40px] rounded-xl overflow-hidden bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155]"
    />
  );
}

export function GoogleMapRoutePickerModal({
  initialPoint,
  initialName,
  userGpsLocation,
  darkMode = false,
  onDismiss,
  onConfirm,
}: GoogleMapRoutePickerModalProps) {
  const [pin, setPin] = useState<LatLngPoint>({
    lat: initialPoint.latitude || -6.7016,
    lng: initialPoint.longitude || 106.9949,
  });
  const [placeName, setPlaceName] = useState(initialName || 'Tujuan Konvoi');
  const [addressLabel, setAddressLabel] = useState(
    `${(initialPoint.latitude || -6.7016).toFixed(4)}, ${(initialPoint.longitude || 106.9949).toFixed(4)}`
  );

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  const nearestLandmarkLabel = (lat: number, lng: number) => {
    let best = JAVA_TOURING_LANDMARKS[0];
    let bestMeters = Infinity;
    for (const lm of JAVA_TOURING_LANDMARKS) {
      const dist = haversineMeters({ lat, lng }, { lat: lm.lat, lng: lm.lng });
      if (dist < bestMeters) {
        bestMeters = dist;
        best = lm;
      }
    }
    return bestMeters < 5000
      ? { name: best.name, address: `${best.address} · ${lat.toFixed(4)}, ${lng.toFixed(4)}` }
      : {
          name: `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
          address: `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[390px] h-[640px] max-h-[92vh] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">
              Pilih Tujuan di Google Maps
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              Cari tempat atau ketuk peta untuk menaruh pin tujuan
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

        {/* Places Autocomplete Search */}
        {apiKey && (
          <div className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#0B1117] border-b border-[#E2E8F0] dark:border-[#334155]">
            <PlaceSearchBar
              onSelectPlace={(lat, lng, name, address) => {
                setPin({ lat, lng });
                setPlaceName(name);
                setAddressLabel(address);
              }}
            />
          </div>
        )}

        {/* Map Canvas */}
        <div className="relative flex-1 min-h-[240px]">
          {apiKey ? (
            <GoogleMap
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={pin}
              defaultZoom={11}
              gestureHandling="greedy"
              disableDefaultUI
              colorScheme={darkMode ? 'DARK' : 'LIGHT'}
              style={{ width: '100%', height: '100%' }}
              onClick={(ev) => {
                const ll = ev.detail.latLng;
                if (!ll) return;
                setPin({ lat: ll.lat, lng: ll.lng });
                const resolved = nearestLandmarkLabel(ll.lat, ll.lng);
                setPlaceName(resolved.name);
                setAddressLabel(resolved.address);
              }}
            >
              {userGpsLocation && (
                <AdvancedMarker position={userGpsLocation} zIndex={10}>
                  <div className="w-4 h-4 rounded-full bg-[#EA580C] border-2 border-white shadow-md" />
                </AdvancedMarker>
              )}

              <AdvancedMarker position={pin} zIndex={25}>
                <div className="flex flex-col items-center">
                  <span className="px-2 py-0.5 rounded-lg bg-[#0F172A] text-white text-[10px] font-semibold shadow-md max-w-[170px] truncate">
                    {placeName}
                  </span>
                  <span className="mt-1 w-8 h-8 rounded-full bg-[#16A34A] border-2 border-white shadow-lg flex items-center justify-center text-white">
                    <Flag className="w-4 h-4" />
                  </span>
                </div>
              </AdvancedMarker>
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-6 text-center text-xs text-[#64748B]">
              Google Maps API Key belum tersedia untuk pratinjau pemilih lokasi.
            </div>
          )}

          {userGpsLocation && (
            <button
              type="button"
              onClick={() => {
                setPin(userGpsLocation);
                setPlaceName('Lokasi GPS Saya Saat Ini');
                setAddressLabel(
                  `${userGpsLocation.lat.toFixed(5)}, ${userGpsLocation.lng.toFixed(5)}`
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
        <div className="p-3.5 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#ECFDF5] dark:bg-[#064E3B] text-[#16A34A] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                aria-label="Nama Lokasi Tujuan"
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
                  placeName.trim() || 'Titik Tujuan Konvoi',
                  addressLabel
                )
              }
              className="flex-1 min-h-[42px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Tetapkan Tujuan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
