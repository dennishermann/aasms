"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Image, FileSpreadsheet } from "lucide-react";
import { exportChartAsPNG } from "../charts/chart-export";

interface ExportButtonProps {
  // For CSV export
  onExportCSV?: () => void;
  isExportingCSV?: boolean;
  // For PNG export (chart)
  chartInstance?: any;
  chartTitle?: string;
  // Display options
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  disabled?: boolean;
}

export function ExportButton({
  onExportCSV,
  isExportingCSV = false,
  chartInstance,
  chartTitle = "chart",
  variant = "outline",
  size = "sm",
  showLabel = true,
  disabled = false,
}: ExportButtonProps) {
  const hasCSV = !!onExportCSV;
  const hasPNG = !!chartInstance;
  const hasBothOptions = hasCSV && hasPNG;

  const handlePNGExport = useCallback(() => {
    if (chartInstance) {
      exportChartAsPNG(chartInstance, chartTitle);
    }
  }, [chartInstance, chartTitle]);

  // If only one option, show simple button
  if (!hasBothOptions) {
    if (hasCSV) {
      return (
        <Button
          variant={variant}
          size={size}
          onClick={onExportCSV}
          disabled={disabled || isExportingCSV}
        >
          <Download className="h-4 w-4" />
          {showLabel && (
            <span className="ml-2">{isExportingCSV ? "Exporting..." : "Export CSV"}</span>
          )}
        </Button>
      );
    }
    if (hasPNG) {
      return (
        <Button variant={variant} size={size} onClick={handlePNGExport} disabled={disabled}>
          <Image className="h-4 w-4" />
          {showLabel && <span className="ml-2">Export PNG</span>}
        </Button>
      );
    }
    return null;
  }

  // Multiple options - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || isExportingCSV}>
          <Download className="h-4 w-4" />
          {showLabel && <span className="ml-2">{isExportingCSV ? "Exporting..." : "Export"}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePNGExport}>
          <Image className="h-4 w-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCSV} disabled={isExportingCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
