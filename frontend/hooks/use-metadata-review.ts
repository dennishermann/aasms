import { useState, useEffect } from "react";
import { UseMutationResult } from "@tanstack/react-query";

interface UseMetadataReviewProps {
    source: any;
    patchMutation: UseMutationResult<any, any, any, unknown>;
    onApplySuccess?: () => void;
}

const METADATA_FIELDS = [
    { key: "title", label: "Title" },
    { key: "authors", label: "Authors" },
    { key: "venue", label: "Venue" },
    { key: "doi", label: "DOI" },
    { key: "abstract", label: "Abstract" },
    { key: "publicationDate", label: "Publication Date" },
    { key: "keywords", label: "Keywords" },
];

export interface MetadataReviewState {
    showMetadataReview: boolean;
    isExtractingMetadata: boolean;
    parsedSuggestion: any;
    setParsedSuggestion: (data: any) => void;
    applyAll: boolean;
    setApplyAll: (val: boolean | ((prev: boolean) => boolean)) => void;
    selectedFields: Record<string, boolean>;
    setSelectedFields: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    originalMeta: Record<string, any>;
    parsedMeta: Record<string, any> | null;
    handleApply: () => void;
    isDifferent: (key: string) => boolean;
}

export function useMetadataReview({ source, patchMutation, onApplySuccess }: UseMetadataReviewProps): MetadataReviewState {
    const [parsedSuggestion, setParsedSuggestion] = useState<any | null>(null);
    const [applyAll, setApplyAll] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});

    const showMetadataReviewStatuses = ["PENDING_METADATA", "EXTRACTING_METADATA"];
    const showMetadataReview = showMetadataReviewStatuses.includes(source?.status as string);
    const isExtractingMetadata = source?.status === "EXTRACTING_METADATA";

    useEffect(() => {
        if (showMetadataReview && source?.metadataParsed) {
            setParsedSuggestion(source.metadataParsed);
        } else {
            setParsedSuggestion(null);
        }
    }, [showMetadataReview, source?.metadataParsed]);

    const originalMeta: Record<string, any> = source ? (source.metadataExtension
        ? {
            title: source.metadataExtension.title || source.title,
            authors: source.metadataExtension.authors || source.authors || [],
            venue: source.metadataExtension.venue || source.venue || "",
            doi: source.metadataExtension.doi || source.doi || "",
            abstract: source.metadataExtension.abstract || source.abstract || "",
            publicationDate: source.metadataExtension.publicationDate || source.publicationDate || "",
            keywords: source.metadataExtension.keywords || source.keywords || [],
        }
        : {
            title: source.title,
            authors: source.authors || [],
            venue: source.venue || "",
            doi: source.doi || "",
            abstract: source.abstract || "",
            publicationDate: source.publicationDate || "",
            keywords: source.keywords || [],
        }) : {};

    const parsedMeta: Record<string, any> | null = parsedSuggestion
        ? {
            title: parsedSuggestion.title || "",
            authors: parsedSuggestion.authors || [],
            venue: parsedSuggestion.venue || "",
            doi: parsedSuggestion.doi || "",
            abstract: parsedSuggestion.abstract || "",
            publicationDate: parsedSuggestion.publicationDate || "",
            keywords: parsedSuggestion.keywords || [],
        }
        : null;

    const combinedPayload = () => {
        if (!parsedMeta) return originalMeta;
        const out: Record<string, any> = { ...originalMeta };
        METADATA_FIELDS.forEach(({ key }) => {
            const useParsed = applyAll || selectedFields[key];
            if (useParsed) {
                out[key] = parsedMeta[key];
            }
        });
        return out;
    };

    const handleApply = () => {
        const payload = combinedPayload();
        const usedParsed =
            !!parsedMeta && (applyAll || METADATA_FIELDS.some(({ key }) => selectedFields[key]));
        const chosenSource = usedParsed ? "parsed" : "extension";
        patchMutation.mutate({
            ...payload,
            status: "READY_FOR_ANALYSIS",
            metadataChosen: payload,
            metadataChosenSource: chosenSource,
        }, {
            onSuccess: () => {
                setParsedSuggestion(null);
                setSelectedFields({});
                setApplyAll(false);
                onApplySuccess?.();
            }
        });
    };

    const isDifferent = (key: string) => {
        if (!parsedMeta) return false;
        const a = originalMeta[key];
        const b = parsedMeta[key];
        if (Array.isArray(a) || Array.isArray(b)) {
            return (a || []).join(",").trim() !== (b || []).join(",").trim();
        }
        return (a || "").trim() !== (b || "").trim();
    };


    return {
        showMetadataReview,
        isExtractingMetadata,
        parsedSuggestion,
        setParsedSuggestion,
        applyAll,
        setApplyAll,
        selectedFields,
        setSelectedFields,
        originalMeta,
        parsedMeta,
        handleApply,
        isDifferent
    };
}
