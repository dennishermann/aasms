"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, CheckCircle2, FileText, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useImport } from "@/context/import-context";

interface BulkUploadFormProps {
  studyId: string;
  onSuccess?: () => void;
}

interface ParsedSourcePreview {
  title: string;
  authors: string[];
  publication_date?: string;
  venue?: string;
  doi?: string;
}

type UploadStep = "upload" | "review" | "importing" | "complete";

export function BulkUploadForm({ studyId, onSuccess }: BulkUploadFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { startImport, isImporting, status, progress, batchId } = useImport();

  const [file, setFile] = useState<File | null>(null);
  const [databaseSource, setDatabaseSource] = useState<string>("");
  const [step, setStep] = useState<UploadStep>("upload");
  const [previewData, setPreviewData] = useState<ParsedSourcePreview[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync local step with global status if we are in this study context
  // This helps when navigating back to this page while import is running
  // For simplicity, if global import is running, we show the 'importing' view
  const showImportingState =
    isImporting || (status === "complete" && progress.total > 0 && step === "importing");

  const handlePreview = async () => {
    if (!file || !databaseSource) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("databaseSource", databaseSource);

    try {
      const response = await fetch(`/api/studies/${studyId}/import/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Preview failed");
      }

      const data = await response.json();
      setPreviewData(data.sources || []);
      setStep("review");
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Could not parse file.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartImport = async () => {
    if (!file || !databaseSource) return;

    setStep("importing");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("databaseSource", databaseSource);

    // Delegate to global context
    await startImport(studyId, formData);
  };

  // If we are 'importing' locally but global status becomes complete, update local state
  if (step === "importing" && status === "complete" && !isImporting) {
    // Only switch to complete if we haven't already
    // We can use a ref or just let the render cycle handle it, but better to be explicit in useEffect or here
    // But since we are inside render, we shouldn't set state directly.
    // Let's use the UI derive logic.
  }

  const getFileTypeHint = () => {
    switch (databaseSource) {
      case "IEEE":
        return "Expected: .csv file from IEEE Xplore";
      case "ACM":
        return "Expected: .bib or .bibtex file from ACM Digital Library";
      case "SCOPUS":
        return "Expected: .csv file from SCOPUS";
      default:
        return "Select a database source first";
    }
  };

  // Decide what to render base on local step OR global status
  // If global is importing, we override local view to show progress
  const effectivelyImporting = isImporting;
  const effectivelyComplete = !isImporting && step === "importing" && status === "complete";

  // Calculate stats for UI
  const percent = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  const remaining = progress.total - progress.processed;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Import</CardTitle>
        <CardDescription>
          {!effectivelyImporting &&
            !effectivelyComplete &&
            step === "upload" &&
            "Upload CSV or BibTeX files from IEEE Xplore, ACM Digital Library, or SCOPUS"}
          {!effectivelyImporting &&
            !effectivelyComplete &&
            step === "review" &&
            `Reviewing ${previewData.length} sources found in ${file?.name}`}
          {effectivelyImporting && "Processing your import..."}
          {effectivelyComplete && "Import completed successfully"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* VIEW 1: UPLOAD */}
        {!effectivelyImporting && !effectivelyComplete && step === "upload" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="database-source">Database Source *</Label>
              <Select value={databaseSource} onValueChange={setDatabaseSource}>
                <SelectTrigger id="database-source">
                  <SelectValue placeholder="Select database..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IEEE">IEEE Xplore (CSV)</SelectItem>
                  <SelectItem value="ACM">ACM Digital Library (BibTeX)</SelectItem>
                  <SelectItem value="SCOPUS">SCOPUS (CSV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file-upload">Select File *</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.bib,.bibtex"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={!databaseSource}
              />
              {databaseSource && (
                <p className="text-sm text-muted-foreground mt-1">{getFileTypeHint()}</p>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Process</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Upload &rarr; Preview &rarr; Import & Analyze
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* VIEW 2: REVIEW */}
        {!effectivelyImporting && !effectivelyComplete && step === "review" && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Succesfully parsed {previewData.length} sources</AlertTitle>
              <AlertDescription>
                Please review the list below. If everything looks correct, click &quot;Start
                Import&quot;.
              </AlertDescription>
            </Alert>

            <div className="border rounded-md">
              <ScrollArea className="h-[300px]">
                <div className="divide-y">
                  {previewData.map((source, idx) => (
                    <div key={idx} className="p-3 hover:bg-muted/50 text-sm">
                      <p className="font-medium line-clamp-1">{source.title}</p>
                      <div className="flex flax-wrap gap-2 text-xs text-muted-foreground mt-1">
                        <span>
                          {source.authors?.[0] || "Unknown Author"}
                          {source.authors?.length > 1 ? " et al." : ""}
                        </span>
                        <span>•</span>
                        <span>{source.publication_date || "No Date"}</span>
                        {source.venue && (
                          <>
                            <span>•</span>
                            <span className="line-clamp-1">{source.venue}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>Total: {previewData.length}</p>
              {previewData.length === 0 && (
                <p className="text-destructive">No sources found. Check your file format.</p>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: IMPORTING (ACTIVE) */}
        {effectivelyImporting && (
          <div className="flex flex-col w-full items-center justify-center space-y-6 py-8">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>

            <div className="text-center space-y-2 w-full max-w-md">
              <h3 className="text-lg font-medium">Checking relevance...</h3>
              <p className="text-sm text-muted-foreground">
                AI is analyzing title and abstracts.
                <br />
                <span className="text-xs opacity-75">
                  You can leave this page, the process will continue in the background.
                </span>
              </p>

              <Progress value={percent} className="w-full h-3" />

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                  <span className="text-2xl font-bold text-green-600">{progress.included}</span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Included
                  </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {progress.excluded}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Excluded
                  </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                  <span className="text-2xl font-bold text-blue-500">{remaining}</span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Remaining
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                Total: {progress.processed} / {progress.total}
              </p>
            </div>
          </div>
        )}

        {/* VIEW 4: COMPLETE */}
        {effectivelyComplete && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <h3 className="text-lg font-medium">Import Complete!</h3>
                <p className="text-sm text-muted-foreground">Processed {progress.total} sources.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="flex flex-col items-center p-2 border rounded">
                  <span className="text-xl font-bold text-green-600">{progress.included}</span>
                  <span className="text-xs">Included</span>
                </div>
                <div className="flex flex-col items-center p-2 border rounded">
                  <span className="text-xl font-bold text-muted-foreground">
                    {progress.excluded}
                  </span>
                  <span className="text-xs">Excluded</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {!effectivelyImporting && !effectivelyComplete && step === "upload" && (
          <>
            <Button variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button onClick={handlePreview} disabled={!file || !databaseSource || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Previewing...
                </>
              ) : (
                <>
                  Preview Sources
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </>
        )}

        {!effectivelyImporting && !effectivelyComplete && step === "review" && (
          <>
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleStartImport} disabled={previewData.length === 0}>
              Start Import
            </Button>
          </>
        )}

        {effectivelyComplete && (
          <Button
            className="w-full"
            onClick={() => {
              // Redirect to sources
              router.push(`/studies/${studyId}/sources?filter=new_import&batchId=${batchId}`);
              onSuccess?.();
            }}
          >
            View Results
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
