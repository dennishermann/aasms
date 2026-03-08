"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportSvgAsPng } from "./svg-export";

export interface PrismaFlowDiagramProps {
  totalRecordsIdentified: number;
  duplicatesRemoved: number;
  totalSources: number;
  includedSources: number;
  excludedSources: number;
  classifiedSources: number;
}

// Layout constants
const BOX_W = 280;
const BOX_H = 52;
const SIDE_BOX_W = 200;
const SIDE_BOX_H = 52;
const GAP_Y = 28;
const BRANCH_GAP = 40;

// Computed positions
const CENTER_X = 320;
const SIDE_X = CENTER_X + BOX_W / 2 + BRANCH_GAP + SIDE_BOX_W / 2;
const VIEW_W = SIDE_X + SIDE_BOX_W / 2 + 20;

// Stage label config
const STAGE_COLORS = {
  identification: "#3b82f6",
  screening: "#f59e0b",
  classification: "#8b5cf6",
  included: "#22c55e",
} as const;

interface BoxConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export function PrismaFlowDiagram({
  totalRecordsIdentified,
  duplicatesRemoved,
  totalSources,
  includedSources,
  excludedSources,
  classifiedSources,
}: PrismaFlowDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const screened = includedSources + excludedSources;
  const awaitingClassification = includedSources - classifiedSources;

  const handleExport = useCallback(() => {
    if (svgRef.current) {
      exportSvgAsPng(svgRef.current, "prisma-flow-diagram.png");
    }
  }, []);

  // Calculate box positions top-to-bottom
  let y = 40;

  const box1: BoxConfig = {
    x: CENTER_X,
    y,
    w: BOX_W,
    h: BOX_H,
    lines: [
      "Records identified",
      `(n = ${totalRecordsIdentified})`,
    ],
  };

  y += BOX_H + GAP_Y;
  const box2: BoxConfig = {
    x: CENTER_X,
    y,
    w: BOX_W,
    h: BOX_H,
    lines: [
      "After duplicates removed",
      `(n = ${totalSources})`,
    ],
  };

  y += BOX_H + GAP_Y;
  const box3: BoxConfig = {
    x: CENTER_X,
    y,
    w: BOX_W,
    h: BOX_H,
    lines: [
      "Records screened",
      `(n = ${screened})`,
    ],
  };
  const box3side: BoxConfig = {
    x: SIDE_X,
    y: box3.y,
    w: SIDE_BOX_W,
    h: SIDE_BOX_H,
    lines: [
      "Records excluded",
      `(n = ${excludedSources})`,
    ],
  };

  y += BOX_H + GAP_Y;
  const box4: BoxConfig = {
    x: CENTER_X,
    y,
    w: BOX_W,
    h: BOX_H,
    lines: [
      "Records included",
      `(n = ${includedSources})`,
    ],
  };
  const box4side: BoxConfig = {
    x: SIDE_X,
    y: box4.y,
    w: SIDE_BOX_W,
    h: SIDE_BOX_H,
    lines: [
      "Awaiting classification",
      `(n = ${awaitingClassification})`,
    ],
  };

  y += BOX_H + GAP_Y;
  const box5: BoxConfig = {
    x: CENTER_X,
    y,
    w: BOX_W,
    h: BOX_H,
    lines: [
      "Studies with classifications",
      `(n = ${classifiedSources})`,
    ],
  };

  const viewH = y + BOX_H + 20;

  // Stage label positions (left side)
  const stageLabels = [
    { label: "Identification", color: STAGE_COLORS.identification, y1: box1.y - 6, y2: box2.y + BOX_H + 6 },
    { label: "Screening", color: STAGE_COLORS.screening, y1: box3.y - 6, y2: box3.y + BOX_H + 6 },
    { label: "Classification", color: STAGE_COLORS.classification, y1: box4.y - 6, y2: box4.y + BOX_H + 6 },
    { label: "Included", color: STAGE_COLORS.included, y1: box5.y - 6, y2: box5.y + BOX_H + 6 },
  ];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-0 right-0 z-10"
        onClick={handleExport}
      >
        <Download className="h-4 w-4 mr-1" />
        PNG
      </Button>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        style={{ maxHeight: 520 }}
        role="img"
        aria-label="PRISMA flow diagram showing source screening stages"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Stage labels on the left */}
        {stageLabels.map((s) => (
          <g key={s.label}>
            <rect
              x={16}
              y={s.y1}
              width={4}
              height={s.y2 - s.y1}
              rx={2}
              fill={s.color}
            />
            <text
              x={26}
              y={(s.y1 + s.y2) / 2}
              dominantBaseline="central"
              textAnchor="start"
              fontSize={11}
              fontWeight={600}
              fill={s.color}
            >
              {s.label}
            </text>
          </g>
        ))}

        {/* Vertical arrows between center boxes */}
        <Arrow from={box1} to={box2} />
        <Arrow from={box2} to={box3} />
        <Arrow from={box3} to={box4} />
        <Arrow from={box4} to={box5} />

        {/* Horizontal arrows to side boxes */}
        <HArrow from={box3} to={box3side} />
        <HArrow from={box4} to={box4side} />

        {/* Duplicate removal annotation */}
        {duplicatesRemoved > 0 && (
          <text
            x={CENTER_X + BOX_W / 2 + 8}
            y={(box1.y + BOX_H + box2.y) / 2}
            dominantBaseline="central"
            textAnchor="start"
            fontSize={10}
            fill="#94a3b8"
          >
            {duplicatesRemoved} duplicates removed
          </text>
        )}

        {/* Boxes */}
        <FlowBox config={box1} />
        <FlowBox config={box2} />
        <FlowBox config={box3} />
        <FlowBox config={box3side} variant="exclusion" />
        <FlowBox config={box4} />
        <FlowBox config={box4side} variant="muted" />
        <FlowBox config={box5} variant="success" />
      </svg>
    </div>
  );
}

// ---- Sub-components ----

function FlowBox({
  config,
  variant = "default",
}: {
  config: BoxConfig;
  variant?: "default" | "exclusion" | "muted" | "success";
}) {
  const fills: Record<string, { bg: string; border: string; text: string }> = {
    default: { bg: "#f8fafc", border: "#cbd5e1", text: "#1e293b" },
    exclusion: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
    muted: { bg: "#fefce8", border: "#fde68a", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
  };
  const { bg, border, text } = fills[variant];

  return (
    <g>
      <rect
        x={config.x - config.w / 2}
        y={config.y}
        width={config.w}
        height={config.h}
        rx={6}
        fill={bg}
        stroke={border}
        strokeWidth={1.5}
      />
      {config.lines.map((line, i) => (
        <text
          key={i}
          x={config.x}
          y={config.y + config.h / 2 + (i - (config.lines.length - 1) / 2) * 16}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={i === 0 ? 600 : 400}
          fill={text}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function Arrow({ from, to }: { from: BoxConfig; to: BoxConfig }) {
  const x = from.x;
  const y1 = from.y + from.h;
  const y2 = to.y;
  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke="#94a3b8"
      strokeWidth={1.5}
      markerEnd="url(#arrowhead)"
    />
  );
}

function HArrow({ from, to }: { from: BoxConfig; to: BoxConfig }) {
  const x1 = from.x + from.w / 2;
  const x2 = to.x - to.w / 2;
  const y = from.y + from.h / 2;
  return (
    <line
      x1={x1}
      y1={y}
      x2={x2}
      y2={y}
      stroke="#94a3b8"
      strokeWidth={1.5}
      markerEnd="url(#arrowhead)"
    />
  );
}
