"use client";

import { cn } from "@/lib/utils";
import { BarChart3, Grid3X3, TrendingUp, AlertTriangle } from "lucide-react";
import type { RecipeTypeSelectorProps } from "./types";
import type { RecipeType } from "@/types/recipe";

const RECIPE_TYPES: Array<{
  type: RecipeType;
  label: string;
  description: string;
  icon: typeof BarChart3;
  color: string;
}> = [
  {
    type: "DISTRIBUTION",
    label: "Distribution",
    description: "Frequency analysis for a single dimension",
    icon: BarChart3,
    color: "border-blue-500 bg-blue-50 text-blue-700",
  },
  {
    type: "MAP",
    label: "Systematic Map",
    description: "Cross-tabulation of two dimensions",
    icon: Grid3X3,
    color: "border-emerald-500 bg-emerald-50 text-emerald-700",
  },
  {
    type: "TREND",
    label: "Trend",
    description: "Publication trends over time",
    icon: TrendingUp,
    color: "border-amber-500 bg-amber-50 text-amber-700",
  },
  {
    type: "GAP",
    label: "Gap Analysis",
    description: "Identify under-researched areas",
    icon: AlertTriangle,
    color: "border-rose-500 bg-rose-50 text-rose-700",
  },
];

export function RecipeTypeSelector({ value, onChange, disabled = false }: RecipeTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Recipe Type</label>
      <div className="grid grid-cols-2 gap-3">
        {RECIPE_TYPES.map(({ type, label, description, icon: Icon, color }) => {
          const isSelected = value === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onChange(type)}
              disabled={disabled}
              className={cn(
                "p-3 rounded-lg border-2 text-left transition-all",
                isSelected ? color : "border-border bg-background hover:border-muted-foreground/30",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" />
                <span className="font-medium text-sm">{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
