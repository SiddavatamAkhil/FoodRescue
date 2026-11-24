"use client";

import { useState } from "react";
import { Crosshair, Route } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMyTasks } from "@/lib/hooks";
import { directionsUrl } from "@/lib/places";
import { useMeRequired } from "@/lib/use-me-required";

function MapEmbed({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const d = 0.008;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
  return <iframe title={`Map of ${label}`} src={src} className="h-48 w-full rounded border border-line" loading="lazy" />;
}

export default function RoutePage() {
  const me = useMeRequired();
  const { data, isLoading, error, refetch } = useMyTasks();
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const active = (data ?? []).filter((t) => t.status === "ASSIGNED" || t.status === "PICKED_UP");
  const origin = here ?? (me.volunteer?.latitude != null ? { lat: me.volunteer.latitude, lng: me.volunteer.longitude } : null);

  function locate() {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <PageHeader
        title="Route navigation"
        description={here ? "Directions start from your current position." : "Directions start from your saved service area. Use your live location for accuracy."}
        actions={<Button variant="secondary" onClick={locate} loading={locating}><Crosshair className="h-4 w-4" aria-hidden /> Use my live location</Button>}
      />
      {isLoading ? <Panel><LoadingRows /></Panel> : error ? <Panel><ErrorState message={errorMessage(error)} onRetry={refetch} /></Panel> : !active.length ? (
        <Panel><EmptyState icon={Route} title="No route to show">Accept a pickup and its pickup and drop-off stops appear here with directions.</EmptyState></Panel>
      ) : (
        <div className="space-y-6">
          {active.map((t) => {
            const stops = [
              ...(t.status === "ASSIGNED" ? [{ label: `Pickup: ${t.donor_name}`, address: t.pickup_address, lat: t.pickup_latitude, lng: t.pickup_longitude, note: `By ${formatDateTime(t.pickup_deadline)}` }] : []),
              ...(t.dropoff_latitude != null ? [{ label: `Drop-off: ${t.dropoff_name}`, address: t.dropoff_address ?? "", lat: t.dropoff_latitude, lng: t.dropoff_longitude!, note: "Ask for the delivery code on arrival" }] : []),
            ];
            return (
              <Panel key={t.task_id}>
                <PanelHeader title={t.title} description={t.status === "ASSIGNED" ? "Next: collect from the donor" : "Next: deliver to the NGO"} />
                <PanelBody className="grid gap-6 md:grid-cols-2">
                  {stops.map((s, i) => (
                    <div key={s.label} className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-forest text-xs text-white">{i + 1}</span>{s.label}</p>
                        <p className="mt-1 text-sm text-muted">{s.address}</p>
                        <p className="text-xs text-muted">{s.note}</p>
                      </div>
                      <MapEmbed lat={s.lat} lng={s.lng} label={s.label} />
                      <a className="inline-flex h-9 items-center rounded border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-canvas" target="_blank" rel="noopener noreferrer"
                        href={directionsUrl(i === 0 ? origin : { lat: stops[0].lat, lng: stops[0].lng }, { lat: s.lat, lng: s.lng })}>
                        Open directions
                      </a>
                    </div>
                  ))}
                </PanelBody>
              </Panel>
            );
          })}
          <p className="text-xs text-muted">Maps and directions © OpenStreetMap contributors.</p>
        </div>
      )}
    </>
  );
}
