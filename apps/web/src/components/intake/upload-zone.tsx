"use client";

import { useState, useCallback } from "react";
import { apiUpload, apiFetch } from "@/lib/api";

interface UploadZoneProps {
  cabinetId: string;
  clientId: string;
  onUploaded: () => void;
}

export function UploadZone({ cabinetId, clientId, onUploaded }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("cabinet_id", cabinetId);
        formData.append("client_id", clientId);

        await apiUpload("/api/upload", formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur upload");
      }
    }

    setUploading(false);
    onUploaded();
  }, [cabinetId, clientId, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }, [handleFiles]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#3b82f6" : "#d1d5db"}`,
          borderRadius: 8,
          padding: "32px 16px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: dragOver ? "#eff6ff" : "#f9fafb",
          transition: "all 0.2s",
        }}
      >
        {uploading ? (
          <p style={{ color: "#3b82f6", fontSize: 14 }}>Envoi en cours...</p>
        ) : (
          <>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
              Glisser-déposer vos fichiers ici ou cliquer pour parcourir
            </p>
            <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
              PDF, JPEG, PNG — max 20 Mo
            </p>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept=".pdf,.jpeg,.jpg,.png,.webp"
          multiple
          onChange={handleChange}
          style={{ display: "none" }}
        />
      </div>
      {error && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
