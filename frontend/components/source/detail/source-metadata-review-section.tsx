import { WebsiteMetadataReview } from "@/components/source/website/website-metadata-review";
import { MetadataReview } from "@/components/source/pdf/pdf-metadata-review";
import { useMetadataReview, MetadataReviewState } from "@/hooks/use-metadata-review";
import { UseMutationResult } from "@tanstack/react-query";

interface SourceMetadataReviewSectionProps {
    source: any;
    patchMutation: UseMutationResult<any, any, any, unknown>;
    reparseLoading: boolean;
    reviewState: MetadataReviewState;
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

const WEBSITE_METADATA_FIELDS = [
    { key: "title", label: "Title" },
    // URL removed as per user feedback (redundant with Open button and Venue)
    { key: "authors", label: "Authors / Team" },
    { key: "abstract", label: "Summary" },
    { key: "venue", label: "Website / Domain" },
    { key: "publicationDate", label: "Date" },
];

export function SourceMetadataReviewSection({
    source,
    patchMutation,
    reparseLoading,
    reviewState,
}: SourceMetadataReviewSectionProps) {
    const {
        showMetadataReview,
        isExtractingMetadata,
        parsedSuggestion,
        applyAll,
        setApplyAll,
        selectedFields,
        setSelectedFields,
        originalMeta,
        parsedMeta,
        handleApply,
    } = reviewState;

    if (!showMetadataReview) return null;

    const isWebsite = source.type === "WEBPAGE" || source.type === "BLOG_POST";
    const ReviewComponent = isWebsite ? WebsiteMetadataReview : MetadataReview;
    const fields = isWebsite ? WEBSITE_METADATA_FIELDS : METADATA_FIELDS;

    // We need to re-created the props that MetadataReview expects.
    // Note: MetadataReview expects onToggleField, onApply, etc.

    return (
        <ReviewComponent
            metadataFields={fields}
            originalMeta={originalMeta}
            parsedMeta={parsedMeta}
            applyAll={applyAll}
            selectedFields={selectedFields}
            onResetSelection={() => {
                setApplyAll(false);
                setSelectedFields({});
            }}
            onToggleApplyAll={() => {
                setApplyAll((prev: boolean) => {
                    const next = !prev;
                    if (next) setSelectedFields({});
                    return next;
                });
            }}
            onToggleField={(key: string, next: boolean) =>
                setSelectedFields((m: Record<string, boolean>) => ({ ...m, [key]: next }))
            }
            onApply={handleApply}
            isSaving={patchMutation.isPending}
            loading={(isExtractingMetadata && !parsedMeta) || reparseLoading}
        />
    );
}
