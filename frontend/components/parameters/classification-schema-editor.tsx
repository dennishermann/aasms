"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2 } from "lucide-react";

// Updated Facet interface matching new schema
export interface FacetCategory {
  id?: string;  // undefined for new categories
  name: string;
  description?: string;
}

export interface Facet {
  id?: string;  // undefined for new facets (temp ID used locally)
  tempId?: string;  // Local temp ID for unsaved facets
  name: string;
  description?: string;
  type: "CLOSED" | "OPEN";
  required: boolean;
  categories: FacetCategory[];
  researchQuestionIds: string[];  // Changed from single to array
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

  const generateTempId = () => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddFacet = () => {
    const newFacet: Facet = {
      tempId: generateTempId(),
      name: "",
      description: "",
      type: "CLOSED",
      required: true,
      categories: [],
      researchQuestionIds: researchQuestions.length > 0 ? [researchQuestions[0].id] : [],
    };
    onChange([...value, newFacet]);
  };

  const getFacetKey = (facet: Facet) => facet.id || facet.tempId || "";

  const handleRemoveFacet = (facetKey: string) => {
    onChange(value.filter(f => getFacetKey(f) !== facetKey));
  };

  const handleUpdateFacet = (facetKey: string, updates: Partial<Facet>) => {
    onChange(value.map(f => getFacetKey(f) === facetKey ? { ...f, ...updates } : f));
  };

  const handleAddCategory = (facetKey: string) => {
    const facet = value.find(f => getFacetKey(f) === facetKey);
    if (facet) {
      const newCategory: FacetCategory = { name: "" };
      handleUpdateFacet(facetKey, { categories: [...facet.categories, newCategory] });
    }
  };

  const handleUpdateCategory = (facetKey: string, categoryIndex: number, updates: Partial<FacetCategory>) => {
    const facet = value.find(f => getFacetKey(f) === facetKey);
    if (facet) {
      const updatedCategories = facet.categories.map((cat, i) =>
        i === categoryIndex ? { ...cat, ...updates } : cat
      );
      handleUpdateFacet(facetKey, { categories: updatedCategories });
    }
  };

  const handleRemoveCategory = (facetKey: string, categoryIndex: number) => {
    const facet = value.find(f => getFacetKey(f) === facetKey);
    if (facet) {
      const updatedCategories = facet.categories.filter((_, i) => i !== categoryIndex);
      handleUpdateFacet(facetKey, { categories: updatedCategories });
    }
  };

  const handleToggleResearchQuestion = (facetKey: string, rqId: string, checked: boolean) => {
    const facet = value.find(f => getFacetKey(f) === facetKey);
    if (facet) {
      let updatedRqIds: string[];
      if (checked) {
        updatedRqIds = [...facet.researchQuestionIds, rqId];
      } else {
        updatedRqIds = facet.researchQuestionIds.filter(id => id !== rqId);
      }
      handleUpdateFacet(facetKey, { researchQuestionIds: updatedRqIds });
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
        {value.map((facet, index) => {
          const facetKey = getFacetKey(facet);
          return (
            <Card key={facetKey} className="relative overflow-hidden group border-muted-foreground/20">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />

              <CardHeader className="pl-6 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          F{index + 1}
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
                      onClick={() => handleRemoveFacet(facetKey)}
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
                      <Label htmlFor={`name-${facetKey}`}>Facet Name <span className="text-destructive">*</span></Label>
                      <Input
                        id={`name-${facetKey}`}
                        placeholder="e.g., Publication Venue, Research Method"
                        value={facet.name}
                        onChange={(e) => handleUpdateFacet(facetKey, { name: e.target.value })}
                      />
                    </div>

                    {/* Multi-select Research Questions */}
                    <div className="space-y-2">
                      <Label>Research Questions</Label>
                      <div className="border rounded-md p-3 space-y-2 max-h-[150px] overflow-y-auto bg-background">
                        {researchQuestions.map((rq, idx) => (
                          <div key={rq.id} className="flex items-start gap-2">
                            <Checkbox
                              id={`rq-${facetKey}-${rq.id}`}
                              checked={facet.researchQuestionIds.includes(rq.id)}
                              onCheckedChange={(checked) =>
                                handleToggleResearchQuestion(facetKey, rq.id, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`rq-${facetKey}-${rq.id}`}
                              className="text-sm cursor-pointer leading-tight"
                            >
                              <span className="font-semibold text-muted-foreground">RQ{idx + 1}:</span>{" "}
                              <span className="text-foreground">{rq.question}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select which research questions this facet helps answer.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`desc-${facetKey}`}>Description</Label>
                      <Textarea
                        id={`desc-${facetKey}`}
                        placeholder="Describe what this facet classifies..."
                        value={facet.description || ""}
                        onChange={(e) => handleUpdateFacet(facetKey, { description: e.target.value })}
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
                              onValueChange={(value) => handleUpdateFacet(facetKey, { type: value as "CLOSED" | "OPEN" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CLOSED">Category</SelectItem>
                                <SelectItem value="OPEN">Free Text</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Constraint</Label>
                            <div className="flex items-center h-10 px-3 border rounded-md bg-background">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`req-${facetKey}`}
                                  checked={facet.required}
                                  onCheckedChange={(checked) => handleUpdateFacet(facetKey, { required: checked as boolean })}
                                />
                                <Label htmlFor={`req-${facetKey}`} className="font-normal cursor-pointer">
                                  Required Field
                                </Label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {facet.type === "CLOSED"
                            ? "LLM must choose from predefined categories."
                            : "LLM extracts text or generates a value based on content."}
                        </div>
                      </div>

                      {facet.type === "CLOSED" && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <Label>Categories</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAddCategory(facetKey)}
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
                                <div key={category.id || idx} className="flex items-center gap-2">
                                  <Input
                                    className="h-8"
                                    placeholder={`Category ${idx + 1}`}
                                    value={category.name}
                                    onChange={(e) => handleUpdateCategory(facetKey, idx, { name: e.target.value })}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemoveCategory(facetKey, idx)}
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
          );
        })}
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
