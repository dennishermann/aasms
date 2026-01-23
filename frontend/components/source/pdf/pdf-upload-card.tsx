"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, RefreshCw } from "lucide-react";

interface PdfUploadCardProps {
    studyId: string;
    sourceId: string;
    onUploadSuccess: () => void;
}

export const PdfUploadCard = ({ studyId, sourceId, onUploadSuccess }: PdfUploadCardProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [metadataOnlyLoading, setMetadataOnlyLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`/api/studies/${studyId}/sources/${sourceId}/upload-pdf`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.details || err.error || "Upload failed");
            }
            onUploadSuccess();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleMetadataOnlyClassification = async () => {
        setMetadataOnlyLoading(true);
        setError(null);
        try {
            const updateRes = await fetch(`/api/studies/${studyId}/sources/${sourceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    allowMetadataOnlyClassification: true,
                    needsPdf: false,
                    status: "READY_FOR_ANALYSIS",
                }),
            });
            if (!updateRes.ok) {
                const detail = await updateRes.json().catch(() => ({}));
                throw new Error(detail.error || "Failed to enable metadata-only classification");
            }

            const classifyRes = await fetch(`/api/studies/${studyId}/sources/${sourceId}/classify`, {
                method: "POST",
            });
            if (!classifyRes.ok) {
                const detail = await classifyRes.json().catch(() => ({}));
                throw new Error(detail.error || "Metadata-only classification failed");
            }

            onUploadSuccess();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setMetadataOnlyLoading(false);
        }
    };

    return (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
            <CardHeader>
                <CardTitle className="text-orange-800 dark:text-orange-400 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    PDF Required for Analysis
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        This source was identified as relevant based on its title/abstract, but the full text is needed for detailed inclusion analysis and classification.
                    </p>
                    <div className="flex items-center gap-4">
                        <Input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="bg-background"
                        />
                        <Button onClick={handleUpload} disabled={!file || uploading || metadataOnlyLoading}>
                            {uploading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : "Upload & Analyze"}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">
                            If the PDF is unavailable, you can proceed with metadata/abstract only.
                        </p>
                        <Button
                            variant="outline"
                            onClick={handleMetadataOnlyClassification}
                            disabled={uploading || metadataOnlyLoading}
                        >
                            {metadataOnlyLoading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Classifying...
                                </>
                            ) : "Classify with Metadata"}
                        </Button>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </CardContent>
        </Card>
    );
};
