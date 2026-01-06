"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkUploadForm } from "./bulk-upload-form";
import { SourceTypeSelector } from "./source-type-selector";
import { PdfUploadForm } from "./pdf-upload-form";
import { UrlSourceForm } from "./url-source-form";
import { SourceMetadataFields } from "./shared/source-metadata-fields";

const addSourceSchema = z.object({
  sourceType: z.enum(["pdf", "url", "bulk"]),
  url: z.union([z.literal(""), z.string().url()]).optional(),
  title: z.string().min(1, "Title is required"),
  authors: z.array(z.string()).optional(),
  publicationDate: z.string().optional(),
  venue: z.string().optional(),
  doi: z.string().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  sourceCategory: z.enum(["FORMAL", "GREY"]),
});

type AddSourceInput = z.infer<typeof addSourceSchema>;

interface AddSourceFormProps {
  studyId: string;
  onSuccess?: () => void;
}

export function AddSourceForm({ studyId, onSuccess }: AddSourceFormProps) {
  const [sourceType, setSourceType] = useState<"pdf" | "url" | "bulk">("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([""]);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<AddSourceInput>({
    resolver: zodResolver(addSourceSchema),
    defaultValues: {
      sourceType: "pdf",
      url: "",
      title: "",
      authors: [],
      venue: "",
      doi: "",
      abstract: "",
      keywords: [],
      sourceCategory: "FORMAL",
      publicationDate: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { file?: File; formData: AddSourceInput }) => {
      const formData = new FormData();

      if (data.file) {
        formData.append("file", data.file);
      }

      formData.append("metadata", JSON.stringify(data.formData));

      const response = await fetch(`/api/studies/${studyId}/sources/add`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add source");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
      onSuccess?.();
    },
  });

  const autofillFromPdf = useCallback(
    async (file: File) => {
      setAutoFillLoading(true);
      setAutoFillError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error || "Failed to parse PDF");
        }
        const payload = await res.json();
        const parsed = payload.data || {};

        form.setValue("title", parsed.title || file.name.replace(".pdf", ""));
        form.setValue("abstract", parsed.abstract || "");
        form.setValue("venue", parsed.venue || "");
        form.setValue("doi", parsed.doi || "");
        form.setValue("publicationDate", parsed.publicationDate || "");
        const parsedAuthors: string[] = Array.isArray(parsed.authors) ? parsed.authors : [];
        setAuthors(parsedAuthors.length ? parsedAuthors : [""]);
      } catch (err: any) {
        setAutoFillError(err?.message || "Failed to auto-fill from PDF");
      } finally {
        setAutoFillLoading(false);
      }
    },
    [form]
  );

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(".pdf", ""));
      }
      autofillFromPdf(file);
    }
  };

  const onSubmit = async (data: AddSourceInput) => {
    if (sourceType === "pdf" && !selectedFile) {
      return;
    }

    if (sourceType === "url" && !data.url) {
      form.setError("url", { message: "URL is required" });
      return;
    }

    const authorsData = authors.filter((a) => a.trim() !== "");

    try {
      await uploadMutation.mutateAsync({
        file: sourceType === "pdf" ? selectedFile! : undefined,
        formData: {
          ...data,
          sourceType,
          authors: authorsData.length > 0 ? authorsData : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          url: data.url === "" ? undefined : data.url,
          publicationDate: data.publicationDate === "" ? undefined : data.publicationDate,
        },
      });
    } catch (error) {
      // Error is handled by mutation state
      console.error("Failed to upload source", error);
    }
  };

  // If bulk upload is selected, render only the bulk upload form
  if (sourceType === "bulk") {
    return (
      <div className="space-y-4">
        <SourceTypeSelector form={form} value={sourceType} onValueChange={setSourceType} />
        <BulkUploadForm studyId={studyId} onSuccess={onSuccess} />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <SourceTypeSelector form={form} value={sourceType} onValueChange={setSourceType} />

        {/* PDF Upload Section */}
        {sourceType === "pdf" && (
          <PdfUploadForm selectedFile={selectedFile} onFileSelect={handleFileSelect} />
        )}

        {/* URL Input Section */}
        {sourceType === "url" && (
          <UrlSourceForm form={form} />
        )}

        {/* Metadata Section */}
        <SourceMetadataFields
          form={form}
          sourceType={sourceType}
          authors={authors}
          setAuthors={setAuthors}
          keywords={keywords}
          setKeywords={setKeywords}
          autoFillLoading={autoFillLoading}
          autoFillError={autoFillError}
        />

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={
              (sourceType === "pdf" && !selectedFile) || uploadMutation.isPending
            }
          >
            {uploadMutation.isPending
              ? "Saving..."
              : sourceType === "pdf"
                ? "Upload & Save"
                : "Add Source"}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>

        {uploadMutation.error && (
          <p className="text-sm text-destructive">
            {uploadMutation.error.message || "Failed to add source. Please try again."}
          </p>
        )}
      </form>
    </Form>
  );
}

