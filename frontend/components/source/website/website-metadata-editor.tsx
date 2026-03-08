"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Source } from "@/types/source";

const websiteMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  originalUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  authors: z.array(z.string()).optional(),
  venue: z.string().optional(), // Maps to Website Name
  publicationDate: z.string().optional(),
  abstract: z.string().optional(), // Maps to Summary
});

type WebsiteMetadataInput = z.infer<typeof websiteMetadataSchema>;

interface WebsiteMetadataEditorProps {
  source: Source;
  onCancel: () => void;
  onSaveSuccess: () => void;
}

export function WebsiteMetadataEditor({
  source,
  onCancel,
  onSaveSuccess,
}: WebsiteMetadataEditorProps) {
  const queryClient = useQueryClient();

  const form = useForm<WebsiteMetadataInput>({
    resolver: zodResolver(websiteMetadataSchema),
    defaultValues: {
      title: source.title || "",
      originalUrl: source.originalUrl || "",
      authors: source.authors || [],
      venue: source.venue || "",
      publicationDate: source.publicationDate
        ? new Date(source.publicationDate).toISOString().split("T")[0]
        : "",
      abstract: source.abstract || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WebsiteMetadataInput) => {
      const res = await fetch(`/api/studies/${source.studyId}/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          originalUrl: data.originalUrl || null,
          authors: data.authors,
          venue: data.venue,
          publicationDate: data.publicationDate ? new Date(data.publicationDate) : null,
          abstract: data.abstract,
          // Ensure type remains WEBPAGE/BLOG_POST
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update source");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", source.studyId, source.id] });
      onSaveSuccess();
    },
  });

  const onSubmit = (data: WebsiteMetadataInput) => {
    // Clean up empty strings
    if (data.originalUrl === "") data.originalUrl = undefined;
    updateMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 border rounded-lg p-4 bg-background"
      >
        <div className="flex items-center justify-between pb-2 border-b mb-4">
          <h3 className="font-semibold text-lg">Edit Website Details</h3>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Page title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="originalUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website / Domain</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Anthropic Blog" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="authors"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authors / Team</FormLabel>
                <FormControl>
                  {/* Simple comma-separated input for now, could be improved */}
                  <Input
                    placeholder="Comma separated names"
                    value={field.value?.join(", ") || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="publicationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="abstract"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary / Abstract</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief summary of the content..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>

        {updateMutation.error && (
          <p className="text-sm text-destructive mt-2">{updateMutation.error.message}</p>
        )}
      </form>
    </Form>
  );
}
