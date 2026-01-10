// Types for the Classification Schema Editor

export interface FacetCategory {
    id?: string;  // undefined for new categories
    name: string;
    description?: string;
}

export interface Facet {
    id?: string;  // undefined for new facets (temp ID used locally)
    tempId?: string;  // Local temp ID for unsaved facets
    name: string;
    description?: string;
    type: "CLOSED" | "OPEN" | "OPEN_CODED";
    required: boolean;
    categories: FacetCategory[];
    researchQuestionIds: string[];
}

export interface ResearchQuestion {
    id: string;
    question: string;
}

export interface ClassificationSchemaEditorProps {
    value: Facet[];
    onChange: (facets: Facet[]) => void;
    researchQuestions: ResearchQuestion[];
    studyId?: string;
    onOpenCodingWizard?: (facet: Facet) => void;
}
