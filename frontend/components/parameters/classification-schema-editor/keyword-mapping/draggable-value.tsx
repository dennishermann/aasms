"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableValueProps {
    value: string;
    categoryId: string;
    className?: string;
}

/**
 * A simple draggable value chip for plain string values.
 * Used by Coding Wizard where values are just strings (not KeywordMapping objects).
 * The drag ID is constructed as `categoryId::value` to identify both source and value.
 */
export function DraggableValue({ value, categoryId, className }: DraggableValueProps) {
    const dragId = `${categoryId}::${value}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });

    const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

    // Hide original when dragging (DragOverlay shows the visual)
    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                className="opacity-0 pointer-events-none inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border h-8"
            >
                <span className="text-sm">{value}</span>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-card text-sm",
                "cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-muted/30 transition-colors",
                className
            )}
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-3 w-3 text-muted-foreground/40" />
            <span>{value}</span>
        </div>
    );
}

interface StaticValueProps {
    value: string;
    className?: string;
}

/**
 * A static (non-draggable) value chip for use in DragOverlay.
 */
export function StaticValue({ value, className }: StaticValueProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-card text-sm shadow-lg pointer-events-none",
                className
            )}
        >
            <GripVertical className="h-3 w-3 text-muted-foreground/40" />
            <span>{value}</span>
        </div>
    );
}
