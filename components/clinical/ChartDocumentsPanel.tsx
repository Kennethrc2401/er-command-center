"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.dcm,.dicom,application/pdf,image/jpeg,image/png,image/webp,application/dicom";

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
  "application/dicom+json",
]);

const DOCUMENT_CATEGORIES = [
  "LAB_RESULT",
  "EXTERNAL_RESULT",
  "RADIOLOGY_IMAGE",
  "LETTER",
  "BILLING",
  "MISC",
] as const;

type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
type FilterCategory = "ALL" | DocumentCategory;
type StaffRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "CCMA"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "PHARMACIST"
  | "RESPIRATORY_THERAPIST"
  | "RAD_TECH"
  | "SCRUB_TECH"
  | "UNIT_COORDINATOR"
  | "UNKNOWN";

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LAB_RESULT: "Lab Result",
  EXTERNAL_RESULT: "External Result",
  RADIOLOGY_IMAGE: "Radiology Image",
  LETTER: "Letter",
  BILLING: "Billing",
  MISC: "Misc",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".dcm") ||
    lower.endsWith(".dicom")
  );
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    return "File exceeds 20MB maximum upload size.";
  }

  const mimeAllowed = ACCEPTED_MIME_TYPES.has(file.type.toLowerCase());
  if (!mimeAllowed && !hasAllowedExtension(file.name)) {
    return "Unsupported type. Allowed: PDF, JPG, PNG, WEBP, DICOM.";
  }

  return null;
}

function iconForCategory(category: DocumentCategory) {
  if (category === "RADIOLOGY_IMAGE") return <FileImage className="h-4 w-4 text-violet-600" />;
  if (category === "BILLING") return <Receipt className="h-4 w-4 text-amber-600" />;
  if (category === "LETTER") return <FileText className="h-4 w-4 text-sky-600" />;
  return <FileArchive className="h-4 w-4 text-slate-600" />;
}

interface ChartDocumentsPanelProps {
  encounterId: Id<"encounters">;
  patientId: Id<"patients">;
  uploadedBy: string;
  actorRole: StaffRole;
}

