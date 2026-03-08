import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, RefreshCw, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface SourceHeaderProps {
  source: any; // Ideally we should use the Source type
  studyId: string;
  sourceId: string;
  onEdit: () => void;
  onDeleteRequest: () => void;
  reparseMutation: UseMutationResult<any, any, void, unknown>;
  onReparseSuccess?: (data: any) => void;
  classifyMutation: UseMutationResult<any, any, void, unknown>;
  loadingInclusionAnalysis: boolean;
  loadingClassificationAnalysis: boolean;
}

export function SourceHeader({
  source,
  studyId,
  sourceId,
  onEdit,
  onDeleteRequest,
  reparseMutation,
  onReparseSuccess,
  classifyMutation,
  loadingInclusionAnalysis,
  loadingClassificationAnalysis,
}: SourceHeaderProps) {
  return (
    <CardHeader className="space-y-4 pb-2">
      <div className="flex items-start justify-between gap-4">
        {/* Title */}
        <div className="space-y-1 flex-1">
          <CardTitle className="text-2xl font-bold leading-tight">{source.title}</CardTitle>
        </div>

        {/* Consolidated Actions Toolbar */}
        <div className="flex items-center gap-2">
          {/* Primary Action: Open PDF (Only if PDF exists) */}
          {source.storagePath && source.storagePath.toLowerCase().endsWith(".pdf") && (
            <Button variant="outline" size="sm" asChild className="h-8">
              <a
                href={`/api/studies/${studyId}/sources/${sourceId}/content`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                Open PDF
              </a>
            </Button>
          )}

          {/* Edit Metadata */}
          <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
            <Edit className="h-3.5 w-3.5 mr-2" />
            Edit
          </Button>

          {/* Secondary Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Analysis Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => reparseMutation.mutate(undefined, { onSuccess: onReparseSuccess })}
                disabled={reparseMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {reparseMutation.isPending ? "Parsing..." : "Re-parse with LLM"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => classifyMutation.mutate()}
                disabled={
                  classifyMutation.isPending ||
                  loadingInclusionAnalysis ||
                  loadingClassificationAnalysis ||
                  !["ANALYZING_CLASSIFICATION", "CLASSIFIED", "READY_FOR_ANALYSIS"].includes(
                    source.status,
                  )
                }
              >
                <FileText className="h-4 w-4 mr-2" />
                {classifyMutation.isPending ? "Classifying..." : "Run Classification"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteRequest}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Source
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metadata Row: Badges & Authors */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              source.status === "NEEDS_REVIEW" ? "border-destructive text-destructive" : ""
            }
          >
            {source.status.replace(/_/g, " ")}
          </Badge>
          <div className="h-4 w-px bg-border" />
          <Badge variant="secondary">{source.type}</Badge>
          <Badge variant={source.sourceCategory === "FORMAL" ? "default" : "secondary"}>
            {source.sourceCategory}
          </Badge>
        </div>

        {/* Authors */}
        {source.authors.length > 0 && (
          <div className="text-muted-foreground text-sm">By {source.authors.join(", ")}</div>
        )}
      </div>
    </CardHeader>
  );
}
