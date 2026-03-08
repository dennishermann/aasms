export interface PhaseProgress {
  label: string;
  description: string;
  current: number;
  total: number;
  percentage: number;
  status: "not_started" | "in_progress" | "complete";
  detail: string; // e.g., "47 of 312 screened"
}

export interface StudyProgress {
  collection: PhaseProgress;
  screening: PhaseProgress;
  classification: PhaseProgress;
  analysis: PhaseProgress;
}

export function computeStudyProgress(data: {
  totalSources: number;
  sourcesWithPdf: number;
  sourcesNeedingPdf: number;
  pendingSources: number;
  analyzedSources: number; // screened (included + excluded)
  includedSources: number;
  excludedSources: number;
  classifiedSources: number; // included sources that have classifications
}): StudyProgress {
  // Collection phase: total sources with content (PDF or full text)
  const collectionTotal = data.totalSources;
  const collectionCurrent = data.totalSources - data.sourcesNeedingPdf;
  const collectionPercentage =
    collectionTotal > 0 ? Math.round((collectionCurrent / collectionTotal) * 100) : 0;
  const collectionStatus: "not_started" | "in_progress" | "complete" =
    collectionTotal === 0
      ? "not_started"
      : collectionCurrent === collectionTotal
        ? "complete"
        : "in_progress";

  // Screening phase: analyzed sources (included + excluded)
  const screeningTotal = data.totalSources;
  const screeningCurrent = data.analyzedSources;
  const screeningPercentage =
    screeningTotal > 0 ? Math.round((screeningCurrent / screeningTotal) * 100) : 0;
  const screeningStatus: "not_started" | "in_progress" | "complete" =
    screeningCurrent === 0
      ? "not_started"
      : screeningCurrent === screeningTotal
        ? "complete"
        : "in_progress";

  // Classification phase: classified sources out of included
  const classificationTotal = data.includedSources;
  const classificationCurrent = data.classifiedSources;
  const classificationPercentage =
    classificationTotal > 0 ? Math.round((classificationCurrent / classificationTotal) * 100) : 0;
  const classificationStatus: "not_started" | "in_progress" | "complete" =
    classificationCurrent === 0
      ? "not_started"
      : classificationCurrent === classificationTotal
        ? "complete"
        : "in_progress";

  // Analysis phase: based on whether classification is complete and sources exist
  const analysisTotal = data.includedSources;
  const analysisCurrent = data.classifiedSources;
  const analysisPercentage =
    analysisTotal > 0 ? Math.round((analysisCurrent / analysisTotal) * 100) : 0;
  const analysisStatus: "not_started" | "in_progress" | "complete" =
    analysisTotal === 0
      ? "not_started"
      : analysisCurrent === analysisTotal
        ? "complete"
        : "in_progress";

  return {
    collection: {
      label: "Collection",
      description: "Gather sources from databases",
      current: collectionCurrent,
      total: collectionTotal,
      percentage: collectionPercentage,
      status: collectionStatus,
      detail: `${collectionCurrent} of ${collectionTotal} with content`,
    },
    screening: {
      label: "Screening",
      description: "Include/exclude based on criteria",
      current: screeningCurrent,
      total: screeningTotal,
      percentage: screeningPercentage,
      status: screeningStatus,
      detail: `${screeningCurrent} of ${screeningTotal} screened`,
    },
    classification: {
      label: "Classification",
      description: "Assign facet categories",
      current: classificationCurrent,
      total: classificationTotal,
      percentage: classificationPercentage,
      status: classificationStatus,
      detail:
        classificationTotal > 0
          ? `${classificationCurrent} of ${classificationTotal} classified`
          : "No included sources yet",
    },
    analysis: {
      label: "Analysis",
      description: "Explore and visualize results",
      current: analysisCurrent,
      total: analysisTotal,
      percentage: analysisPercentage,
      status: analysisStatus,
      detail:
        analysisTotal > 0
          ? `${analysisCurrent} of ${analysisTotal} classified`
          : "No included sources yet",
    },
  };
}
