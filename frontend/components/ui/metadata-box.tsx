import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { renderMetadataValue } from "../../lib/metadata-utils";

interface MetadataBoxProps {
    label: string;
    value: any;
    fieldKey?: string; // key of the field, used for specific rendering logic
    isActive?: boolean;
    onSelect?: () => void;
    variant?: "default" | "ai" | "match";
    icon?: any;
    className?: string;
}

export const MetadataBox = ({
    label,
    value,
    fieldKey,
    isActive,
    onSelect,
    variant = "default",
    icon: Icon,
    className = "",
}: MetadataBoxProps) => {
    // Base styles
    const baseStyles = "relative p-4 rounded-md border transition-all duration-200 text-sm";

    // Variant styles
    const variants = {
        default: isActive
            ? "bg-background border-primary/20 shadow-sm"
            : "bg-muted/10 border-transparent opacity-60 grayscale-[0.5]",
        ai: isActive
            ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900 shadow-sm"
            : "bg-muted/10 border-transparent opacity-60 grayscale-[0.5]",
        match: "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30",
    };

    const variantStyle = variants[variant];

    // Click handler adjustments
    const isClickable = !!onSelect && variant !== "match";

    return (
        <div
            className={`${baseStyles} ${variantStyle} ${isClickable ? "cursor-pointer hover:border-primary/30" : ""} ${className}`}
            onClick={isClickable ? onSelect : undefined}
        >
            <div className="flex items-center gap-2 mb-2">
                <p className={`text-[10px] uppercase font-bold tracking-wider ${variant === "ai" ? "text-blue-600 dark:text-blue-400" :
                    variant === "match" ? "text-green-600 dark:text-green-400" :
                        "text-muted-foreground"
                    }`}>
                    {label}
                </p>
                {Icon && <Icon className="w-3 h-3 text-current opacity-70" />}
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed break-words">
                {renderMetadataValue(value, fieldKey)}
            </div>
        </div>
    );
};
