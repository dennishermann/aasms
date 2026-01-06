"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Calendar, BookOpen, FileText, Link2, Tag, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Source {
    id: string;
    studyId: string;
    title: string;
    authors: string[];
    publicationDate: string | null;
    venue: string | null;
    venueType?: string | null;
    greyLiteratureTier?: string | null;
    doi: string | null;
    abstract: string | null;
    keywords: string[];
    sourceCategory: string;
    type: string;
    originalUrl?: string | null;
    storagePath?: string | null;
    bibtex?: string | null;
}

// Human-readable labels for venue types
const VENUE_TYPE_LABELS: Record<string, string> = {
    JOURNAL: "Journal",
    CONFERENCE: "Conference",
    WORKSHOP: "Workshop",
    SYMPOSIUM: "Symposium",
    BOOK_CHAPTER: "Book Chapter",
    PREPRINT_SERVER: "Preprint Server",
    TECHNICAL_REPORT: "Technical Report",
    BLOG: "Blog / Online Article",
    OTHER: "Other",
};

// Human-readable labels for grey literature tiers
const GREY_LIT_TIER_LABELS: Record<string, { label: string; description: string }> = {
    TIER_1: { label: "Tier 1", description: "High Credibility" },
    TIER_2: { label: "Tier 2", description: "Moderate Credibility" },
    TIER_3: { label: "Tier 3", description: "Lower Credibility" },
};

interface SourceMetadataViewProps {
    source: Source;
}

export function SourceMetadataView({ source }: SourceMetadataViewProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

    return (
        <CardContent className="space-y-6 pt-6">
            <div className="grid gap-6 md:grid-cols-2">
                {source.publicationDate && (
                    <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">Publication Date</p>
                            <p className="text-sm text-muted-foreground">
                                {new Date(source.publicationDate).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                )}

                {source.venue && (
                    <div className="flex items-start gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">Venue</p>
                            <p className="text-sm text-muted-foreground">
                                {source.venue}
                                {source.venueType && (
                                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                                        {VENUE_TYPE_LABELS[source.venueType] || source.venueType}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {source.greyLiteratureTier && (
                    <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">Grey Literature Tier</p>
                            <p className="text-sm text-muted-foreground">
                                {GREY_LIT_TIER_LABELS[source.greyLiteratureTier]?.label || source.greyLiteratureTier}
                                <span className="ml-2 text-xs text-muted-foreground">
                                    ({GREY_LIT_TIER_LABELS[source.greyLiteratureTier]?.description || ""})
                                </span>
                            </p>
                        </div>
                    </div>
                )}

                {source.doi && (
                    <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">DOI</p>
                            <p className="text-sm text-muted-foreground">{source.doi}</p>
                        </div>
                    </div>
                )}

                {source.originalUrl && (
                    <div className="flex items-start gap-3">
                        <Link2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">URL</p>
                            <a
                                href={source.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline break-all"
                            >
                                {source.originalUrl}
                            </a>
                        </div>
                    </div>
                )}

                {source.bibtex && (
                    <div className="flex items-start gap-3">
                        <div className="h-5 w-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-muted-foreground">Bx</span>
                        </div>
                        <div className="w-full">
                            <p className="text-sm font-medium mb-1">BibTeX</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                    if (source.bibtex) {
                                        navigator.clipboard.writeText(source.bibtex);
                                        setIsCopied(true);
                                        setTimeout(() => setIsCopied(false), 2000);
                                    }
                                }}
                            >
                                {isCopied ? (
                                    <>
                                        <Check className="h-3 w-3 mr-2" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3 w-3 mr-2" />
                                        Copy BibTeX
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {source.abstract && (
                <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">
                        {(source.type === "WEBPAGE" || source.type === "BLOG_POST") ? "Summary" : "Abstract"}
                    </p>
                    <div className="relative">
                        <p className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap ${!isAbstractExpanded ? 'line-clamp-3' : ''}`}>
                            {source.abstract}
                        </p>
                        {source.abstract.length > 300 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-auto p-0 text-primary font-medium hover:text-primary/80 hover:bg-transparent"
                                onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
                            >
                                {isAbstractExpanded ? (
                                    <>
                                        Show less
                                        <ChevronUp className="ml-1 h-3 w-3" />
                                    </>
                                ) : (
                                    <>
                                        Read more
                                        <ChevronDown className="ml-1 h-3 w-3" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {source.keywords && source.keywords.length > 0 && (
                <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Keywords</p>
                    <div className="flex flex-wrap gap-2">
                        {source.keywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary">
                                <Tag className="h-3 w-3 mr-1" />
                                {keyword}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
    );
}
