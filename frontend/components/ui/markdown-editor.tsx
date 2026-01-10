"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, Edit3 } from "lucide-react";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder,
    rows = 8,
    className,
}: MarkdownEditorProps) {
    const [isPreview, setIsPreview] = useState(false);

    return (
        <div className={cn("space-y-2", className)}>
            {/* Toggle Buttons */}
            <div className="flex items-center gap-1 border-b pb-2">
                <Button
                    type="button"
                    variant={isPreview ? "ghost" : "secondary"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setIsPreview(false)}
                >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                </Button>
                <Button
                    type="button"
                    variant={isPreview ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setIsPreview(true)}
                >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                    Markdown supported
                </span>
            </div>

            {/* Content Area */}
            {isPreview ? (
                <div
                    className={cn(
                        "min-h-[200px] p-4 border rounded-md bg-muted/20",
                        "prose prose-sm dark:prose-invert max-w-none",
                        "prose-headings:mt-4 prose-headings:mb-2",
                        "prose-p:my-2 prose-ul:my-2 prose-ol:my-2",
                        "prose-li:my-0.5"
                    )}
                >
                    {value ? (
                        <ReactMarkdown>{value}</ReactMarkdown>
                    ) : (
                        <p className="text-muted-foreground italic">Nothing to preview</p>
                    )}
                </div>
            ) : (
                <Textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className="resize-none font-mono text-sm"
                />
            )}
        </div>
    );
}
