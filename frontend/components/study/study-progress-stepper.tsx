"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Circle, Database, Filter, Tags, BarChart3 } from "lucide-react";
import type { StudyProgress } from "@/lib/services/study/progress-service";

interface StudyProgressStepperProps {
  progress: StudyProgress;
}

const PHASE_LINKS = {
  collection: "sources",
  screening: "sources?filter=pending",
  classification: "sources?filter=included",
  analysis: "analysis",
} as const;

const PHASE_ICONS = {
  collection: Database,
  screening: Filter,
  classification: Tags,
  analysis: BarChart3,
} as const;

function getStatusColor(status: string): string {
  switch (status) {
    case "not_started":
      return "bg-gray-100 border-gray-300";
    case "in_progress":
      return "bg-blue-100 border-blue-400";
    case "complete":
      return "bg-green-100 border-green-400";
    default:
      return "bg-gray-100 border-gray-300";
  }
}

function getStatusTextColor(status: string): string {
  switch (status) {
    case "not_started":
      return "text-gray-600";
    case "in_progress":
      return "text-blue-600";
    case "complete":
      return "text-green-600";
    default:
      return "text-gray-600";
  }
}

function getArrowColor(previousStatus: string): string {
  return previousStatus === "complete" ? "text-green-400" : "text-gray-300";
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "not_started":
      return "bg-gray-200 text-gray-800";
    case "in_progress":
      return "bg-blue-200 text-blue-800";
    case "complete":
      return "bg-green-200 text-green-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

function PhaseNode({
  phase,
  phaseKey,
  index,
  total,
  studyId,
}: {
  phase: typeof StudyProgress.prototype.collection;
  phaseKey: keyof typeof PHASE_LINKS;
  index: number;
  total: number;
  studyId: string;
}) {
  const Icon = PHASE_ICONS[phaseKey];
  const href = `/studies/${studyId}/${PHASE_LINKS[phaseKey]}`;
  const isComplete = phase.status === "complete";
  const isInProgress = phase.status === "in_progress";

  return (
    <Link href={href} className="flex flex-col items-center flex-1 relative group">
      {/* Circle indicator */}
      <div
        className={`
          w-16 h-16 rounded-full border-2 flex items-center justify-center
          transition-all duration-200 cursor-pointer
          ${getStatusColor(phase.status)}
          group-hover:shadow-lg group-hover:scale-105
          relative
        `}
      >
        {isComplete ? (
          <Check className="w-8 h-8 text-green-600" />
        ) : isInProgress ? (
          <div className="relative w-8 h-8">
            <Circle className="w-8 h-8 text-blue-600 animate-spin" strokeWidth={3} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">{phase.percentage}%</span>
            </div>
          </div>
        ) : (
          <Icon className={`w-8 h-8 ${getStatusTextColor(phase.status)}`} />
        )}
      </div>

      {/* Phase label and description */}
      <div className="mt-3 text-center">
        <h3 className={`font-semibold text-sm ${getStatusTextColor(phase.status)}`}>
          {index + 1}. {phase.label}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{phase.description}</p>
      </div>

      {/* Metric detail */}
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-gray-700">{phase.detail}</p>
        {phase.total > 0 && (
          <p className="text-xs text-muted-foreground">{phase.percentage}% complete</p>
        )}
      </div>

      {/* Status badge */}
      <div
        className={`mt-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(phase.status)}`}
      >
        {phase.status === "not_started" && "Not Started"}
        {phase.status === "in_progress" && "In Progress"}
        {phase.status === "complete" && "Complete"}
      </div>

      {/* Arrow to next phase */}
      {index < total - 1 && (
        <div
          className={`
            hidden lg:flex absolute top-8 left-full w-12 items-center justify-center
            ${getArrowColor(phase.status)}
          `}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </Link>
  );
}

export function StudyProgressStepper({ progress }: StudyProgressStepperProps) {
  const params = useParams();
  const studyId = params.id as string;

  const phases = [
    { key: "collection" as const, data: progress.collection },
    { key: "screening" as const, data: progress.screening },
    { key: "classification" as const, data: progress.classification },
    { key: "analysis" as const, data: progress.analysis },
  ];

  return (
    <div className="w-full bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Study Progress</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track your systematic mapping study through 4 phases
        </p>
      </div>

      {/* Progress stepper - horizontal on lg, vertical on mobile */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-4 items-stretch lg:items-center justify-between">
        {phases.map(({ key, data }, index) => (
          <PhaseNode
            key={key}
            phase={data}
            phaseKey={key}
            index={index}
            total={phases.length}
            studyId={studyId}
          />
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-slate-700">Overall Progress</p>
          <p className="text-sm font-semibold text-slate-900">
            {Math.round(
              (phases.reduce((sum, p) => sum + p.data.percentage, 0) / phases.length) * 100,
            ) / 100}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, phases.reduce((sum, p) => sum + p.data.percentage, 0) / phases.length),
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
