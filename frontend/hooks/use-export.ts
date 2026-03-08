import { useState } from "react";

export function useExport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportFullDataset = async (studyId: string, studyTitle?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/studies/${studyId}/export/full`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Export failed");
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link element and trigger download
      const link = document.createElement("a");
      link.href = url;

      // Use study title in filename if available
      const timestamp = new Date().toISOString().split("T")[0];
      const filename =
        studyTitle && studyTitle.trim()
          ? `${studyTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${timestamp}.xlsx`
          : `study-${studyId}-${timestamp}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      console.error("Export error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    exportFullDataset,
    isLoading,
    error,
  };
}
