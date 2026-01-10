/**
 * Export a chart as PNG image
 */
export function exportChartAsPNG(
  chart: any | null,
  filename: string = "chart"
): void {
  if (!chart) {
    console.error("Chart instance is not available");
    return;
  }

  try {
    // Get chart as data URL
    const dataURL = chart.getDataURL({
      type: "png",
      pixelRatio: 2, // Higher resolution
      backgroundColor: "#fff",
    });

    // Create download link
    const link = document.createElement("a");
    link.download = `${filename}-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Failed to export chart:", error);
  }
}

/**
 * Export a chart as SVG
 */
export function exportChartAsSVG(
  chart: any | null,
  filename: string = "chart"
): void {
  if (!chart) {
    console.error("Chart instance is not available");
    return;
  }

  try {
    // Get chart as SVG data URL
    const svgDataURL = chart.getDataURL({
      type: "svg",
      backgroundColor: "#fff",
    });

    // Convert data URL to blob
    const svgData = atob(svgDataURL.split(",")[1]);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    // Create download link
    const link = document.createElement("a");
    link.download = `${filename}-${Date.now()}.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export chart as SVG:", error);
  }
}
