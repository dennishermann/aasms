import { Source } from "@/types/source";
import { SourceItem } from "./source-item";

interface SourceListProps {
    sources: Source[];
    tab: string;
    isEditMode: boolean;
    selectedIds: Set<string>;
    onToggleSelection: (id: string, checked: boolean) => void;
    onDelete: (source: Source) => void;
    suggestions: Record<string, any>;
    loadingMap: Record<string, boolean>;
    onReparse: (id: string) => void;
    onApplySuggestions: (id: string) => void;
    sourceRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    getSourceUrl: (id: string) => string;
}

export function SourceList({
    sources,
    tab,
    isEditMode,
    selectedIds,
    onToggleSelection,
    onDelete,
    suggestions,
    loadingMap,
    onReparse,
    onApplySuggestions,
    sourceRefs,
    getSourceUrl,
}: SourceListProps) {
    if (sources.length === 0) {
        return (
            <p className="text-muted-foreground text-center py-8">
                No sources found in this category.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {sources.map((source) => {
                const isSelected = selectedIds.has(source.id);

                return (
                    <SourceItem
                        key={source.id}
                        ref={(el) => { sourceRefs.current[source.id] = el; }}
                        source={source}
                        isEditMode={isEditMode}
                        isSelected={isSelected}
                        onToggleSelection={onToggleSelection}
                        onDelete={onDelete}
                        currentTab={tab}
                        suggestion={suggestions[source.id]}
                        isLoading={loadingMap[source.id]}
                        onReparse={onReparse}
                        onApplySuggestions={onApplySuggestions}
                        getSourceUrl={getSourceUrl}
                    />
                );
            })}
        </div>
    );
}