export default function ChartDocumentsPanel({
  encounterId,
  patientId,
  uploadedBy,
  actorRole,
}: ChartDocumentsPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("MISC");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<Id<"chartDocuments"> | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const docs = useQuery(api.chartDocuments.listByEncounter, {
    encounterId,
    category: filterCategory === "ALL" ? undefined : filterCategory,
    actorRole,
    includeArchived: showArchived,
  });

  const auditLogs = useQuery(api.chartDocuments.getAuditByEncounter, {
    encounterId,
    actorRole,
    limit: 30,
  });

  const generateUploadUrl = useMutation(api.chartDocuments.generateUploadUrl);
  const saveUploadedDocument = useMutation(api.chartDocuments.saveUploadedDocument);
  const removeDocument = useMutation(api.chartDocuments.removeDocument);
  const logDocumentAccess = useMutation(api.chartDocuments.logDocumentAccess);
  const applyRetentionByEncounter = useMutation(api.chartDocuments.applyRetentionByEncounter);

  const totalCount = docs?.length ?? 0;
  const canUploadRole = actorRole !== "UNKNOWN";
  const canDeleteRole = actorRole === "ADMIN" || actorRole === "DOCTOR" || actorRole === "NURSE" || actorRole === "SURGEON";
  const canUpload = !!selectedFile && !isUploading && canUploadRole;

  const categoryOptions = useMemo(() => DOCUMENT_CATEGORIES, []);
  const previewDoc = useMemo(
    () => docs?.find((doc) => doc._id === previewDocumentId) ?? null,
    [docs, previewDocumentId]
  );

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Choose a file before uploading.");
      return;
    }

    if (!canUploadRole) {
      toast.error("You do not have permission to upload files.");
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      });

      if (!uploadResult.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadResult.json()) as { storageId?: Id<"_storage"> };
      if (!storageId) throw new Error("No storage id was returned");

      await saveUploadedDocument({
        encounterId,
        patientId,
        storageId,
        category,
        fileName: selectedFile.name,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        contentType: selectedFile.type || "application/octet-stream",
        sizeBytes: selectedFile.size,
        uploadedBy,
        uploadedByRole: actorRole,
      });

      setSelectedFile(null);
      setTitle("");
      setNotes("");
      setCategory("MISC");
      toast.success("Document uploaded and linked to chart.");
    } catch (error) {
      console.error("Document upload failed", error);
      toast.error("Unable to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: Id<"chartDocuments">, fileName: string) => {
    if (!canDeleteRole) {
      toast.error("Only nurse/doctor/admin roles can delete chart files.");
      return;
    }

    const confirmed = window.confirm(`Delete ${fileName} from this chart?`);
    if (!confirmed) return;

    try {
      await removeDocument({ documentId, actorName: uploadedBy, actorRole });
      if (previewDocumentId === documentId) {
        setPreviewDocumentId(null);
      }
      toast.success("Document removed.");
    } catch (error) {
      console.error("Failed to delete document", error);
      toast.error("Unable to remove document.");
    }
  };

  const handlePreview = async (documentId: Id<"chartDocuments">) => {
    setPreviewDocumentId(documentId);
    try {
      await logDocumentAccess({
        documentId,
        action: "VIEW",
        actorName: uploadedBy,
        actorRole,
      });
    } catch {
      // Keep preview non-blocking.
    }
  };

  const handleOpen = async (documentId: Id<"chartDocuments">, fileUrl: string | null) => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");

    try {
      await logDocumentAccess({
        documentId,
        action: "DOWNLOAD",
        actorName: uploadedBy,
        actorRole,
      });
    } catch {
      // Download/open should not be blocked by audit issues.
    }
  };

  const supportsInlinePreview =
    previewDoc &&
    previewDoc.fileUrl &&
    (previewDoc.contentType.startsWith("image/") || previewDoc.contentType === "application/pdf");

  useEffect(() => {
    if (actorRole === "UNKNOWN") return;

    void applyRetentionByEncounter({
      encounterId,
      actorName: uploadedBy,
      actorRole,
    }).catch(() => {
      // Retention sync should not block the UI.
    });
  }, [encounterId, actorRole, applyRetentionByEncounter, uploadedBy]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Chart Document Upload
            </h3>
            <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-black uppercase tracking-wide">
              {uploadedBy}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Document File</Label>
              <Input
                type="file"
                accept={ACCEPT_ATTR}
                onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                className="text-xs font-semibold"
              />
              {selectedFile && (
                <p className="text-[10px] font-semibold text-slate-500">
                  {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
              <p className="text-[10px] text-slate-400">
                Allowed: PDF, JPG, PNG, WEBP, DICOM. Max size: 20MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</Label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as DocumentCategory)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {CATEGORY_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Title (optional)</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Outside CBC Result"
                className="text-xs font-semibold"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Additional context, source, or routing notes"
                className="min-h-20 text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={!canUpload}
              className="rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Uploading
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-3.5 w-3.5" /> Upload to Chart
                </>
              )}
            </Button>
          </div>
          {!canUploadRole && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
              Upload permission unavailable for this session.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Chart Files
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchived((prev) => !prev)}
                className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wide ${
                  showArchived
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-600"
                }`}
              >
                {showArchived ? "Showing Archived" : "Hide Archived"}
              </button>
              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase tracking-wide">
                {totalCount} file{totalCount === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", ...DOCUMENT_CATEGORIES] as const).map((option) => {
              const isActive = filterCategory === option;
              const label = option === "ALL" ? "All" : CATEGORY_LABELS[option];
              return (
                <button
                  key={option}
                  onClick={() => setFilterCategory(option)}
                  className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wide transition-all ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {docs === undefined ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No files found</p>
              <p className="mt-1 text-[10px] text-slate-400">Upload lab PDFs, external reports, images, and letters here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc._id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {iconForCategory(doc.category)}
                        <p className="truncate text-sm font-black tracking-tight text-slate-800 dark:text-slate-100">
                          {doc.title || doc.fileName}
                        </p>
                      </div>
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {doc.fileName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="h-5 border border-slate-200 bg-white px-2 text-[8px] font-black uppercase tracking-wider text-slate-600">
                          {CATEGORY_LABELS[doc.category]}
                        </Badge>
                        {doc.isArchived && (
                          <Badge className="h-5 border border-amber-200 bg-amber-50 px-2 text-[8px] font-black uppercase tracking-wider text-amber-700">
                            Archived
                          </Badge>
                        )}
                        <span className="text-[10px] font-bold text-slate-500">{formatBytes(doc.sizeBytes)}</span>
                        <span className="text-[10px] font-bold text-slate-400">Uploaded {new Date(doc.uploadedAt).toLocaleString()}</span>
                        {doc.retentionPolicyDays && (
                          <span className="text-[10px] font-bold text-slate-400">
                            Retention: {doc.retentionPolicyDays} days
                          </span>
                        )}
                        {doc.expiresAt && (
                          <span className={`text-[10px] font-bold ${doc.isArchived ? "text-amber-600" : "text-slate-400"}`}>
                            Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {doc.notes && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{doc.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.fileUrl && (
                        <button
                          onClick={() => handlePreview(doc._id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                      )}
                      {doc.fileUrl && (
                        <button
                          onClick={() => handleOpen(doc._id, doc.fileUrl)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="h-3 w-3" /> Open
                        </button>
                      )}
                      <button
                        disabled={!canDeleteRole}
                        onClick={() => handleDelete(doc._id, doc.fileName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Inline Preview
            </h3>
            {previewDoc && (
              <Badge className="bg-violet-50 text-violet-700 border border-violet-100 text-[9px] font-black uppercase tracking-wide">
                {CATEGORY_LABELS[previewDoc.category]}
              </Badge>
            )}
          </div>

          {!previewDoc ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No preview selected</p>
              <p className="mt-1 text-[10px] text-slate-400">Choose Preview on a file row to inspect it inline.</p>
            </div>
          ) : supportsInlinePreview ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                {previewDoc.title || previewDoc.fileName}
              </p>
              <iframe
                title={`Preview ${previewDoc.fileName}`}
                src={previewDoc.fileUrl || ""}
                className="h-120 w-full rounded-2xl border border-slate-200 bg-white"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inline preview not supported</p>
              <p className="mt-1 text-[10px] text-slate-400">Use Open to view this file type in a new tab.</p>
              <Button
                onClick={() => handleOpen(previewDoc._id, previewDoc.fileUrl)}
                className="mt-3 rounded-lg bg-slate-800 text-[10px] font-black uppercase tracking-wide text-white hover:bg-slate-700"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
            Document Audit Trail
          </h3>

          {auditLogs === undefined ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No audit events yet</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div key={log._id} className="py-2.5 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="h-5 border border-slate-200 bg-white px-2 text-[8px] font-black uppercase tracking-wide text-slate-700">
                        {log.action}
                      </Badge>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{log.actorName}</span>
                      <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    {log.fileName && <span>File: {log.fileName}</span>}
                    {log.category && <span>Category: {CATEGORY_LABELS[log.category]}</span>}
                    {log.note && <span>Note: {log.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
