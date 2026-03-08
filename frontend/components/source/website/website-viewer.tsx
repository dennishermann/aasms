"use client";

import { useState, useEffect } from "react";
import { Globe, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SourceWebsiteViewerProps {
  contentUrl: string;
  originalUrl?: string | null;
}

export function SourceWebsiteViewer({ contentUrl, originalUrl }: SourceWebsiteViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isOpen && !hasFetched && contentUrl) {
      setLoading(true);
      fetch(contentUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load content");
          return res.text();
        })
        .then((text) => {
          setHtmlContent(text);
          setHasFetched(true);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, hasFetched, contentUrl]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      {/* Header / Trigger Area */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
          isOpen && "bg-muted/30 border-b",
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary/70" />
            <span>Archived Content</span>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {originalUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              asChild
            >
              <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                View Original
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isOpen && (
        <CardContent className="p-0 bg-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading content...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">
              <p>Unable to load archived content.</p>
              <p className="text-xs opacity-70 mt-1">{error}</p>
            </div>
          ) : (
            <div className="p-6 overflow-auto max-h-[800px]">
              {/* Prose wrapper for nice formatting of raw HTML */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none 
                                           prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2
                                           prose-a:text-primary prose-img:rounded-md"
                dangerouslySetInnerHTML={{ __html: htmlContent || "" }}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
