"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Save,
  BookOpen,
} from "lucide-react";

const COMMON_DATABASES = [
  "IEEE Xplore",
  "ACM Digital Library",
  "Scopus",
  "Web of Science",
  "Springer Link",
  "Google Scholar",
  "arXiv",
  "DBLP",
  "Other",
];

interface FormalSource {
  id?: string;
  name: string;
  type: "ACADEMIC_DATABASE" | "JOURNAL" | "CONFERENCE_PROCEEDINGS";
  searchString?: string | null;
  dateRange?: { start?: string; end?: string } | null;
}

interface SearchStrategyData {
  picoPopulation: string | null;
  picoIntervention: string | null;
  picoComparison: string | null;
  picoOutcome: string | null;
  formalSources: FormalSource[];
}

interface SearchStrategyEditorProps {
  studyId: string;
}

interface SourceFormData {
  name: string;
  type: "ACADEMIC_DATABASE" | "JOURNAL" | "CONFERENCE_PROCEEDINGS";
  searchString: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

const emptySourceForm: SourceFormData = {
  name: "",
  type: "ACADEMIC_DATABASE",
  searchString: "",
  dateRangeStart: "",
  dateRangeEnd: "",
};

async function fetchSearchStrategy(studyId: string): Promise<SearchStrategyData> {
  const response = await fetch(`/api/studies/${studyId}/parameters/search-strategy`);
  if (!response.ok) throw new Error("Failed to fetch search strategy");
  const data = await response.json();
  return data.data;
}

export function SearchStrategyEditor({ studyId }: SearchStrategyEditorProps) {
  const queryClient = useQueryClient();

  // PICO state
  const [population, setPopulation] = useState("");
  const [intervention, setIntervention] = useState("");
  const [comparison, setComparison] = useState("");
  const [outcome, setOutcome] = useState("");

  // Source management state
  const [sources, setSources] = useState<FormalSource[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sourceForm, setSourceForm] = useState<SourceFormData>(emptySourceForm);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ["search-strategy", studyId],
    queryFn: () => fetchSearchStrategy(studyId),
  });

  // Initialize state when data arrives
  useEffect(() => {
    if (data && !isInitialized) {
      setPopulation(data.picoPopulation || "");
      setIntervention(data.picoIntervention || "");
      setComparison(data.picoComparison || "");
      setOutcome(data.picoOutcome || "");
      setSources(data.formalSources || []);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/studies/${studyId}/parameters/search-strategy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            picoPopulation: population || null,
            picoIntervention: intervention || null,
            picoComparison: comparison || null,
            picoOutcome: outcome || null,
            formalSources: sources.map((s) => ({
              name: s.name,
              type: s.type,
              searchString: s.searchString || null,
              dateRange:
                s.dateRange?.start || s.dateRange?.end
                  ? s.dateRange
                  : null,
            })),
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["search-strategy", studyId] });
      queryClient.invalidateQueries({ queryKey: ["parameters", studyId] });
      if (data?.data?.formalSources) {
        setSources(data.data.formalSources);
      }
    },
  });

  // Source dialog handlers
  const openAddDialog = () => {
    setSourceForm(emptySourceForm);
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const source = sources[index];
    setSourceForm({
      name: source.name,
      type: source.type,
      searchString: source.searchString || "",
      dateRangeStart: source.dateRange?.start || "",
      dateRangeEnd: source.dateRange?.end || "",
    });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSaveSource = () => {
    const newSource: FormalSource = {
      name: sourceForm.name,
      type: sourceForm.type,
      searchString: sourceForm.searchString || null,
      dateRange:
        sourceForm.dateRangeStart || sourceForm.dateRangeEnd
          ? { start: sourceForm.dateRangeStart, end: sourceForm.dateRangeEnd }
          : null,
    };
    if (editingIndex !== null) {
      const updated = [...sources];
      updated[editingIndex] = newSource;
      setSources(updated);
    } else {
      setSources([...sources, newSource]);
    }
    setDialogOpen(false);
  };

  const handleDeleteSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading search strategy...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Search Strategy
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Define your search approach using the PICO framework and
              database-specific queries.
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save Strategy"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PICO Terms */}
        <div>
          <h4 className="text-sm font-medium mb-3">PICO Terms</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="population">Population *</Label>
              <Input
                id="population"
                value={population}
                onChange={(e) => setPopulation(e.target.value)}
                placeholder="e.g., Autonomous AI agents, LLM-based agents"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="intervention">Intervention *</Label>
              <Input
                id="intervention"
                value={intervention}
                onChange={(e) => setIntervention(e.target.value)}
                placeholder="e.g., Context management, memory management"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comparison">
                Comparison{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="comparison"
                value={comparison}
                onChange={(e) => setComparison(e.target.value)}
                placeholder="e.g., Manual vs. automated context handling"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome">
                Outcome{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g., Task completion rate, context utilization"
              />
            </div>
          </div>
        </div>

        {/* Database Search Definitions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">
              Database Search Definitions
            </h4>
            <Button onClick={openAddDialog} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Database
            </Button>
          </div>

          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No databases defined yet. Add databases and their search strings
              to plan your search.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Database</TableHead>
                  <TableHead>Search String</TableHead>
                  <TableHead className="w-[180px]">Date Range</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="secondary">{source.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded block max-w-[400px] truncate" title={source.searchString || ""}>
                        {source.searchString || "\u2014"}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {source.dateRange?.start && source.dateRange?.end
                        ? `${source.dateRange.start} \u2192 ${source.dateRange.end}`
                        : source.dateRange?.start || source.dateRange?.end || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {source.searchString && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCopy(source.searchString!, index)
                            }
                            title="Copy search string"
                          >
                            {copiedIndex === index ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(index)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSource(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add/Edit Source Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingIndex !== null
                  ? "Edit Database Search"
                  : "Add Database Search"}
              </DialogTitle>
              <DialogDescription>
                Define the search string for a specific database.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Database</Label>
                <Select
                  value={
                    COMMON_DATABASES.includes(sourceForm.name)
                      ? sourceForm.name
                      : "Other"
                  }
                  onValueChange={(v) =>
                    setSourceForm({
                      ...sourceForm,
                      name: v === "Other" ? sourceForm.name : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select database" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_DATABASES.map((db) => (
                      <SelectItem key={db} value={db}>
                        {db}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!COMMON_DATABASES.includes(sourceForm.name) && sourceForm.name !== "" && (
                  <Input
                    value={sourceForm.name}
                    onChange={(e) =>
                      setSourceForm({ ...sourceForm, name: e.target.value })
                    }
                    placeholder="Custom database name"
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Search String</Label>
                <Textarea
                  value={sourceForm.searchString}
                  onChange={(e) =>
                    setSourceForm({
                      ...sourceForm,
                      searchString: e.target.value,
                    })
                  }
                  placeholder='("context management" OR "memory management") AND ("AI agent" OR "LLM agent")'
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date Range From</Label>
                  <Input
                    type="month"
                    value={sourceForm.dateRangeStart}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        dateRangeStart: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date Range To</Label>
                  <Input
                    type="month"
                    value={sourceForm.dateRangeEnd}
                    onChange={(e) =>
                      setSourceForm({
                        ...sourceForm,
                        dateRangeEnd: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveSource}
                disabled={!sourceForm.name}
                className="w-full"
              >
                {editingIndex !== null ? "Update" : "Add"} Database
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {saveMutation.isSuccess && (
          <p className="text-sm text-green-600">Strategy saved.</p>
        )}
        {saveMutation.isError && (
          <p className="text-sm text-destructive">
            Failed to save. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
