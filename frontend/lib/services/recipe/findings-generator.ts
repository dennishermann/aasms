import { RecipeType } from "@prisma/client";
import type {
  FrequencyResult,
  CrossTabResult,
  TimeSeriesResult,
  GapAnalysis,
} from "@/types/analysis";

/**
 * Generate deterministic key findings from analysis results.
 *
 * These are simple, factual observations that can be reproduced
 * from the data without any LLM involvement.
 */
export function generateKeyFindings(recipeType: RecipeType, resultData: any): string[] {
  switch (recipeType) {
    case RecipeType.DISTRIBUTION:
      return generateDistributionFindings(resultData as FrequencyResult);
    case RecipeType.MAP:
      return generateMapFindings(resultData as CrossTabResult);
    case RecipeType.TREND:
      return generateTrendFindings(resultData as TimeSeriesResult);
    case RecipeType.GAP:
      return generateGapFindings(resultData as GapAnalysis);
    default:
      return [];
  }
}

/**
 * Generate findings for distribution (frequency) analysis.
 */
function generateDistributionFindings(data: FrequencyResult): string[] {
  const findings: string[] = [];

  if (!data || !data.items || data.items.length === 0) {
    findings.push("No data available for analysis.");
    return findings;
  }

  const { items, total } = data;

  // Sort by count descending for analysis
  const sortedItems = [...items].sort((a, b) => b.count - a.count);

  // Finding 1: Most common category
  if (sortedItems.length > 0 && sortedItems[0].count > 0) {
    const top = sortedItems[0];
    findings.push(`Most common: "${top.label}" with ${top.count} sources (${top.percentage}%)`);
  }

  // Finding 2: Empty categories
  const emptyCategories = items.filter((i) => i.count === 0);
  if (emptyCategories.length > 0) {
    if (emptyCategories.length === 1) {
      findings.push(`1 category has no sources: "${emptyCategories[0].label}"`);
    } else if (emptyCategories.length <= 3) {
      findings.push(
        `${emptyCategories.length} categories have no sources: ${emptyCategories
          .map((c) => `"${c.label}"`)
          .join(", ")}`,
      );
    } else {
      findings.push(`${emptyCategories.length} categories have no sources`);
    }
  }

  // Finding 3: Concentration (top 3 categories)
  if (sortedItems.length >= 3 && total > 0) {
    const topThree = sortedItems.slice(0, 3);
    const topThreeTotal = topThree.reduce((sum, i) => sum + i.count, 0);
    const concentration = Math.round((topThreeTotal / total) * 100);

    if (concentration >= 50) {
      findings.push(`Top 3 categories account for ${concentration}% of sources`);
    }
  }

  // Finding 4: Least common (non-zero) category
  const nonZeroItems = sortedItems.filter((i) => i.count > 0);
  if (nonZeroItems.length > 1) {
    const least = nonZeroItems[nonZeroItems.length - 1];
    if (least.count <= 3) {
      findings.push(
        `Least common: "${least.label}" with only ${least.count} source${
          least.count === 1 ? "" : "s"
        }`,
      );
    }
  }

  // Finding 5: Distribution balance
  if (nonZeroItems.length >= 2 && total > 0) {
    const max = nonZeroItems[0].count;
    const min = nonZeroItems[nonZeroItems.length - 1].count;
    const ratio = max / min;

    if (ratio > 10) {
      findings.push(
        `Highly uneven distribution: largest category is ${Math.round(
          ratio,
        )}x larger than smallest`,
      );
    }
  }

  return findings;
}

/**
 * Generate findings for map (cross-tabulation) analysis.
 */
