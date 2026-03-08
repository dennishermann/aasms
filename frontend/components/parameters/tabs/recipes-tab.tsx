"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecipeEditor, LocalRecipe } from "@/components/parameters/recipe-editor";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";

interface ApiFacet {
  id: string;
  name: string;
  description: string | null;
  type: "CLOSED" | "OPEN" | "OPEN_CODED";
  required: boolean;
  order: number;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    order: number;
  }>;
  researchQuestionIds: string[];
  metadataField?: string | null;
  metadataTransform?: string | null;
}

interface RecipesTabProps {
  studyId: string;
  apiRecipes: any[];
  apiFacets: ApiFacet[];
  researchQuestions: ResearchQuestion[];
}

/**
 * Synthesis Recipes tab content
 */
export function RecipesTab({ studyId, apiRecipes, apiFacets, researchQuestions }: RecipesTabProps) {
  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
              Analysis
            </span>
            RQ Recipes
          </CardTitle>
          <CardDescription className="mt-2">
            Define analysis recipes that operationalize your research questions into quantitative
            answers
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <RecipeEditor
          studyId={studyId}
          recipes={apiRecipes || []}
          facets={apiFacets || []}
          researchQuestions={researchQuestions.map((rq) => ({
            id: rq.id || `temp-${rq.order}`,
            question: rq.question,
          }))}
        />
      </CardContent>
    </Card>
  );
}
