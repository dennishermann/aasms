"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ExternalLink } from "lucide-react";

interface SourceInfo {
  id: string;
  title: string;
  authors: string[];
  publicationDate: string | null;
  venue: string | null;
  sourceCategory: "FORMAL" | "GREY";
  abstract: string | null;
  doi: string | null;
}

interface SourceDrilldownProps {
  isOpen: boolean;
  onClose: () => void;
  studyId: string;
  title: string;
  description?: string;
  sourceIds: string[];
}

async function fetchSourcesByIds(studyId: string, sourceIds: string[]): Promise<SourceInfo[]> {
  if (sourceIds.length === 0) return [];

  const response = await fetch(`/api/studies/${studyId}/sources/by-ids?ids=${sourceIds.join(",")}`);
  if (!response.ok) {
    throw new Error("Failed to fetch sources");
  }
  const data = await response.json();
  return data.data.sources || [];
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return authors.join(" & ");
  if (authors.length <= 4) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function formatYear(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.getFullYear().toString();
}

export function SourceDrilldown({
  isOpen,
  onClose,
  studyId,
  title,
  description,
  sourceIds,
}: SourceDrilldownProps) {
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: sources,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sources-drilldown", studyId, sourceIds],
    queryFn: () => fetchSourcesByIds(studyId, sourceIds),
    enabled: isOpen && sourceIds.length > 0,
  });

  const handleExportCsv = async () => {
    if (!sources || sources.length === 0) return;

    setIsExporting(true);
    try {
      const headers = ["Title", "Authors", "Year", "Venue", "Category", "DOI", "Abstract"];
      const rows = sources.map((s) => [
        `"${s.title.replace(/"/g, '""')}"`,
        `"${s.authors.join("; ")}"`,
        formatYear(s.publicationDate),
        `"${s.venue || ""}"`,
        s.sourceCategory,
        s.doi || "",
        `"${(s.abstract || "").replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const safeTitle = title
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .toLowerCase()
        .slice(0, 30);

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sources_${safeTitle}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="!max-w-5xl !w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl">{title}</DialogTitle>
              {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="font-mono text-base px-3 py-1">
                {sourceIds.length} sources
              </Badge>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExporting || !sources || sources.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <span className="sr-only">Close</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive">
              <p className="text-lg font-medium">Failed to load sources</p>
              <p className="text-sm mt-1">Please try again later</p>
            </div>
          ) : sources && sources.length > 0 ? (
            <div className="rounded-md border">
              <table className="text-sm border-collapse min-w-full">
                <colgroup>
                  <col style={{ width: "45%", minWidth: "300px" }} />
                  <col style={{ width: "20%", minWidth: "150px" }} />
                  <col style={{ width: "6%", minWidth: "60px" }} />
                  <col style={{ width: "22%", minWidth: "150px" }} />
                  <col style={{ width: "7%", minWidth: "70px" }} />
                </colgroup>
                <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur-sm z-10 shadow-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-left font-semibold py-2 px-3 !whitespace-normal">
                      Source
                    </TableHead>
                    <TableHead className="text-left font-semibold py-2 px-3 !whitespace-normal">
                      Authors
                    </TableHead>
                    <TableHead className="text-center font-semibold py-2 px-3">Year</TableHead>
                    <TableHead className="text-left font-semibold py-2 px-3 !whitespace-normal">
                      Venue
                    </TableHead>
                    <TableHead className="text-center font-semibold py-2 px-3">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source, rowIndex) => (
                    <TableRow
                      key={source.id}
                      className={`hover:bg-muted/50 transition-colors ${
                        rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30"
                      }`}
                    >
                      <TableCell className="align-top py-2 px-3 !whitespace-normal">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/studies/${studyId}/sources/${source.id}`}
                            target="_blank"
                            className="font-medium hover:underline line-clamp-2"
                          >
                            {source.title}
                          </Link>
                          <Link href={`/studies/${studyId}/sources/${source.id}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 !whitespace-normal text-muted-foreground">
                        {formatAuthors(source.authors)}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 text-center font-mono">
                        {formatYear(source.publicationDate)}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 !whitespace-normal text-muted-foreground">
                        {source.venue || "—"}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 text-center">
                        <Badge
                          variant={source.sourceCategory === "FORMAL" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {source.sourceCategory === "FORMAL" ? "Formal" : "Grey"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No sources found</p>
              <p className="text-sm mt-1">This category combination has no matching sources</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