function generateMapFindings(data: CrossTabResult): string[] {
  const findings: string[] = [];

  if (!data || !data.cells || data.cells.length === 0) {
    findings.push("No data available for analysis.");
    return findings;
  }

  const { cells, rowLabels, colLabels, grandTotal } = data;

  // Finding 1: Dominant cell
  const sortedCells = [...cells].sort((a, b) => b.count - a.count);
  const topCell = sortedCells[0];

  if (topCell && topCell.count > 0) {
    const rowLabel = rowLabels.find((r) => r.id === topCell.rowId)?.label ?? topCell.rowId;
    const colLabel = colLabels.find((c) => c.id === topCell.colId)?.label ?? topCell.colId;

    findings.push(
      `Most common combination: "${rowLabel}" × "${colLabel}" with ${topCell.count} sources (${topCell.percentage}%)`,
    );
  }

  // Finding 2: Empty cells
  const emptyCells = cells.filter((c) => c.count === 0);
  const totalCells = rowLabels.length * colLabels.length;
  const emptyPercent = Math.round((emptyCells.length / totalCells) * 100);

  if (emptyCells.length > 0) {
    findings.push(
      `${emptyCells.length} of ${totalCells} cells are empty (${emptyPercent}% sparsity)`,
    );
  }

  // Finding 3: Row with most sources
  const rowTotals = new Map<string, number>();
  for (const cell of cells) {
    rowTotals.set(cell.rowId, (rowTotals.get(cell.rowId) ?? 0) + cell.count);
  }
  const topRow = [...rowTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topRow && topRow[1] > 0) {
    const rowLabel = rowLabels.find((r) => r.id === topRow[0])?.label ?? topRow[0];
    const rowPercent = Math.round((topRow[1] / grandTotal) * 100);
    findings.push(`Row "${rowLabel}" has the most sources: ${topRow[1]} (${rowPercent}%)`);
  }

  // Finding 4: Column with most sources
  const colTotals = new Map<string, number>();
  for (const cell of cells) {
    colTotals.set(cell.colId, (colTotals.get(cell.colId) ?? 0) + cell.count);
  }
  const topCol = [...colTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCol && topCol[1] > 0) {
    const colLabel = colLabels.find((c) => c.id === topCol[0])?.label ?? topCol[0];
    const colPercent = Math.round((topCol[1] / grandTotal) * 100);
    findings.push(`Column "${colLabel}" has the most sources: ${topCol[1]} (${colPercent}%)`);
  }

  // Finding 5: Total sources
  findings.push(`Total sources in map: ${grandTotal}`);

  return findings;
}

/**
 * Generate findings for trend (time series) analysis.
 */
function generateTrendFindings(data: TimeSeriesResult): string[] {
  const findings: string[] = [];

  if (!data || !data.years || data.years.length === 0) {
    findings.push("No data available for analysis.");
    return findings;
  }

  const { years, series } = data;

  // Calculate total per year
  const yearTotals = years.map((year, idx) => ({
    year,
    total: series.reduce((sum, s) => sum + (s.data[idx] ?? 0), 0),
  }));

  // Finding 1: Peak year
  const peakYear = yearTotals.reduce((max, y) => (y.total > max.total ? y : max));
  if (peakYear.total > 0) {
    findings.push(`Peak year: ${peakYear.year} with ${peakYear.total} publications`);
  }

  // Finding 2: Year range
  const nonZeroYears = yearTotals.filter((y) => y.total > 0);
  if (nonZeroYears.length > 0) {
    const firstYear = nonZeroYears[0].year;
    const lastYear = nonZeroYears[nonZeroYears.length - 1].year;
    findings.push(`Publication span: ${firstYear} to ${lastYear}`);
  }

  // Finding 3: Recent trend (last 3 years)
  if (yearTotals.length >= 3) {
    const recent = yearTotals.slice(-3);
    const recentTotal = recent.reduce((sum, y) => sum + y.total, 0);
    const totalPublications = yearTotals.reduce((sum, y) => sum + y.total, 0);
    const recentPercent = Math.round((recentTotal / totalPublications) * 100);

    if (recentPercent >= 40) {
      findings.push(`Recent activity: ${recentPercent}% of publications are from the last 3 years`);
    }
  }

  // Finding 4: Growth trend (compare first half vs second half)
  if (nonZeroYears.length >= 4) {
    const midpoint = Math.floor(nonZeroYears.length / 2);
    const firstHalf = nonZeroYears.slice(0, midpoint);
    const secondHalf = nonZeroYears.slice(midpoint);

    const firstHalfTotal = firstHalf.reduce((sum, y) => sum + y.total, 0);
    const secondHalfTotal = secondHalf.reduce((sum, y) => sum + y.total, 0);

    if (secondHalfTotal > firstHalfTotal * 1.5) {
      findings.push("Growth trend: significant increase in publications over time");
    } else if (firstHalfTotal > secondHalfTotal * 1.5) {
      findings.push("Decline trend: fewer publications in recent years");
    }
  }

  // Finding 5: Dominant series (if grouped)
  if (series.length > 1) {
    const seriesTotals = series.map((s) => ({
      label: s.label,
      total: s.data.reduce((sum, v) => sum + v, 0),
    }));
    const topSeries = seriesTotals.reduce((max, s) => (s.total > max.total ? s : max));
    const totalAll = seriesTotals.reduce((sum, s) => sum + s.total, 0);
    const topPercent = Math.round((topSeries.total / totalAll) * 100);

    if (topPercent >= 30) {
      findings.push(
        `Dominant category: "${topSeries.label}" accounts for ${topPercent}% of publications`,
      );
    }
  }

  return findings;
}

