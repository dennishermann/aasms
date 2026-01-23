import type { RecipeType, RecipeStatus, RecipeConfig, RqRecipe } from "@/types/recipe";

// Local recipe type for editing (before save)
export interface LocalRecipe {
  id?: string;
  tempId?: string;
  name: string;
  description?: string;
  researchQuestionId?: string | null;
  type: RecipeType;
  xFacetId?: string | null;
  yFacetId?: string | null;
  groupByFacetId?: string | null;
  config: RecipeConfig;
  status: RecipeStatus;
  statusReason?: string | null;
  order: number;
}

export interface ResearchQuestion {
  id: string;
  question: string;
}

export interface Facet {
  id: string;
  name: string;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
}

export interface RecipeEditorProps {
  studyId: string;
  recipes: RqRecipe[];
  facets: Facet[];
  researchQuestions: ResearchQuestion[];
}

export interface RecipeListProps {
  recipes: LocalRecipe[];
  selectedRecipeKey: string | null;
  onSelectRecipe: (key: string) => void;
  onAddRecipe: () => void;
  getRecipeKey: (recipe: LocalRecipe) => string;
  researchQuestions: ResearchQuestion[];
}

export interface RecipeFormProps {
  recipe: LocalRecipe;
  recipeKey: string;
  researchQuestions: ResearchQuestion[];
  facets: Facet[];
  onUpdate: (updates: Partial<LocalRecipe>) => void;
  onDelete: (key: string) => void;
  isSaving?: boolean;
}

export interface RecipeTypeSelectorProps {
  value: RecipeType;
  onChange: (type: RecipeType) => void;
  disabled?: boolean;
}

export interface DimensionConfigProps {
  label: string;
  value: string | null | undefined;
  onChange: (facetId: string | null) => void;
  facets: Facet[];
  allowedTypes?: Array<"CLOSED" | "OPEN" | "OPEN_CODED">;
  placeholder?: string;
}
