"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface UrlSourceFormProps {
    form: UseFormReturn<any>;
}

export function UrlSourceForm({ form }: UrlSourceFormProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Source URL</CardTitle>
                <CardDescription className="text-sm">
                    Enter the URL of the blog post or website
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>URL *</FormLabel>
                            <FormControl>
                                <Input placeholder="https://example.com/article" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button type="button" variant="outline" disabled className="flex-1">
                                    <Info className="h-4 w-4 mr-2" />
                                    Fetch Metadata
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Auto-fetch feature coming soon</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                    Future feature: Automatically extract metadata from URL
                </p>
            </CardContent>
        </Card>
    );
}
