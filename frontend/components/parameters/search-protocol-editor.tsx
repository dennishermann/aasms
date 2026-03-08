"use client";

import { useState, useMemo } from "react";
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
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { format } from "date-fns";

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

export interface SearchProtocolEntry {
  id: string;
  database: string;
  searchString: string;
  dateSearched: string | Date;
  dateRangeFrom?: string | Date | null;
  dateRangeTo?: string | Date | null;
  totalResults?: number | null;
  notes?: string | null;
  importBatchId?: string | null;
  importBatch?: {
    id: string;
    fileName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface SearchProtocolEditorProps {
  studyId: string;
}

interface FormData {
  database: string;
  searchString: string;
  dateSearched: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  totalResults: string;
  notes: string;
}

async function fetchSearchProtocolEntries(studyId: string): Promise<SearchProtocolEntry[]> {
  const response = await fetch(`/api/studies/${studyId}/search-protocol`);
  if (!response.ok) throw new Error("Failed to fetch search protocol entries");
  const data = await response.json();
  return data.data;
}

async function createEntry(studyId: string, formData: FormData): Promise<SearchProtocolEntry> {
  const response = await fetch(`/api/studies/${studyId}/search-protocol`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      database: formData.database,
      searchString: formData.searchString,
      dateSearched: formData.dateSearched,
      dateRangeFrom: formData.dateRangeFrom || undefined,
      dateRangeTo: formData.dateRangeTo || undefined,
      totalResults: formData.totalResults ? parseInt(formData.totalResults) : undefined,
      notes: formData.notes || undefined,
    }),
  });
  if (!response.ok) throw new Error("Failed to create entry");
  const data = await response.json();
  return data.data;
}

