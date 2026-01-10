"use client";

import { Button } from "@/components/ui/button";
import { Plus, Tags } from "lucide-react";

interface EmptyStateProps {
    type: "no-research-questions" | "no-facets";
    onAddFacet?: () => void;
}

export function EmptyState({ type, onAddFacet }: EmptyStateProps) {
    if (type === "no-research-questions") {
        return (
            <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/20">
                <h3 className="text-lg font-semibold mb-2">No Research Questions Defined</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Please add research questions to your study before creating classification facets.
                    Facets are linked to research questions to track which aspects of your study each
                    facet addresses.
                </p>
            </div>
        );
    }

    return (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/20">
            <Tags className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Classification Facets</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Facets define the dimensions you&apos;ll use to classify and organize your sources.
                Create facets like &quot;Research Method&quot;, &quot;Publication Type&quot;, or &quot;Application Domain&quot;.
            </p>
            {onAddFacet && (
                <Button variant="default" onClick={onAddFacet}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Facet
                </Button>
            )}
        </div>
    );
}
