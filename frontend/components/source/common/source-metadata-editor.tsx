"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Loader2, Save } from "lucide-react";

const metadataSchema = z.object({
    title: z.string().min(1, "Title is required"),
    authors: z.array(z.string()).optional(),
    publicationDate: z.string().optional(),
    venue: z.string().optional(),
    doi: z.string().optional(),
    abstract: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    sourceCategory: z.enum(["FORMAL", "GREY"]),
    status: z.string().optional(),
});

type MetadataInput = z.infer<typeof metadataSchema>;

interface Source {
    id: string;
    studyId: string;
    title: string;
    authors: string[];
    publicationDate: string | null;
    venue: string | null;
    doi: string | null;
    abstract: string | null;
    keywords: string[];
    sourceCategory: string;
    type: string;
    status: string;
    originalUrl?: string | null;
    storagePath?: string | null;
}

interface SourceMetadataEditorProps {
    source: Source;
    onCancel: () => void;
    onSaveSuccess: () => void;
}

export function SourceMetadataEditor({ source, onCancel, onSaveSuccess }: SourceMetadataEditorProps) {
    const [authors, setAuthors] = useState<string[]>(source.authors.length > 0 ? source.authors : [""]);
    const [keywords, setKeywords] = useState<string[]>(source.keywords);
    const [keywordInput, setKeywordInput] = useState("");
    const queryClient = useQueryClient();

    const form = useForm<MetadataInput>({
        resolver: zodResolver(metadataSchema),
        defaultValues: {
            title: source.title,
            authors: source.authors,
            publicationDate: source.publicationDate
                ? new Date(source.publicationDate).toISOString().split('T')[0]
                : "",
            venue: source.venue || "",
            doi: source.doi || "",
            abstract: source.abstract || "",
            keywords: source.keywords,
            sourceCategory: source.sourceCategory as "FORMAL" | "GREY",
            status: source.status,
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: MetadataInput) => {
            const response = await fetch(`/api/studies/${source.studyId}/sources/${source.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update metadata");
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["source", source.studyId, source.id] });
            queryClient.invalidateQueries({ queryKey: ["study", source.studyId] });
            onSaveSuccess();
        },
    });

    const addKeyword = () => {
        if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
            setKeywords([...keywords, keywordInput.trim()]);
            setKeywordInput("");
        }
    };

    const removeKeyword = (keyword: string) => {
        setKeywords(keywords.filter((k) => k !== keyword));
    };

    const onSubmit = (data: MetadataInput) => {
        const authorsData = authors.filter((a) => a.trim() !== "");
        updateMutation.mutate({
            ...data,
            authors: authorsData.length > 0 ? authorsData : undefined,
            keywords: keywords.length > 0 ? keywords : undefined,
        });
    };

    return (
        <CardContent className="space-y-6 pt-6 animate-in fade-in duration-200">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h3 className="text-lg font-semibold">Edit Metadata</h3>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onCancel}
                                disabled={updateMutation.isPending}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Save Changes
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div>
                            <FormLabel>Authors</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                                {authors.map((author, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            placeholder={`Author ${index + 1}`}
                                            value={author}
                                            onChange={(e) => {
                                                const updated = [...authors];
                                                updated[index] = e.target.value;
                                                setAuthors(updated);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setAuthors(authors.filter((_, i) => i !== index))}
                                            disabled={authors.length === 1 && authors[0] === ""}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 border-dashed"
                                    onClick={() => setAuthors([...authors, ""])}
                                >
                                    + Add Author
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="publicationDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Publication Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
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
                                        <FormLabel>Venue</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Conference or journal name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="doi"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>DOI</FormLabel>
                                        <FormControl>
                                            <Input placeholder="10.1234/example" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sourceCategory"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Source Category *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="FORMAL">
                                                    Formal (Academic, peer-reviewed)
                                                </SelectItem>
                                                <SelectItem value="GREY">
                                                    Grey (Reports, blogs, white papers)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PENDING">Pending</SelectItem>
                                                <SelectItem value="ANALYZING">Analyzing</SelectItem>
                                                <SelectItem value="ANALYZED">Analyzed</SelectItem>
                                                <SelectItem value="INCLUDED">Included</SelectItem>
                                                <SelectItem value="EXCLUDED">Excluded</SelectItem>
                                                <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
                                                <SelectItem value="EXTRACTING_METADATA">Extracting Metadata</SelectItem>
                                                <SelectItem value="PENDING_METADATA">Pending Metadata</SelectItem>
                                                <SelectItem value="READY_FOR_ANALYSIS">Ready for Analysis</SelectItem>
                                                <SelectItem value="ANALYZING_INCLUSION">Analyzing Inclusion</SelectItem>
                                                <SelectItem value="ANALYZING_CLASSIFICATION">Analyzing Classification</SelectItem>
                                                <SelectItem value="CLASSIFIED">Classified</SelectItem>
                                                <SelectItem value="READY_FOR_CLASSIFICATION">Ready for Classification</SelectItem>
                                                <SelectItem value="CLASSIFYING">Classifying</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                    <FormLabel>Abstract</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Document abstract" rows={6} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div>
                            <FormLabel>Keywords</FormLabel>
                            <div className="flex gap-2 mb-2 mt-1.5">
                                <Input
                                    placeholder="Add keyword"
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addKeyword();
                                        }
                                    }}
                                />
                                <Button type="button" variant="outline" onClick={addKeyword}>
                                    Add
                                </Button>
                            </div>
                            {keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {keywords.map((keyword) => (
                                        <Badge key={keyword} variant="secondary">
                                            {keyword}
                                            <button
                                                type="button"
                                                onClick={() => removeKeyword(keyword)}
                                                className="ml-2 hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {updateMutation.error && (
                        <p className="text-sm text-destructive">
                            {updateMutation.error.message || "Failed to update metadata"}
                        </p>
                    )}
                </form>
            </Form>
        </CardContent>
    );
}
