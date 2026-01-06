"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

export interface Facet {
  id: string;
  researchQuestionId: string;
  name: string;
  description?: string;
  type: "closed" | "open";
  categories: string[];
  required?: boolean;
}

interface ResearchQuestion {
  id: string;
  question: string;
}

interface ClassificationSchemaEditorProps {
  value: Facet[];
  onChange: (facets: Facet[]) => void;
  researchQuestions: ResearchQuestion[];
}

export function ClassificationSchemaEditor({
  value,
  onChange,
  researchQuestions
}: ClassificationSchemaEditorProps) {

  const generateFacetId = () => {
    const existingIds = value.map(f => f.id);
    let counter = 1;
    while (existingIds.includes(`F${counter}`)) {
      counter++;
    }
    return `F${counter}`;
  };

  const handleAddFacet = () => {
    const newFacet: Facet = {
      id: generateFacetId(),
      researchQuestionId: researchQuestions[0]?.id || "",
      name: "",
      description: "",
      type: "closed",
      categories: [],
      required: true,
    };
    onChange([...value, newFacet]);
  };

  const handleRemoveFacet = (facetId: string) => {
    onChange(value.filter(f => f.id !== facetId));
  };

  const handleUpdateFacet = (facetId: string, updates: Partial<Facet>) => {
    onChange(value.map(f => f.id === facetId ? { ...f, ...updates } : f));
  };

  const handleAddCategory = (facetId: string) => {
    const facet = value.find(f => f.id === facetId);
    if (facet) {
      handleUpdateFacet(facetId, { categories: [...facet.categories, ""] });
    }
  };

  const handleUpdateCategory = (facetId: string, categoryIndex: number, newValue: string) => {
    const facet = value.find(f => f.id === facetId);
    if (facet) {
      const updatedCategories = [...facet.categories];
      updatedCategories[categoryIndex] = newValue;
      handleUpdateFacet(facetId, { categories: updatedCategories });
    }
  };

  const handleRemoveCategory = (facetId: string, categoryIndex: number) => {
    const facet = value.find(f => f.id === facetId);
    if (facet) {
      const updatedCategories = facet.categories.filter((_, i) => i !== categoryIndex);
      handleUpdateFacet(facetId, { categories: updatedCategories });
    }
  };

  if (researchQuestions.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
        <h3 className="text-lg font-semibold mb-2">No Research Questions Defined</h3>
        <p className="text-muted-foreground mb-4">
          Please add research questions to your study before creating classification facets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {value.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
          <p className="text-muted-foreground mb-4">No classification facets defined yet.</p>
          <Button variant="outline" onClick={handleAddFacet}>
            Create your first facet
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {value.map((facet, index) => (
          <Card key={facet.id} className="relative overflow-hidden group border-muted-foreground/20">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />

            <CardHeader className="pl-6 pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {facet.id}
                      </span>
                      {facet.name ? (
                        <CardTitle className="text-lg">{facet.name}</CardTitle>
                      ) : (
                        <CardTitle className="text-lg text-muted-foreground italic">Untitled Facet</CardTitle>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleRemoveFacet(facet.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pl-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Basic Config */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${facet.id}`}>Facet Name <span className="text-destructive">*</span></Label>
                    <Input
                      id={`name-${facet.id}`}
                      placeholder="e.g., Publication Venue, Research Method"
                      value={facet.name}
                      onChange={(e) => handleUpdateFacet(facet.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`rq-${facet.id}`}>Research Question</Label>
                    <Select
                      value={facet.researchQuestionId}
                      onValueChange={(value) => handleUpdateFacet(facet.id, { researchQuestionId: value })}
                    >
                      <SelectTrigger id={`rq-${facet.id}`}>
                        <SelectValue placeholder="Select research question" />
                      </SelectTrigger>
                      <SelectContent>
                        {researchQuestions.map((rq, idx) => (
                          <SelectItem key={rq.id} value={rq.id}>
                            <div className="flex items-start gap-2 max-w-sm">
                              <span className="font-semibold text-muted-foreground">RQ{idx + 1}</span>
                              <span className="truncate">{rq.question}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`desc-${facet.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${facet.id}`}
                      placeholder="Describe what this facet classifies..."
                      value={facet.description || ""}
                      onChange={(e) => handleUpdateFacet(facet.id, { description: e.target.value })}
                      className="resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Right Column: Type & Settings */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
                    <div className="space-y-3">
                      <Label>Configuration</Label>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
                          <Select
                            value={facet.type}
                            onValueChange={(value) => handleUpdateFacet(facet.id, { type: value as "closed" | "open" })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="closed">Category</SelectItem>
                              <SelectItem value="open">Free Text</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Constraint</Label>
                          <div className="flex items-center h-10 px-3 border rounded-md bg-background">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`req-${facet.id}`}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={facet.required !== false} // Default to true if undefined
                                onChange={(e) => handleUpdateFacet(facet.id, { required: e.target.checked })}
                              />
                              <Label htmlFor={`req-${facet.id}`} className="font-normal cursor-pointer">
                                Required Field
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {facet.type === "closed"
                          ? "LLM must choose from predefined categories."
                          : "LLM extracts text or generates a value based on content."}
                      </div>
                    </div>

                    {facet.type === "closed" && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label>Categories</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddCategory(facet.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {facet.categories.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-2">
                              No categories defined.
                            </p>
                          ) : (
                            facet.categories.map((category, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Input
                                  className="h-8"
                                  placeholder={`Category ${idx + 1}`}
                                  value={category}
                                  onChange={(e) => handleUpdateCategory(facet.id, idx, e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveCategory(facet.id, idx)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {value.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={handleAddFacet}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Facet
        </Button>
      )}
    </div>
  );
}

