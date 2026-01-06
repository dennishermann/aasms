"use client";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Loader2 } from "lucide-react";
import { useState } from "react";
import { UseFormReturn } from "react-hook-form";

interface SourceMetadataFieldsProps {
    form: UseFormReturn<any>;
    sourceType: "pdf" | "url" | "bulk";
    authors: string[];
    setAuthors: (authors: string[]) => void;
    keywords: string[];
    setKeywords: (keywords: string[]) => void;
    autoFillLoading?: boolean;
    autoFillError?: string | null;
}

export function SourceMetadataFields({
    form,
    sourceType,
    authors,
    setAuthors,
    keywords,
    setKeywords,
    autoFillLoading,
    autoFillError,
}: SourceMetadataFieldsProps) {
    const [keywordInput, setKeywordInput] = useState("");

    const addKeyword = () => {
        if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
            setKeywords([...keywords, keywordInput.trim()]);
            setKeywordInput("");
        }
    };

    const removeKeyword = (keyword: string) => {
        setKeywords(keywords.filter((k) => k !== keyword));
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Source Metadata</CardTitle>
                <CardDescription className="text-sm flex items-center gap-2">
                    {autoFillLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-primary font-medium">Extracting metadata from PDF...</span>
                        </>
                    ) : (
                        <>
                            Provide information about the source
                            {sourceType === "pdf" && " — auto-filled from PDF when possible"}
                            {autoFillError && <span className="text-destructive ml-2"> {autoFillError}</span>}
                        </>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title *</FormLabel>
                            <FormControl>
                                {autoFillLoading ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <Input placeholder="Enter title" {...field} />
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div>
                    <FormLabel>Authors</FormLabel>
                    {autoFillLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-2/3" />
                        </div>
                    ) : (
                        <>
                            {authors.map((author, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <Input
                                        placeholder={`Author ${index + 1}`}
                                        value={author}
                                        onChange={(e) => {
                                            const updated = [...authors];
                                            updated[index] = e.target.value;
                                            setAuthors(updated);
                                        }}
                                    />
                                    {authors.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setAuthors(authors.filter((_, i) => i !== index))}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setAuthors([...authors, ""])}
                            >
                                Add Author
                            </Button>
                        </>
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="publicationDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Publication/Post Date</FormLabel>
                            <FormControl>
                                {autoFillLoading ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <Input type="date" {...field} />
                                )}
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
                            <FormLabel>
                                {sourceType === "pdf" ? "Venue/Source" : "Website/Blog Name"}
                            </FormLabel>
                            <FormControl>
                                {autoFillLoading ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <Input
                                        placeholder={
                                            sourceType === "pdf"
                                                ? "Conference or journal name"
                                                : "Website or blog name"
                                        }
                                        {...field}
                                    />
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {sourceType === "pdf" && (
                    <FormField
                        control={form.control}
                        name="doi"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>DOI (Optional)</FormLabel>
                                <FormControl>
                                    {autoFillLoading ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : (
                                        <Input placeholder="10.1234/example" {...field} />
                                    )}
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="abstract"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Abstract/Summary</FormLabel>
                            <FormControl>
                                {autoFillLoading ? (
                                    <Skeleton className="h-32 w-full" />
                                ) : (
                                    <Textarea
                                        placeholder={
                                            sourceType === "pdf" ? "Document abstract" : "Article or post summary"
                                        }
                                        rows={4}
                                        {...field}
                                    />
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div>
                    <FormLabel>Keywords</FormLabel>
                    {autoFillLoading ? (
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-20" />
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2 mb-2">
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
                        </>
                    )}
                </div>

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
                                    <SelectItem value="FORMAL">Formal (Academic, peer-reviewed)</SelectItem>
                                    <SelectItem value="GREY">Grey (Reports, blogs, white papers)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                Choose whether this is formal academic literature or grey literature
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
}
