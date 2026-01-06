import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Check, Trash2 } from "lucide-react";
import { Source } from "@/types/source";
import { forwardRef } from "react";

interface SourceItemProps {
    source: Source;
    isEditMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string, checked: boolean) => void;
    onDelete: (source: Source) => void;
    currentTab: string;
    suggestion?: any;
    isLoading?: boolean;
    onReparse: (id: string) => void;
    onApplySuggestions: (id: string) => void;
    getSourceUrl: (id: string) => string;
}

export const SourceItem = forwardRef<HTMLDivElement, SourceItemProps>(
    ({ source, isEditMode, isSelected, onToggleSelection, onDelete, currentTab, suggestion, isLoading, onReparse, onApplySuggestions, getSourceUrl }, ref) => {
        const shouldHighlight = isEditMode && isSelected;

        return (
            <div
                ref={ref}
                className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors ${shouldHighlight ? 'bg-accent/50 border-primary/20' : ''}`}
            >
                {isEditMode && (
                    <div className="pt-1 animate-in fade-in slide-in-from-left-2 duration-200">
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => onToggleSelection(source.id, !!checked)}
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <Link href={getSourceUrl(source.id)} className="flex-1 min-w-0 mr-4 group">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-medium group-hover:underline truncate">{source.title}</p>
                                {source.sourceOrigins && source.sourceOrigins.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                        {source.sourceOrigins.map((origin) => (
                                            <Badge key={origin} variant="secondary" className="text-xs">
                                                {origin}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                                {source.authors?.join(", ")} • {source.venue || "Unknown Venue"} • {source.publicationDate ? new Date(source.publicationDate).getFullYear() : ""} • {source.status}
                            </p>
                        </Link>

                        <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={source.status === 'INCLUDED' ? 'default' : 'outline'}>{source.status}</Badge>
                            {currentTab === 'pending' && !isEditMode && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onReparse(source.id)}
                                        disabled={isLoading}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        {isLoading ? "Parsing..." : "Re-parse"}
                                    </Button>
                                    {suggestion && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => onApplySuggestions(source.id)}
                                            disabled={isLoading}
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            Apply
                                        </Button>
                                    )}
                                </>
                            )}
                            {currentTab === 'needs_pdf' && !isEditMode && (
                                <Button asChild size="sm">
                                    <Link href={getSourceUrl(source.id)}>
                                        Upload PDF
                                    </Link>
                                </Button>
                            )}
                            {!isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => onDelete(source)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Suggestions Preview for Pending Tab */}
                    {currentTab === 'pending' && suggestion && (
                        <div className="rounded-md border bg-background p-3 mt-2">
                            <p className="text-sm font-semibold mb-1">Suggested metadata</p>
                            <p className="text-sm"><strong>Title:</strong> {suggestion.title}</p>
                            <p className="text-sm"><strong>Authors:</strong> {(suggestion.authors || []).join(", ") || "—"}</p>
                            <p className="text-sm"><strong>Venue:</strong> {suggestion.venue || "—"}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }
);
SourceItem.displayName = "SourceItem";
