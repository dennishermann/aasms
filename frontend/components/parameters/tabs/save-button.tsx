"use client";

import { Button } from "@/components/ui/button";
import { Save, CheckCircle2 } from "lucide-react";
import { TabKey, TAB_CONFIG } from "./tab-config";

interface SaveButtonProps {
    tab: TabKey;
    hasChanges: boolean;
    isSaving: boolean;
    showSuccess: boolean;
    onSave: () => void;
}

/**
 * Reusable SaveButton component for parameter tabs.
 * Displays unsaved indicator, success message, and per-tab coloring.
 */
export function SaveButton({
    tab,
    hasChanges,
    isSaving,
    showSuccess,
    onSave,
}: SaveButtonProps) {
    const config = TAB_CONFIG[tab];

    return (
        <div className="flex items-center gap-3">
            {hasChanges && !isSaving && !showSuccess && (
                <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Unsaved changes
                </span>
            )}
            {showSuccess && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved!
                </span>
            )}
            <Button
                onClick={onSave}
                disabled={isSaving || !hasChanges}
                size="default"
                className={hasChanges ? config.color : ""}
            >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : `Save ${config.label}`}
            </Button>
        </div>
    );
}
