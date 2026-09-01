import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import ScreeningPdf, { type ScreeningPdfProps } from "./ScreeningPdf";

const buildFilename = (url: string, timestamp: string) => {
  let domain = url;
  try {
    domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    /* keep raw */
  }
  domain = domain.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "-");
  const d = new Date(timestamp);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const iso = date.toISOString().slice(0, 10);
  return `ada-screening-${domain}-${iso}.pdf`;
};

const PdfDownload = (props: ScreeningPdfProps) => {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await pdf(<ScreeningPdf {...props} />).toBlob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = buildFilename(props.url, props.timestamp);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handleDownload} className="btn-webtech-primary" aria-disabled={busy}>
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Download PDF Report
    </Button>
  );
};

export default PdfDownload;
