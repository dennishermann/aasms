"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ResearchQuestion } from "@/components/parameters/research-questions-editor";
import { Criterion } from "@/components/parameters/criteria-editor";
import { Facet } from "@/components/parameters/classification-schema-editor";
import { TabKey } from "@/components/parameters/tabs/tab-config";

export interface FormData {
  title: string;
  description: string;
  status: string;
  motivation: string;
  researchQuestions: ResearchQuestion[];
  inclusionCriteria: Criterion[];
  exclusionCriteria: Criterion[];
  facets: Facet[];
}

interface UseUnsavedChangesProps {
  currentData: FormData;
  initialData: FormData | null;
}

interface UseUnsavedChangesResult {
  /** Whether there are unsaved changes in any tab */
  hasUnsavedChanges: boolean;
  /** Per-tab change tracking */
  tabChanges: Record<TabKey, boolean>;
  /** Whether the unsaved changes dialog is shown */
  showUnsavedDialog: boolean;
  /** URL pending navigation */
  pendingNavigation: string | null;
  /** Handler for confirming navigation (discarding changes) */
  handleConfirmLeave: () => void;
  /** Handler for canceling navigation */
  handleCancelLeave: () => void;
}

/**
 * Custom hook for tracking unsaved changes and handling navigation warnings.
 * Handles both browser unload events and internal navigation attempts.
 */
export function useUnsavedChanges({
  currentData,
  initialData,
}: UseUnsavedChangesProps): UseUnsavedChangesResult {
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Check for unsaved changes per tab
  const tabChanges = useMemo(() => {
    if (!initialData) {
      return {
        overview: false,
        "research-questions": false,
        criteria: false,
        "search-protocol": false,
        classification: false,
      };
    }

    return {
      overview:
        currentData.title !== initialData.title ||
        currentData.description !== initialData.description ||
        currentData.status !== initialData.status ||
        currentData.motivation !== initialData.motivation,
      "research-questions":
        JSON.stringify(currentData.researchQuestions) !==
        JSON.stringify(initialData.researchQuestions),
      criteria:
        JSON.stringify(currentData.inclusionCriteria) !==
          JSON.stringify(initialData.inclusionCriteria) ||
        JSON.stringify(currentData.exclusionCriteria) !==
          JSON.stringify(initialData.exclusionCriteria),
      "search-protocol": false, // Search protocol is saved immediately via mutations, no local dirty state
      classification: JSON.stringify(currentData.facets) !== JSON.stringify(initialData.facets),
    };
  }, [currentData, initialData]);

  const hasUnsavedChanges = Object.values(tabChanges).some(Boolean);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept navigation attempts
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href && !link.href.includes("#")) {
        const currentOrigin = window.location.origin;
        const linkUrl = new URL(link.href, currentOrigin);

        if (linkUrl.origin === currentOrigin && linkUrl.pathname !== window.location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(link.href);
          setShowUnsavedDialog(true);
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [hasUnsavedChanges]);

  const handleConfirmLeave = useCallback(() => {
    setShowUnsavedDialog(false);

    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  }, [pendingNavigation]);

  const handleCancelLeave = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, []);

  return {
    hasUnsavedChanges,
    tabChanges,
    showUnsavedDialog,
    pendingNavigation,
    handleConfirmLeave,
    handleCancelLeave,
  };
}
