import { ReactNode } from "react";

export type Metadata = Record<string, any>;

export const cleanAbstract = (val: string): string => {
    return val.replace(/^Abstract:?\s*/i, "").trim();
};

export const formatDate = (val: string): string => {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }
    return val;
};

export const renderMetadataValue = (val: any, key?: string): ReactNode => {
    if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
    if (!val) return "—";

    if (typeof val === "string") {
        if (key === "abstract") {
            const cleaned = cleanAbstract(val);
            return cleaned || "—";
        }
        if (key === "publicationDate") {
            return formatDate(val);
        }
    }

    return val;
};

export const isFuzzyMatch = (originalMeta: Metadata, parsedMeta: Metadata | null, key: string): boolean => {
    if (!parsedMeta) return false;

    // Helper to normalize string for comparison
    const normalize = (str: string | any) => {
        if (typeof str !== 'string') return String(str || "");

        // Special case for abstract: remove "Abstract" prefix before normalizing
        let val = str;
        if (key === 'abstract') {
            val = cleanAbstract(str);
        } else if (key === 'publicationDate') {
            val = formatDate(str);
        }

        return val
            .toLowerCase()
            .replace(/['`’]/g, "'") // Normalize quotes
            .replace(/\s+/g, ' ')   // Normalize whitespace
            .trim();
    };

    const a = originalMeta[key];
    const b = parsedMeta[key];

    if (Array.isArray(a) || Array.isArray(b)) {
        const arrA = Array.isArray(a) ? a : [a].filter(Boolean);
        const arrB = Array.isArray(b) ? b : [b].filter(Boolean);

        return normalize(arrA.join(", ")) === normalize(arrB.join(", "));
    }

    return normalize(a) === normalize(b);
};

export const isDifferent = (originalMeta: Metadata, parsedMeta: Metadata | null, key: string): boolean => {
    return !isFuzzyMatch(originalMeta, parsedMeta, key);
};
