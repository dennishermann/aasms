"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DroppableCategoryProps {
    id: string;
    children: ReactNode;
    className?: string;
}

/**
 * A droppable zone for categories. Accepts draggable items.
 * Provides visual feedback when items are dragged over.
 */
export function DroppableCategory({
    id,
    children,
    className,
}: DroppableCategoryProps) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div
            id={id}
            ref={setNodeRef}
            className={cn(
                "transition-all duration-200 pointer-events-auto",
                isOver && "ring-2 ring-primary ring-offset-1 bg-primary/10 rounded-lg scale-[1.02]",
                className
            )}
        >
            {children}
        </div>
    );
}
