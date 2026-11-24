"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Shows a custody code as a QR image plus the text, for scanning or reading out. */
export function CustodyCode({ code, label, help }: { code: string; label: string; help: string }) {
  const [svg, setSvg] = useState("");
  const { notify } = useToast();
  useEffect(() => {
    QRCode.toString(code, { type: "svg", margin: 0, color: { dark: "#202A26", light: "#FFFFFF" }, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [code]);
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-forest-100 bg-forest-50/60 p-5 sm:flex-row sm:items-start">
      <div className="h-36 w-36 shrink-0 rounded bg-white p-2 [&_svg]:h-full [&_svg]:w-full" role="img" aria-label={`QR code for ${label}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-muted">{help}</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-line bg-surface px-2 py-1.5 text-xs">{code}</code>
          <button
            type="button"
            onClick={async () => { await navigator.clipboard.writeText(code); notify("Code copied"); }}
            className="inline-flex h-8 items-center gap-1 rounded border border-line-strong bg-surface px-2.5 text-xs font-semibold hover:bg-canvas"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
