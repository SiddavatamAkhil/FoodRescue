"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/misc";
import { KeyValue, Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/status";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { PasswordSettings, ProfileSettings } from "@/components/shared/settings";
import { api, errorMessage } from "@/lib/api";
import { useMeRequired } from "@/lib/use-me-required";

type System = { environment: string; jurisdiction: string; session_minutes: number; remember_me_days: number; login_max_failures: number; login_window_minutes: number; email_delivery: string; sms_provider?: string | null; max_upload_mb: number; matching: { version: string; weights: Record<string, number> } };

export default function SystemSettingsPage() {
  const me = useMeRequired();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["system"], queryFn: () => api<System>("/admin/system") });
  return (
    <>
      <PageHeader title="System settings" description="Configuration is set through server environment variables. This view is read-only." />
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Platform configuration" />
          {isLoading ? <LoadingRows /> : error ? <ErrorState message={errorMessage(error)} onRetry={refetch} /> : data && (
            <PanelBody>
              <KeyValue items={[
                { label: "Environment", value: data.environment },
                { label: "Jurisdiction", value: data.jurisdiction.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) },
                { label: "Session length", value: `${data.session_minutes / 60} hours, or ${data.remember_me_days} days with "keep me signed in"` },
                { label: "Sign-in lockout", value: `${data.login_max_failures} failed attempts within ${data.login_window_minutes} minutes` },
                { label: "Email delivery", value: data.email_delivery === "smtp" ? <Badge tone="success">SMTP configured</Badge> : <Badge tone="warning">Not configured: emails are written to the server log</Badge> },
                { label: "Phone verification", value: data.sms_provider ? <Badge tone="success">{data.sms_provider}</Badge> : <Badge tone="neutral">No SMS provider configured</Badge> },
                { label: "Document upload limit", value: `${data.max_upload_mb} MB` },
                { label: "Matching weights", value: <span className="tabular">v{data.matching.version}: {Object.entries(data.matching.weights).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}</span> },
              ]} />
            </PanelBody>
          )}
        </Panel>
        <ProfileSettings me={me} />
        <PasswordSettings />
      </div>
    </>
  );
}