/**
 * Generate findings for gap analysis.
 */
function generateGapFindings(data: GapAnalysis): string[] {
  const findings: string[] = [];

  if (!data) {
    findings.push("No data available for analysis.");
    return findings;
  }

  const { threshold, singleDimensionGaps, crossTabGaps } = data;

  // Finding 1: Summary of single-dimension gaps
  let totalEmptyCategories = 0;
  let totalLowCoverageCategories = 0;

  for (const facetGap of singleDimensionGaps) {
    totalEmptyCategories += facetGap.empty.length;
    totalLowCoverageCategories += facetGap.gaps.length;
  }

  if (totalEmptyCategories > 0) {
    findings.push(`${totalEmptyCategories} categories have no sources (across all facets)`);
  }

  if (totalLowCoverageCategories > 0) {
    findings.push(`${totalLowCoverageCategories} categories have ${threshold} or fewer sources`);
  }

  // Finding 2: Facets with most gaps
  const facetsWithGaps = singleDimensionGaps.filter((f) => f.gaps.length > 0 || f.empty.length > 0);
  if (facetsWithGaps.length > 0) {
    const worstFacet = facetsWithGaps.reduce((worst, f) => {
      const gapCount = f.gaps.length + f.empty.length;
      const worstCount = worst.gaps.length + worst.empty.length;
      return gapCount > worstCount ? f : worst;
    });

    const gapCount = worstFacet.gaps.length + worstFacet.empty.length;
    findings.push(
      `"${worstFacet.facetName}" has the most gaps: ${gapCount} categories with low or no coverage`,
    );
  }

  // Finding 3: Cross-tab gaps summary
  if (crossTabGaps.length > 0) {
    const totalCrossTabGaps = crossTabGaps.reduce((sum, ctg) => sum + ctg.gaps.length, 0);
    findings.push(`${totalCrossTabGaps} cross-tabulation combinations have low coverage`);
  }

  // Finding 4: Specific empty categories
  for (const facetGap of singleDimensionGaps) {
    if (facetGap.empty.length > 0 && facetGap.empty.length <= 3) {
      const emptyNames = facetGap.empty.map((e) => `"${e.categoryName}"`).join(", ");
      findings.push(`Empty categories in "${facetGap.facetName}": ${emptyNames}`);
    }
  }

  // Finding 5: No gaps detected
  if (totalEmptyCategories === 0 && totalLowCoverageCategories === 0) {
    findings.push(`Good coverage: all categories have more than ${threshold} sources`);
  }

  return findings;
}
