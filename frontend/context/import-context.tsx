"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { toast } from "sonner"; // Using sonner as seen in providers.tsx (layout uses Toaster from sonner)

interface ImportProgress {
  total: number;
  processed: number;
  included: number;
  excluded: number;
  errors: number;
  // Track specific counts if needed
}

type ImportStatus = "idle" | "uploading" | "reviewing" | "importing" | "complete" | "error";

interface ImportContextType {
  isImporting: boolean;
  status: ImportStatus;
  progress: ImportProgress;
  activeStudyId: string | null;
  batchId: string | null;
  startImport: (studyId: string, formData: FormData) => Promise<void>;
  reset: () => void;
  minimize: () => void; // Allow user to "background" it explicitly if we add that UI
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    processed: 0,
    included: 0,
    excluded: 0,
    errors: 0,
  });

  const reset = useCallback(() => {
    setStatus("idle");
    setActiveStudyId(null);
    setBatchId(null);
    setProgress({
      total: 0,
      processed: 0,
      included: 0,
      excluded: 0,
      errors: 0,
    });
  }, []);

  const minimize = useCallback(() => {
    // This could be used to toggle a UI state if we had a maximized/minimized view,
    // but for now the global indicator handles the 'background' view.
  }, []);

  const startImport = useCallback(async (studyId: string, formData: FormData) => {
    setActiveStudyId(studyId);
    setStatus("importing");
    setProgress({ total: 0, processed: 0, included: 0, excluded: 0, errors: 0 });

    try {
      // Step 1: Parse and Initialize Batch
      // We assume the formData already contains 'file' and 'databaseSource'
      const response = await fetch(`/api/studies/${studyId}/import`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const data = await response.json();
      const newSourceIds = data.newSourceIds || [];
      const currentBatchId = data.batchId;
      setBatchId(currentBatchId);

      setProgress((prev) => ({
        ...prev,
        total: newSourceIds.length,
      }));

      // If no new sources, we are done
      if (newSourceIds.length === 0) {
        setStatus("complete");
        toast.success("Import processed", { description: "No new sources were found." });
        return;
      }

      // Step 2: Stream Analysis
      const streamRes = await fetch(`/api/studies/${studyId}/import/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: newSourceIds }),
      });

      if (!streamRes.ok) throw new Error("Streaming analysis failed");
      if (!streamRes.body) throw new Error("No response body");

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();

      console.log("ImportContext: Stream started");

      let loop = true;
      while (loop) {
        const { done, value } = await reader.read();
        if (done) {
          loop = false;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim() !== "");

        for (const line of lines) {
          try {
            const event = JSON.parse(line);

            if (event.type === "progress") {
              // event.result contains { is_relevant: boolean, ... }
              const isRelevant = event.result?.is_relevant;

              setProgress((prev) => {
                const newProcessed = (prev.processed || 0) + 1;
                return {
                  ...prev,
                  processed: newProcessed,
                  included: isRelevant ? prev.included + 1 : prev.included,
                  excluded: !isRelevant ? prev.excluded + 1 : prev.excluded,
                };
              });
            } else if (event.type === "error") {
              setProgress((prev) => ({
                ...prev,
                processed: (prev.processed || 0) + 1,
                errors: prev.errors + 1,
              }));
            }
          } catch (e) {
            console.error("Error parsing stream event", e);
          }
        }
      }

      setStatus("complete");
      toast.success("Import Complete", {
        description: `Processed ${newSourceIds.length} sources.`,
      });
    } catch (error) {
      console.error("Global import failed:", error);
      setStatus("error");
      toast.error("Import Failed", {
        description: error instanceof Error ? error.message : "An error occurred during import.",
      });
    }
  }, []);

  const value = {
    isImporting: status === "importing",
    status,
    progress,
    activeStudyId,
    batchId,
    startImport,
    reset,
    minimize,
  };

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

export function useImport() {
  const context = useContext(ImportContext);
  if (context === undefined) {
    throw new Error("useImport must be used within an ImportProvider");
  }
  return context;
}
