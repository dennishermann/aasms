"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createStudySchema, CreateStudyInput } from "@/lib/validations";
import { X, Plus } from "lucide-react";
import { useState } from "react";

interface StudyFormProps {
  onSuccess?: (study: any) => void;
}

export function StudyForm({ onSuccess }: StudyFormProps) {
  const [researchQuestions, setResearchQuestions] = useState<string[]>([""]);
  const queryClient = useQueryClient();

  const form = useForm<CreateStudyInput>({
    resolver: zodResolver(createStudySchema),
    defaultValues: {
      title: "",
      description: "",
      status: "DRAFT",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateStudyInput) => {
      const response = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create study");
      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      onSuccess?.(data);
    },
  });

  const onSubmit = (data: CreateStudyInput) => {
    const researchQuestionsData = researchQuestions
      .filter((q) => q.trim() !== "")
      .map((q, i) => ({ question: q, order: i }));

    createMutation.mutate({
      ...data,
      researchQuestions: researchQuestionsData.length > 0 ? researchQuestionsData : undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Microservices Architecture Patterns" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose and scope of this study..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Provide context about the study's objectives
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="motivation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivation</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why is this study important? What problem does it address?"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Explain the motivation and rationale behind this study
                  </FormDescription>
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
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Research Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {researchQuestions.map((question, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea
                    placeholder={`Research question ${index + 1}`}
                    value={question}
                    onChange={(e) => {
                      const updated = [...researchQuestions];
                      updated[index] = e.target.value;
                      setResearchQuestions(updated);
                    }}
                    rows={2}
                    className="flex-1 resize-none"
                    style={{
                      minHeight: '60px',
                      height: 'auto',
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                  {researchQuestions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setResearchQuestions(researchQuestions.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResearchQuestions([...researchQuestions, ""])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Research Question
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Study"}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>

        {createMutation.error && (
          <p className="text-sm text-destructive">
            Failed to create study. Please try again.
          </p>
        )}
      </form>
    </Form>
  );
}