async function updateEntry(
  studyId: string,
  entryId: string,
  formData: FormData,
): Promise<SearchProtocolEntry> {
  const response = await fetch(`/api/studies/${studyId}/search-protocol/${entryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      database: formData.database,
      searchString: formData.searchString,
      dateSearched: formData.dateSearched,
      dateRangeFrom: formData.dateRangeFrom || undefined,
      dateRangeTo: formData.dateRangeTo || undefined,
      totalResults: formData.totalResults ? parseInt(formData.totalResults) : undefined,
      notes: formData.notes || undefined,
    }),
  });
  if (!response.ok) throw new Error("Failed to update entry");
  const data = await response.json();
  return data.data;
}

async function deleteEntry(studyId: string, entryId: string): Promise<void> {
  const response = await fetch(`/api/studies/${studyId}/search-protocol/${entryId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete entry");
}

export function SearchProtocolEditor({ studyId }: SearchProtocolEditorProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    database: "",
    searchString: "",
    dateSearched: new Date().toISOString().split("T")[0],
    dateRangeFrom: "",
    dateRangeTo: "",
    totalResults: "",
    notes: "",
  });

  // Fetch entries
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["searchProtocolEntries", studyId],
    queryFn: () => fetchSearchProtocolEntries(studyId),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => createEntry(studyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["searchProtocolEntries", studyId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!editingEntryId) throw new Error("No entry selected");
      return updateEntry(studyId, editingEntryId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["searchProtocolEntries", studyId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteEntry(studyId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["searchProtocolEntries", studyId] });
    },
  });

  const resetForm = () => {
    setFormData({
      database: "",
      searchString: "",
      dateSearched: new Date().toISOString().split("T")[0],
      dateRangeFrom: "",
      dateRangeTo: "",
      totalResults: "",
      notes: "",
    });
    setEditingEntryId(null);
  };

  const handleOpenDialog = (entry?: SearchProtocolEntry) => {
    if (entry) {
      setEditingEntryId(entry.id);
      setFormData({
        database: entry.database,
        searchString: entry.searchString,
        dateSearched: new Date(entry.dateSearched).toISOString().split("T")[0],
        dateRangeFrom: entry.dateRangeFrom
          ? new Date(entry.dateRangeFrom).toISOString().split("T")[0]
          : "",
        dateRangeTo: entry.dateRangeTo
          ? new Date(entry.dateRangeTo).toISOString().split("T")[0]
          : "",
        totalResults: entry.totalResults?.toString() || "",
        notes: entry.notes || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.database || !formData.searchString || !formData.dateSearched) {
      return;
    }

    if (editingEntryId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (entryId: string) => {
    if (confirm("Are you sure you want to delete this search protocol entry?")) {
      deleteMutation.mutate(entryId);
    }
  };

  // Compute summary stats
  const stats = useMemo(() => {
    return {
      databaseCount: new Set(entries.map((e) => e.database)).size,
      totalResults: entries.reduce((sum, e) => sum + (e.totalResults || 0), 0),
      dateRange: entries.length
        ? {
            min: new Date(Math.min(...entries.map((e) => new Date(e.dateSearched).getTime()))),
            max: new Date(Math.max(...entries.map((e) => new Date(e.dateSearched).getTime()))),
          }
        : null,
    };
  }, [entries]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-sm text-red-700">Failed to load search protocol entries.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.databaseCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Databases Searched</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.totalResults.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Results</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                {stats.dateRange ? (
                  <>
                    <p className="text-lg font-bold">
                      {format(stats.dateRange.min, "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      to {format(stats.dateRange.max, "MMM dd, yyyy")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No date range</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entries Table */}
      {entries.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Database</TableHead>
                <TableHead>Search String</TableHead>
                <TableHead>Date Searched</TableHead>
                <TableHead className="text-right">Results</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{entry.database}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    <span title={entry.searchString}>{entry.searchString}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(entry.dateSearched), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.totalResults !== null && entry.totalResults !== undefined
                      ? entry.totalResults.toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.dateRangeFrom && entry.dateRangeTo ? (
                      <span>
                        {format(new Date(entry.dateRangeFrom), "yyyy")} -{" "}
                        {format(new Date(entry.dateRangeTo), "yyyy")}
                      </span>
                    ) : entry.dateRangeFrom || entry.dateRangeTo ? (
                      <span>
                        {entry.dateRangeFrom ? format(new Date(entry.dateRangeFrom), "yyyy") : "-"}{" "}
                        - {entry.dateRangeTo ? format(new Date(entry.dateRangeTo), "yyyy") : "-"}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(entry)}
                        disabled={isSaving}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isSaving || deleteMutation.isPending}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading search protocol entries...</p>
        </div>
      ) : (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm font-medium">No search protocol entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Document your search strategy to ensure reproducibility
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Entry Button */}
      <Button
        onClick={() => handleOpenDialog()}
        className="w-full"
        variant="outline"
        disabled={isSaving}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Search Protocol Entry
      </Button>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingEntryId ? "Edit Search Protocol Entry" : "Add Search Protocol Entry"}
            </DialogTitle>
            <DialogDescription>
              Document the search strategy for a database or source. Include the exact search string
              used, when it was searched, and how many results were returned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Database */}
            <div className="space-y-2">
              <Label htmlFor="database">Database *</Label>
              <Select
                value={formData.database}
                onValueChange={(value) => {
                  setFormData({ ...formData, database: value === "Other" ? "" : value });
                }}
              >
                <SelectTrigger id="database">
                  <SelectValue placeholder="Select a database" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_DATABASES.map((db) => (
                    <SelectItem key={db} value={db}>
                      {db}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.database === "" && (
                <Input
                  placeholder="Enter custom database name"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>

            {/* Search String */}
            <div className="space-y-2">
              <Label htmlFor="searchString">Search String *</Label>
              <Textarea
                id="searchString"
                placeholder="Enter the exact search query used (e.g., (systematic OR systematic mapping) AND (review OR map))"
                value={formData.searchString}
                onChange={(e) => setFormData({ ...formData, searchString: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Date Searched */}
            <div className="space-y-2">
              <Label htmlFor="dateSearched">Date Searched *</Label>
              <Input
                id="dateSearched"
                type="date"
                value={formData.dateSearched}
                onChange={(e) => setFormData({ ...formData, dateSearched: e.target.value })}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateRangeFrom">Publication Date From</Label>
                <Input
                  id="dateRangeFrom"
                  type="date"
                  value={formData.dateRangeFrom}
                  onChange={(e) => setFormData({ ...formData, dateRangeFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateRangeTo">Publication Date To</Label>
                <Input
                  id="dateRangeTo"
                  type="date"
                  value={formData.dateRangeTo}
                  onChange={(e) => setFormData({ ...formData, dateRangeTo: e.target.value })}
                />
              </div>
            </div>

            {/* Total Results */}
            <div className="space-y-2">
              <Label htmlFor="totalResults">Total Results</Label>
              <Input
                id="totalResults"
                type="number"
                placeholder="Number of search results"
                value={formData.totalResults}
                onChange={(e) => setFormData({ ...formData, totalResults: e.target.value })}
                min="0"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this search (e.g., filters applied, databases unavailable, etc.)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving || !formData.database || !formData.searchString || !formData.dateSearched
              }
            >
              {isSaving ? "Saving..." : editingEntryId ? "Update Entry" : "Create Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
