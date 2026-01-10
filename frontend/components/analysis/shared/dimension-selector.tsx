"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DimensionOption } from "@/hooks/use-analysis-page";
import { BUILT_IN_DIMENSIONS } from "@/hooks/use-analysis-page";

interface DimensionSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  options: DimensionOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DimensionSelector({
  value,
  onValueChange,
  options,
  placeholder = "Select dimension",
  className = "w-[200px]",
  disabled = false,
}: DimensionSelectorProps) {
  const builtInOptions = options.filter((o) => o.group === "built-in");
  const facetOptions = options.filter((o) => o.group === "facet");

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {builtInOptions.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Built-in Dimensions
            </div>
            {builtInOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </>
        )}
        {facetOptions.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
              Classification Facets
            </div>
            {facetOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
