"use client";

import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Facet } from "../types";

interface MetadataBindingProps {
    facet: Facet;
    facetKey: string;
    onUpdateFacet: (facetKey: string, updates: Partial<Facet>) => void;
}

/**
 * Metadata binding section - link facet to source metadata fields
 */
export function MetadataBinding({
    facet,
    facetKey,
    onUpdateFacet,
}: MetadataBindingProps) {
    return (
        <div className="p-5 rounded-lg bg-muted/30 border space-y-4">
            <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Link to Metadata</Label>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p>Link this facet to a source metadata field to derive classifications automatically instead of using LLM.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Metadata Field
                    </Label>
                    <Select
                        value={facet.metadataField || "none"}
                        onValueChange={(value) =>
                            onUpdateFacet(facetKey, {
                                metadataField: value === "none" ? null : value,
                                metadataTransform: value === "none" ? null : facet.metadataTransform
                            })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None (use LLM)</SelectItem>
                            <SelectItem value="publicationDate">Publication Date</SelectItem>
                            <SelectItem value="venue">Venue</SelectItem>
                            <SelectItem value="venueType">Venue Type</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {facet.metadataField === "publicationDate" && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Extract
                        </Label>
                        <Select
                            value={facet.metadataTransform || "year"}
                            onValueChange={(value) =>
                                onUpdateFacet(facetKey, { metadataTransform: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="year">Year only</SelectItem>
                                <SelectItem value="month">Month only</SelectItem>
                                <SelectItem value="full">Full date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {facet.metadataField && (
                <div className="text-sm text-muted-foreground bg-blue-50/50 p-3 rounded border border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30">
                    <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">How it works:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        {facet.metadataField === "publicationDate" && facet.metadataTransform === "year" && (
                            <>
                                <li>The system will extract the year (e.g., &quot;2024&quot;) from the date.</li>
                                <li><strong>You must define categories</strong> that match these years (e.g., &quot;2023&quot;, &quot;2024&quot;).</li>
                                <li>If the extracted year matches a category, it&apos;s auto-selected.</li>
                            </>
                        )}
                        {facet.metadataField === "venue" && (
                            <>
                                <li>The LLM will see the venue name (e.g., &quot;ICSE 2024&quot;).</li>
                                <li>It will pick the best category from your list below (e.g., &quot;Conference&quot;, &quot;Journal&quot;).</li>
                            </>
                        )}
                        {facet.metadataField === "venueType" && (
                            <>
                                <li>The system uses the imported venue type (e.g., &quot;Conference&quot;).</li>
                                <li><strong>You must define categories</strong> matching these types exactly.</li>
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
