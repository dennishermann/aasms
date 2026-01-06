"use client";

import { useImport } from "@/context/import-context";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Minimize2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname, useParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useState } from "react";

export function GlobalProgressIndicator() {
    const { isImporting, status, progress, activeStudyId, batchId, reset } = useImport();
    const router = useRouter();
    const pathname = usePathname();
    const [isMinimized, setIsMinimized] = useState(false);

    // Only show if we are working on something or just finished
    // If status is idle, don't show
    if (status === 'idle') return null;

    // Hide if we are on the bulk upload page (add source page)
    if (pathname?.endsWith('/sources/add')) return null;

    const handleViewResults = () => {
        if (activeStudyId && batchId) {
            router.push(`/studies/${activeStudyId}/sources?filter=new_import&batchId=${batchId}`);
            // If complete, we might want to reset or keep showing until dismissed.
            // Let's keep showing until user clicks "X" or explicit close.
            // But if we navigate, maybe we minimize?
        }
    };

    const percent = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

    // Calculate remaining
    const remaining = progress.total - progress.processed;

    return (
        <div className={cn(
            "fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out",
            isMinimized ? "w-auto" : "w-[350px]"
        )}>
            <Card className="shadow-lg border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">

                {isMinimized ? (
                    <div className="p-2 flex items-center gap-3 cursor-pointer" onClick={() => setIsMinimized(false)}>
                        {status === 'complete' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold">Bulk Import</span>
                            <span className="text-[10px] text-muted-foreground">
                                {status === 'complete' ? 'Done' : `${Math.round(percent)}%`}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                {status === 'importing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                {status === 'complete' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                {status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}

                                {status === 'importing' && "Importing Sources..."}
                                {status === 'complete' && "Import Complete"}
                                {status === 'error' && "Import Failed"}
                            </h4>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
                                    <Minimize2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progress</span>
                                <span>{progress.processed} / {progress.total}</span>
                            </div>
                            <Progress value={percent} className="h-2" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2">
                            <div className="flex flex-col items-center bg-muted/50 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground">Included</span>
                                <span className="font-bold text-green-600 flex items-center gap-1">
                                    {progress.included}
                                </span>
                            </div>
                            <div className="flex flex-col items-center bg-muted/50 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground">Excluded</span>
                                <span className="font-bold text-muted-foreground flex items-center gap-1">
                                    {progress.excluded}
                                </span>
                            </div>
                            <div className="flex flex-col items-center bg-muted/50 p-2 rounded-md">
                                <span className="text-xs text-muted-foreground">Remaining</span>
                                <span className="font-bold text-blue-500">
                                    {remaining}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            {status === 'complete' && (
                                <Button variant="outline" size="sm" onClick={reset}>
                                    Dismiss
                                </Button>
                            )}
                            {(status === 'complete' || status === 'importing') && activeStudyId && (
                                <Button size="sm" onClick={handleViewResults}>
                                    View Results
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
