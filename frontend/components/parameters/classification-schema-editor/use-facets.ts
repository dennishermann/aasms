import { useCallback } from "react";
import { Facet, FacetCategory } from "./types";

export function useFacets(
  value: Facet[],
  onChange: (facets: Facet[]) => void,
  researchQuestions: { id: string }[],
) {
  const generateTempId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const getFacetKey = useCallback((facet: Facet) => {
    return facet.id || facet.tempId || "";
  }, []);

  const handleAddFacet = useCallback(() => {
    const newFacet: Facet = {
      tempId: generateTempId(),
      name: "",
      description: "",
      type: "CLOSED",
      required: true,
      categories: [],
      researchQuestionIds: researchQuestions.length > 0 ? [researchQuestions[0].id] : [],
    };
    onChange([...value, newFacet]);
  }, [value, onChange, researchQuestions, generateTempId]);

  const handleRemoveFacet = useCallback(
    (facetKey: string) => {
      onChange(value.filter((f) => getFacetKey(f) !== facetKey));
    },
    [value, onChange, getFacetKey],
  );

  const handleUpdateFacet = useCallback(
    (facetKey: string, updates: Partial<Facet>) => {
      onChange(value.map((f) => (getFacetKey(f) === facetKey ? { ...f, ...updates } : f)));
    },
    [value, onChange, getFacetKey],
  );

  const handleAddCategory = useCallback(
    (facetKey: string) => {
      const facet = value.find((f) => getFacetKey(f) === facetKey);
      if (facet) {
        const newCategory: FacetCategory = { name: "" };
        handleUpdateFacet(facetKey, { categories: [...facet.categories, newCategory] });
      }
    },
    [value, getFacetKey, handleUpdateFacet],
  );

  const handleUpdateCategory = useCallback(
    (facetKey: string, categoryIndex: number, updates: Partial<FacetCategory>) => {
      const facet = value.find((f) => getFacetKey(f) === facetKey);
      if (facet) {
        const updatedCategories = facet.categories.map((cat, i) =>
          i === categoryIndex ? { ...cat, ...updates } : cat,
        );
        handleUpdateFacet(facetKey, { categories: updatedCategories });
      }
    },
    [value, getFacetKey, handleUpdateFacet],
  );

  const handleRemoveCategory = useCallback(
    (facetKey: string, categoryIndex: number) => {
      const facet = value.find((f) => getFacetKey(f) === facetKey);
      if (facet) {
        const updatedCategories = facet.categories.filter((_, i) => i !== categoryIndex);
        handleUpdateFacet(facetKey, { categories: updatedCategories });
      }
    },
    [value, getFacetKey, handleUpdateFacet],
  );

  const handleToggleResearchQuestion = useCallback(
    (facetKey: string, rqId: string, checked: boolean) => {
      const facet = value.find((f) => getFacetKey(f) === facetKey);
      if (facet) {
        let updatedRqIds: string[];
        if (checked) {
          updatedRqIds = [...facet.researchQuestionIds, rqId];
        } else {
          updatedRqIds = facet.researchQuestionIds.filter((id) => id !== rqId);
        }
        handleUpdateFacet(facetKey, { researchQuestionIds: updatedRqIds });
      }
    },
    [value, getFacetKey, handleUpdateFacet],
  );

  return {
    getFacetKey,
    handleAddFacet,
    handleRemoveFacet,
    handleUpdateFacet,
    handleAddCategory,
    handleUpdateCategory,
    handleRemoveCategory,
    handleToggleResearchQuestion,
  };
}
