"use client";

import { FileText, HelpCircle, Filter, Tags, FlaskConical } from "lucide-react";

// Tab configuration with colors and labels
export const TAB_CONFIG = {
    overview: {
        icon: FileText,
        label: "Overview",
        color: "bg-blue-500",
        lightColor: "bg-blue-100 text-blue-700",
    },
    "research-questions": {
        icon: HelpCircle,
        label: "Research Questions",
        color: "bg-purple-500",
        lightColor: "bg-purple-100 text-purple-700",
    },
    criteria: {
        icon: Filter,
        label: "Selection Criteria",
        color: "bg-green-500",
        lightColor: "bg-green-100 text-green-700",
    },
    classification: {
        icon: Tags,
        label: "Classification Schema",
        color: "bg-orange-500",
        lightColor: "bg-orange-100 text-orange-700",
    },
    recipes: {
        icon: FlaskConical,
        label: "Synthesis Recipes",
        color: "bg-indigo-500",
        lightColor: "bg-indigo-100 text-indigo-700",
    },
} as const;

export type TabKey = keyof typeof TAB_CONFIG;

// Get tab config helper
export function getTabConfig(tab: TabKey) {
    return TAB_CONFIG[tab];
}
