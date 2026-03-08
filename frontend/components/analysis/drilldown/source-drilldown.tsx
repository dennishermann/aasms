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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Users,
  Building,
} from "lucide-react";

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
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.getFullYear().toString();
}

function SourceCard({ source, studyId }: { source: SourceInfo; studyId: string }) {
  const [showAbstract, setShowAbstract] = useState(false);

  return (
    <div className="border rounded-lg p-5 hover:bg-muted/30 transition-colors bg-card">
      {/* Header: Title + View Button */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <Link
            href={`/studies/${studyId}/sources/${source.id}`}
            target="_blank"
            className="text-base font-semibold text-primary hover:underline block leading-snug"
          >
            {source.title}
          </Link>
        </div>
        <Link href={`/studies/${studyId}/sources/${source.id}`} target="_blank">
          <Button variant="default" size="sm" className="shrink-0">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </Link>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Authors</p>
            <p className="font-medium">{formatAuthors(source.authors)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Year</p>
            <p className="font-medium font-mono">{formatYear(source.publicationDate)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Venue</p>
            <p className="font-medium">{source.venue || "—"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
            <div className="flex items-center gap-2">
              <Badge variant={source.sourceCategory === "FORMAL" ? "default" : "secondary"}>
                {source.sourceCategory === "FORMAL" ? "Formal" : "Grey"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* DOI */}
      {source.doi && (
        <div className="mb-3">
          <a
            href={`https://doi.org/${source.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <span className="font-mono">DOI: {source.doi}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Abstract */}
      {source.abstract && (
        <div className="border-t pt-3">
          <button
            onClick={() => setShowAbstract(!showAbstract)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
          >
            {showAbstract ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Abstract
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Abstract
              </>
            )}
          </button>
          {showAbstract && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed bg-muted/50 p-4 rounded-md">
              {source.abstract}
            </p>
          )}
        </div>
      )}
    </div>
  );
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
        <DialogHeader className="pb-4 border-b">
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

        {/* Content */}
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="py-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-5">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <div className="grid grid-cols-4 gap-4">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-16 text-destructive">
                <p className="text-lg font-medium">Failed to load sources</p>
                <p className="text-sm mt-1">Please try again later</p>
              </div>
            ) : sources && sources.length > 0 ? (
              <div className="space-y-4">
                {sources.map((source) => (
                  <SourceCard key={source.id} source={source} studyId={studyId} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium">No sources found</p>
                <p className="text-sm mt-1">This category combination has no matching sources</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
