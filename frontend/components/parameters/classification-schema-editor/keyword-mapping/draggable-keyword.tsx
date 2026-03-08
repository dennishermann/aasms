"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Bot, User, GripVertical } from "lucide-react";

export interface KeywordMapping {
  id: string;
  keyword: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  confidence?: number | null;
  source?: "LLM" | "USER" | null;
  proposedCategoryName?: string | null;
  proposedCategoryDescription?: string | null;
}

interface DraggableKeywordProps {
  mapping: KeywordMapping;
  showStatus?: boolean;
  showConfidence?: boolean;
  showSource?: boolean;
}

export function DraggableKeyword({
  mapping,
  showStatus = true,
  showConfidence = true,
  showSource = false,
}: DraggableKeywordProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mapping.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  // When dragging, hide the original element completely (DragOverlay shows the visual)
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="opacity-0 pointer-events-none inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border"
      >
        <span className="text-sm">{mapping.keyword}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-card cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-muted/30 transition-colors"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/40" />
      {showStatus && <StatusIcon status={mapping.status} />}
      <span className="text-sm">{mapping.keyword}</span>
      {showConfidence && mapping.confidence != null && (
        <span
          className={cn(
            "text-[10px] font-mono ml-0.5",
            mapping.confidence > 0.7
              ? "text-green-600"
              : mapping.confidence > 0.4
                ? "text-amber-600"
                : "text-red-600",
          )}
        >
          {Math.round(mapping.confidence * 100)}%
        </span>
      )}
      {showSource && <SourceIcon source={mapping.source} />}
    </div>
  );
}

interface StaticKeywordProps {
  keyword: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  confidence?: number | null;
}

export function StaticKeyword({ keyword, status, confidence }: StaticKeywordProps) {
  return (
    <Badge variant="outline" className="px-2.5 py-1.5 text-sm font-normal bg-card shadow-lg border">
      {status && <StatusIcon status={status} />}
      <GripVertical className="h-3 w-3 text-muted-foreground/40 mr-1" />
      <span>{keyword}</span>
      {confidence != null && (
        <span
          className={cn(
            "text-[10px] font-mono ml-1",
            confidence > 0.7
              ? "text-green-600"
              : confidence > 0.4
                ? "text-amber-600"
                : "text-red-600",
          )}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </Badge>
  );
}

export function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />;
    case "PENDING":
      return <Clock className="h-3 w-3 text-amber-500 shrink-0" />;
    case "REJECTED":
      return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
    default:
      return null;
  }
}

export function SourceIcon({ source }: { source?: string | null }) {
  if (source === "LLM")
    return (
      <span title="AI-suggested">
        <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
      </span>
    );
  if (source === "USER")
    return (
      <span title="User-assigned">
        <User className="h-3 w-3 text-muted-foreground shrink-0" />
      </span>
    );
  return null;
}
