"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface BatchProgressEvent {
  type: "progress" | "complete";
  current?: number;
  total?: number;
  sourceId?: string;
  sourceTitle?: string;
  status?: "success" | "error" | "skipped";
  message?: string;
  summary?: {
    total: number;
    success: number;
    errors: number;
    included?: number;
    excluded?: number;
  };
}

interface LogEntry {
  sourceId: string;
  sourceTitle: string;
  status: "success" | "error" | "skipped";
  message: string;
}

interface BatchProgressModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  apiUrl: string;
  onComplete?: () => void;
}

export function BatchProgressModal({
  isOpen,
  onOpenChange,
  title,
  apiUrl,
  onComplete,
}: BatchProgressModalProps) {
  const [progress, setProgress] = useState(0);
  const [currentSource, setCurrentSource] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<BatchProgressEvent["summary"] | null>(
    null
  );
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!isOpen || !apiUrl) return;

    const startBatch = async () => {
      setIsProcessing(true);
      setProgress(0);
      setCurrentSource("");
      setLogs([]);
      setSummary(null);

      try {
        const response = await fetch(apiUrl, { method: "POST" });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // Keep incomplete event in buffer

          for (const event of events) {
            if (!event.trim()) continue;

            const lines = event.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.substring(6)) as BatchProgressEvent;

                  if (data.type === "progress") {
                    if (
                      data.current !== undefined &&
                      data.total !== undefined
                    ) {
                      setProgress(
                        Math.round((data.current / data.total) * 100)
                      );
                    }

                    if (data.sourceTitle) {
                      setCurrentSource(data.sourceTitle);
                    }

                    if (
                      data.sourceId &&
                      data.sourceTitle &&
                      data.status &&
                      data.message
                    ) {
                      setLogs((prev) => [
                        ...prev,
                        {
                          sourceId: data.sourceId!,
                          sourceTitle: data.sourceTitle!,
                          status: data.status as "success" | "error" | "skipped",
                          message: data.message!,
                        },
                      ]);
                    }
                  } else if (data.type === "complete") {
                    setSummary(data.summary || null);
                    setIsProcessing(false);
                    onComplete?.();
                  }
                } catch (e) {
                  console.error("Failed to parse SSE event:", e);
                }
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6)) as BatchProgressEvent;
                if (data.type === "complete") {
                  setSummary(data.summary || null);
                  setIsProcessing(false);
                  onComplete?.();
                }
              } catch (e) {
                console.error("Failed to parse final SSE event:", e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Batch operation failed:", error);
        setIsProcessing(false);
        setLogs((prev) => [
          ...prev,
          {
            sourceId: "error",
            sourceTitle: "Batch Operation",
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error occurred",
          },
        ]);
      }
    };

    startBatch();
  }, [isOpen, apiUrl, onComplete]);

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  const getStatusIcon = (status: "success" | "error" | "skipped") => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: "success" | "error" | "skipped") => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      case "skipped":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">Skipped</Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            Processing sources...
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Current Item */}
          {currentSource && isProcessing && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
              <p className="text-sm">
                <span className="font-medium">Processing:</span> {currentSource}
              </p>
            </div>
          )}

          {/* Logs */}
          <div className="flex-1 overflow-y-auto border rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
            <div className="space-y-2">
              {logs.map((log, idx) => (
                <div
                  key={`${log.sourceId}-${idx}`}
                  className="flex items-start gap-2 text-sm p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {getStatusIcon(log.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{log.sourceTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.message}
                    </div>
                  </div>
                  {getStatusBadge(log.status)}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Summary */}
          {summary && !isProcessing && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    <span className="font-medium">{summary.success}</span>{" "}
                    successful
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">
                    <span className="font-medium">{summary.errors}</span> errors
                  </span>
                </div>
                {summary.included !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">{summary.included}</span>{" "}
                    included
                  </div>
                )}
                {summary.excluded !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">{summary.excluded}</span>{" "}
                    excluded
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleClose}
            disabled={isProcessing}
            variant={isProcessing ? "outline" : "default"}
          >
            {isProcessing ? "Processing..." : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
