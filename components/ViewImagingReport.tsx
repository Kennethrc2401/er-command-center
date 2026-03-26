"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { WheelEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Archive, ClipboardList, Download, Eye, EyeOff, FileSearch, Pause, Play, Printer, RotateCcw, SlidersHorizontal, UserCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type WindowPreset = "brain" | "lung" | "soft_tissue";
type CineSpeed = "slow" | "normal" | "fast";
type ExportPreset = "quick" | "clinical" | "full_archive";

const WINDOW_PRESET_FILTER: Record<WindowPreset, string> = {
  brain: "grayscale(100%) contrast(155%) brightness(1.08)",
  lung: "grayscale(100%) contrast(190%) brightness(1.02)",
  soft_tissue: "grayscale(100%) contrast(130%) brightness(1.14)",
};

const WINDOW_PRESET_LABEL: Record<WindowPreset, string> = {
  brain: "Brain",
  lung: "Lung",
  soft_tissue: "Soft Tissue",
};

const CINE_SPEED_MS: Record<CineSpeed, number> = {
  slow: 1200,
  normal: 800,
  fast: 450,
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EXPORT_PRESET_DESCRIPTION: Record<ExportPreset, string> = {
  quick: "Fastest export for a brief handoff summary.",
  clinical: "Recommended chart copy with narrative and key image.",
  full_archive: "Complete package including all simulated slices.",
};

const EXPORT_PRESET_ICON: Record<ExportPreset, typeof Zap> = {
  quick: Zap,
  clinical: ClipboardList,
  full_archive: Archive,
};

const EXPORT_PRESET_CLASS: Record<
  ExportPreset,
  { selected: string; unselected: string }
> = {
  quick: {
    selected: "border-amber-500 bg-amber-50 text-amber-700",
    unselected: "border-amber-200 bg-amber-50/40 text-amber-700/80",
  },
  clinical: {
    selected: "border-blue-500 bg-blue-50 text-blue-700",
    unselected: "border-blue-200 bg-blue-50/40 text-blue-700/80",
  },
  full_archive: {
    selected: "border-slate-500 bg-slate-100 text-slate-700",
    unselected: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

interface ReportProps {
  orderId: string; // Add this to your props
  studyName: string;
  modality: string;
  report?: string;
  orderingPhysician?: string;
  simulatedSeries?: {
    modality: string;
    region?: string;
    generatedAt: number;
    slices: Array<{ label: string; imageDataUri: string }>;
  };
  resultedAt: number;
}

export default function ViewImagingReport({ 
  orderId,
  studyName, 
  modality, 
  report, 
  orderingPhysician,
  simulatedSeries,
  resultedAt 
}: ReportProps) {
  
  // DERIVE the ID from the database record ID. 
  // This is pure, stable, and unique. No Math.random needed!
  const referenceId = orderId.slice(-6).toUpperCase();

  const formattedDate = new Date(resultedAt).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
  const generatedAtLabel = simulatedSeries
    ? new Date(simulatedSeries.generatedAt).toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "N/A";

  const slices = useMemo(() => simulatedSeries?.slices ?? [], [simulatedSeries]);
  const hasSlices = slices.length > 0;
  const [open, setOpen] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState(0);
  const [cinePlaying, setCinePlaying] = useState(false);
  const [cineSpeed, setCineSpeed] = useState<CineSpeed>("normal");
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("brain");
  const [showOverlay, setShowOverlay] = useState(true);
  const [showControlHints, setShowControlHints] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [includeKeyImageInPdf, setIncludeKeyImageInPdf] = useState(true);
  const [includeAppendixInPdf, setIncludeAppendixInPdf] = useState(true);
  const [exportPreset, setExportPreset] = useState<ExportPreset>("clinical");
  const selected = useMemo(() => slices[selectedSlice] ?? slices[0], [slices, selectedSlice]);
  const signingPhysician = orderingPhysician?.trim() || "Ordering Physician";

  const applyExportPreset = useCallback((preset: ExportPreset) => {
    setExportPreset(preset);

    if (preset === "quick") {
      setIncludeKeyImageInPdf(false);
      setIncludeAppendixInPdf(false);
      return;
    }

    if (preset === "clinical") {
      setIncludeKeyImageInPdf(true);
      setIncludeAppendixInPdf(false);
      return;
    }

    setIncludeKeyImageInPdf(true);
    setIncludeAppendixInPdf(true);
  }, []);

  const convertToPngDataUri = useCallback(
    (source: string) =>
      new Promise<string>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            if (!context) {
              reject(new Error("Canvas context unavailable"));
              return;
            }
            context.drawImage(image, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } catch (error) {
            reject(error instanceof Error ? error : new Error("Failed to convert image"));
          }
        };
        image.onerror = () => reject(new Error("Failed to load source image"));
        image.src = source;
      }),
    []
  );

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });

      const brandName = "Nexus ER Ecosystem";
      const nowLabel = new Date().toLocaleString();
      const safeStudy = studyName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const dateStamp = new Date(resultedAt).toISOString().slice(0, 10);
      const filename = `${safeStudy || "imaging_report"}_${dateStamp}_RAD-${referenceId}.pdf`;

      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentTop = margin + 26;
      const contentBottom = pageHeight - margin - 24;

      const drawHeaderFooter = (pageNo: number, totalPages: number) => {
        doc.setPage(pageNo);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(brandName, margin, 20);
        doc.setFont("helvetica", "normal");
        doc.text(`Accesssion RAD-${referenceId}`, pageWidth - margin, 20, { align: "right" });

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, 26, pageWidth - margin, 26);

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("SIMULATED IMAGING - TRAINING USE ONLY", margin, pageHeight - 12);
        doc.text(`Generated ${nowLabel}`, pageWidth / 2, pageHeight - 12, { align: "center" });
        doc.text(`Page ${pageNo} / ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: "right" });
        doc.setTextColor(0, 0, 0);
      };

      let y = contentTop;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Radiology Final Report", margin, y);
      y += 22;

      doc.setFontSize(12);
      doc.text(studyName, margin, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Modality: ${modality}${simulatedSeries?.region ? ` | Region: ${simulatedSeries.region}` : ""}`,
        margin,
        y
      );
      y += 14;
      doc.text(`Accession: RAD-${referenceId}`, margin, y);
      y += 20;

      if (includeKeyImageInPdf && selected?.imageDataUri) {
        try {
          const pngDataUri = await convertToPngDataUri(selected.imageDataUri);
          const imageWidth = 520;
          const imageHeight = 360;
          if (y + imageHeight > contentBottom) {
            doc.addPage();
            y = contentTop;
          }
          doc.addImage(pngDataUri, "PNG", margin, y, imageWidth, imageHeight, undefined, "FAST");
          y += imageHeight + 16;
          doc.setFontSize(9);
          doc.text(`Key Image: ${selected.label}`, margin, y);
          y += 16;
        } catch {
          doc.setFontSize(9);
          doc.text("Key image unavailable in export.", margin, y);
          y += 14;
        }
      }

      if (y > contentBottom - 120) {
        doc.addPage();
        y = contentTop;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Narrative", margin, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      const narrative = report || "The preliminary findings have been recorded. Full transcription pending radiologist final review.";
      const lines = doc.splitTextToSize(narrative, 520);
      for (const line of lines) {
        if (y > contentBottom - 14) {
          doc.addPage();
          y = contentTop;
        }
        doc.text(line, margin, y);
        y += 12;
      }
      y += 16;

      doc.setFont("helvetica", "bold");
      doc.text(signingPhysician, margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.text("Ordering Physician", margin, y);
      y += 12;
      doc.text(`Resulted: ${formattedDate}`, margin, y);
      y += 20;

      if (includeAppendixInPdf && slices.length > 0) {
        doc.addPage();
        y = contentTop;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Appendix: Simulated Slice Series", margin, y);
        y += 18;

        for (const [index, slice] of slices.entries()) {
          if (y > contentBottom - 220) {
            doc.addPage();
            y = contentTop;
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`${slice.label} (${index + 1}/${slices.length})`, margin, y);
          y += 8;

          try {
            const pngDataUri = await convertToPngDataUri(slice.imageDataUri);
            doc.addImage(pngDataUri, "PNG", margin, y, 360, 210, undefined, "FAST");
            y += 220;
          } catch {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text("Image unavailable for this slice.", margin, y + 12);
            y += 24;
          }
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        drawHeaderFooter(page, totalPages);
      }

      doc.save(filename);
      setShowExportOptions(false);
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    convertToPngDataUri,
    formattedDate,
    includeAppendixInPdf,
    includeKeyImageInPdf,
    modality,
    referenceId,
    report,
    resultedAt,
    selected,
    signingPhysician,
    simulatedSeries?.region,
    slices,
    studyName,
  ]);

  const goToNextSlice = useCallback(() => {
    if (!hasSlices) return;
    setSelectedSlice((prev) => (prev + 1) % slices.length);
  }, [hasSlices, slices.length]);

  const goToPreviousSlice = useCallback(() => {
    if (!hasSlices) return;
    setSelectedSlice((prev) => (prev - 1 + slices.length) % slices.length);
  }, [hasSlices, slices.length]);

  useEffect(() => {
    if (!open || !hasSlices || !cinePlaying) return;

    const timer = setInterval(() => {
      goToNextSlice();
    }, CINE_SPEED_MS[cineSpeed]);

    return () => clearInterval(timer);
  }, [open, hasSlices, cinePlaying, cineSpeed, goToNextSlice]);

  useEffect(() => {
    if (!open || !hasSlices) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setCinePlaying((prev) => !prev);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextSlice();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousSlice();
        return;
      }

      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        setShowOverlay((prev) => !prev);
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setShowControlHints((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hasSlices, goToNextSlice, goToPreviousSlice]);

  const handleWheelSliceScroll = (event: WheelEvent<HTMLDivElement>) => {
    if (!hasSlices) return;
    event.preventDefault();

    if (event.deltaY > 0) {
      goToNextSlice();
      return;
    }

    if (event.deltaY < 0) {
      goToPreviousSlice();
    }
  };

  const handlePrintReport = useCallback(() => {
    const narrative = report || "The preliminary findings have been recorded. Full transcription pending radiologist final review.";
    const regionLabel = simulatedSeries?.region ? ` | Region: ${simulatedSeries.region}` : "";
    const keyImage = selected?.imageDataUri;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>RAD-${referenceId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            .header { border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 14px; }
            .title { font-size: 20px; font-weight: 800; margin: 0; }
            .meta { font-size: 12px; color: #475569; margin-top: 4px; }
            .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 0 0 8px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
            .narrative { white-space: pre-wrap; line-height: 1.45; font-size: 13px; }
            .footer { border-top: 1px solid #cbd5e1; margin-top: 14px; padding-top: 10px; font-size: 12px; color: #334155; }
            .warning { margin-top: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #b91c1c; }
            img { max-width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; }
            @page { size: letter; margin: 14mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="section-title">Radiology Final Report</p>
            <h1 class="title">${escapeHtml(studyName)}</h1>
            <div class="meta">Modality: ${escapeHtml(modality)}${escapeHtml(regionLabel)}</div>
            <div class="meta">Accession: RAD-${escapeHtml(referenceId)}</div>
            <div class="meta">Resulted: ${escapeHtml(formattedDate)}</div>
          </div>

          ${keyImage ? `<div class="card"><p class="section-title">Key Image (${escapeHtml(selected?.label ?? "Slice")})</p><img src="${keyImage}" alt="Key imaging slice" /></div>` : ""}

          <div class="card">
            <p class="section-title">Narrative</p>
            <div class="narrative">${escapeHtml(narrative)}</div>
          </div>

          <div class="footer">
            <div><strong>${escapeHtml(signingPhysician)}</strong></div>
            <div>Ordering Physician</div>
          </div>

          <div class="warning">Simulated imaging - training use only</div>

        </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = printWindow?.document;
    if (!printWindow || !printDocument) {
      document.body.removeChild(iframe);
      toast.error("Unable to open print preview. Please allow printing and try again.");
      return;
    }

    const cleanup = () => {
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 0);
    };

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        toast.error("Unable to start print dialog. Please check browser print permissions.");
      } finally {
        cleanup();
      }
    };

    printDocument.open();
    printDocument.write(html);
    printDocument.close();

    window.setTimeout(triggerPrint, 120);
  }, [formattedDate, modality, referenceId, report, selected?.imageDataUri, selected?.label, signingPhysician, simulatedSeries?.region, studyName]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setCinePlaying(false);
          setSelectedSlice(0);
          setWindowPreset("brain");
          setShowExportOptions(false);
          applyExportPreset("clinical");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
        >
          <FileSearch className="h-3.5 w-3.5" /> View Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-150 rounded-3xl overflow-visible p-0 bg-white">
        <DialogHeader className="p-6 bg-slate-50 border-b print:hidden">
          <div className="flex flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-black uppercase tracking-wider">
                Final Narrative: {modality}
              </Badge>
              {simulatedSeries?.region && (
                <Badge className="ml-2 bg-slate-200 text-slate-700 border-none text-[9px] font-black uppercase tracking-wider">
                  Region: {simulatedSeries.region}
                </Badge>
              )}
              <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                {studyName}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 print:p-0">
          <div className="mb-4 flex items-center justify-end gap-2 print:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-slate-200"
              onClick={handlePrintReport}
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-blue-200 bg-blue-50 text-[9px] font-black uppercase tracking-wide text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100 dark:hover:bg-blue-900/70"
                onClick={() => setShowExportOptions((prev) => !prev)}
                disabled={isExportingPdf}
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingPdf ? "Exporting" : "Export PDF"}
              </Button>

              {showExportOptions && (
                <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Export Options</p>

                  <div className="mb-3">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-wide text-slate-500">Preset</p>
                    <div className="flex flex-wrap gap-1">
                      {([
                        { id: "quick", label: "Quick" },
                        { id: "clinical", label: "Clinical" },
                        { id: "full_archive", label: "Full Archive" },
                      ] as Array<{ id: ExportPreset; label: string }>).map((preset) => (
                        (() => {
                          const Icon = EXPORT_PRESET_ICON[preset.id];
                          return (
                            <button
                              key={preset.id}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                                exportPreset === preset.id
                                  ? EXPORT_PRESET_CLASS[preset.id].selected
                                  : EXPORT_PRESET_CLASS[preset.id].unselected
                              }`}
                              onClick={() => applyExportPreset(preset.id)}
                            >
                              <Icon className="h-3 w-3" />
                              {preset.label}
                              {preset.id === "clinical" && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-emerald-700">
                                  Recommended
                                </span>
                              )}
                            </button>
                          );
                        })()
                      ))}
                    </div>
                    <p className="mt-2 text-[9px] font-semibold text-slate-500">
                      {EXPORT_PRESET_DESCRIPTION[exportPreset]}
                    </p>
                  </div>

                  <label className="mb-2 flex items-center gap-2 text-[10px] font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeKeyImageInPdf}
                      onChange={(event) => {
                        setExportPreset("clinical");
                        setIncludeKeyImageInPdf(event.target.checked);
                      }}
                    />
                    Include key image
                  </label>

                  <label className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeAppendixInPdf}
                      onChange={(event) => {
                        setExportPreset("clinical");
                        setIncludeAppendixInPdf(event.target.checked);
                      }}
                    />
                    Include all slices appendix
                  </label>

                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500"
                      onClick={() => setShowExportOptions(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-md bg-blue-600 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white"
                      onClick={() => void handleExportPdf()}
                    >
                      Export
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden print:block p-8">
            <div className="mb-4 border-b border-slate-300 pb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Radiology Final Report</p>
              <h2 className="text-xl font-black tracking-tight text-slate-900">{studyName}</h2>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mt-1">
                Modality: {modality}
                {simulatedSeries?.region ? ` | Region: ${simulatedSeries.region}` : ""}
              </p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">Accession: RAD-{referenceId}</p>
            </div>

            {selected && (
              <div className="mb-4 rounded-xl border border-slate-300 p-2">
                <Image
                  src={selected.imageDataUri}
                  alt={`${studyName} key image ${selected.label}`}
                  width={680}
                  height={480}
                  unoptimized
                  className="h-auto w-full rounded-lg"
                  style={{ filter: WINDOW_PRESET_FILTER[windowPreset] }}
                />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Key Image: {selected.label}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-300 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Narrative</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                {report || "The preliminary findings have been recorded. Full transcription pending radiologist final review."}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-300 pt-3">
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase">{signingPhysician}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Ordering Physician</p>
              </div>
              <p className="text-[10px] font-mono font-bold uppercase text-slate-600">Resulted: {formattedDate}</p>
            </div>

            <p className="mt-3 text-[8px] font-black uppercase tracking-widest text-red-600">
              Simulated Imaging - Training Use Only
            </p>
          </div>

          {hasSlices && selected && (
            <div className="mb-8 space-y-3 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCinePlaying((prev) => !prev)}
                    className="h-8 gap-1 text-[10px] font-black uppercase tracking-wide"
                  >
                    {cinePlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {cinePlaying ? "Pause Cine" : "Play Cine"}
                  </Button>
                  <div className="flex items-center gap-1">
                    {(["slow", "normal", "fast"] as CineSpeed[]).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setCineSpeed(speed)}
                        className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                          cineSpeed === speed
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                    {selected.label}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSlice(0);
                      setWindowPreset("brain");
                      setCinePlaying(false);
                    }}
                    className="h-8 gap-1 text-[10px] font-black uppercase tracking-wide"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset View
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowOverlay((prev) => !prev)}
                    className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                      showOverlay
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Overlay
                    </span>
                  </button>

                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-slate-500">
                    <SlidersHorizontal className="h-3 w-3" /> Window
                  </span>
                  {(Object.keys(WINDOW_PRESET_FILTER) as WindowPreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setWindowPreset(preset)}
                      className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                        windowPreset === preset
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {WINDOW_PRESET_LABEL[preset]}
                    </button>
                  ))}
                </div>
              </div>

              {showControlHints && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Controls</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-600">Space Play/Pause</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-600">Left/Right Slice</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-600">Mouse Wheel Scroll</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-600">O Overlay</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-600">H Hints</span>
              </div>
              )}

              <div
                className="relative rounded-2xl border border-slate-200 bg-slate-950 p-3"
                onWheel={handleWheelSliceScroll}
                title="Scroll to move slices. Arrow keys navigate slices. Space toggles cine."
              >
                <Image
                  src={selected.imageDataUri}
                  alt={`${studyName} ${selected.label}`}
                  width={720}
                  height={520}
                  unoptimized
                  className="h-auto w-full rounded-xl border border-slate-700"
                  style={{ filter: WINDOW_PRESET_FILTER[windowPreset] }}
                />

                {showOverlay && (
                  <>
                    <div className="pointer-events-none absolute left-5 top-5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-100">
                      Modality {modality}
                    </div>
                    <div className="pointer-events-none absolute right-5 top-5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-100">
                      Window {WINDOW_PRESET_LABEL[windowPreset]}
                    </div>
                    <div className="pointer-events-none absolute left-5 bottom-5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-100">
                      {selected.label} {simulatedSeries?.region ? `| ${simulatedSeries.region}` : ""}
                    </div>
                    <div className="pointer-events-none absolute right-5 bottom-5 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-100">
                      Simulated {generatedAtLabel}
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md bg-red-600/80 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white">
                      Simulated Imaging - Training Use Only
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {slices.map((slice, index) => (
                  <button
                    key={slice.label}
                    onClick={() => setSelectedSlice(index)}
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                      index === selectedSlice
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {slice.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 mb-8 print:hidden">
            <p className="text-sm font-serif leading-relaxed text-slate-700 whitespace-pre-wrap italic">
              {report || "The preliminary findings have been recorded. Full transcription pending radiologist final review."}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">
                  Dr. Julian Vance, MD
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Board Certified Radiologist
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                Resulted: {formattedDate}
              </p>
              <p className="text-[8px] text-slate-300 mt-1 font-bold uppercase tracking-tighter">
                ACCESSION: RAD-{referenceId}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}