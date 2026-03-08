"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";

export interface RQSummaryItem {
  rq_id: string;
  question: string;
  summary: string;
  key_findings: string[];
  evidence_quality: "strong" | "moderate" | "limited";
  gaps: string[];
}

export interface RQSummaryData {
  summaries: RQSummaryItem[];
}

interface RqAnswersTabProps {
  studyId: string;
  data: RQSummaryData | undefined;
  isGenerating: boolean;
  onGenerate: () => void;
  hasClassifiedSources: boolean;
}

const QUALITY_CONFIG = {
  strong: {
    label: "Strong evidence",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 hover:bg-green-100",
  },
  moderate: {
    label: "Moderate evidence",
    variant: "secondary" as const,
    icon: MinusCircle,
    className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  },
  limited: {
    label: "Limited evidence",
    variant: "outline" as const,
    icon: AlertCircle,
    className: "bg-red-50 text-red-600 hover:bg-red-50",
  },
};

export function RqAnswersTab({
  studyId,
  data,
  isGenerating,
  onGenerate,
  hasClassifiedSources,
}: RqAnswersTabProps) {
  if (!hasClassifiedSources) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No classified sources yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            RQ summaries are generated from your classified and included sources. Complete the
            screening and classification steps first.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Generating summaries with AI...
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Generate RQ Summaries</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Use AI to synthesize answers to your research questions based on the classification data
            and source evidence from your study.
          </p>
          <Button onClick={onGenerate} disabled={isGenerating}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Summaries
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.summaries.length} research question{data.summaries.length !== 1 ? "s" : ""}{" "}
          summarized
        </p>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={isGenerating}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate All
        </Button>
      </div>

      {data.summaries.map((item, index) => {
        const qualityConfig = QUALITY_CONFIG[item.evidence_quality] || QUALITY_CONFIG.limited;
        const QualityIcon = qualityConfig.icon;

        return (
          <Card key={item.rq_id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium">
                  <span className="text-muted-foreground mr-2">RQ{index + 1}.</span>
                  {item.question}
                </CardTitle>
                <Badge className={qualityConfig.className}>
                  <QualityIcon className="h-3 w-3 mr-1" />
                  {qualityConfig.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <p className="text-sm leading-relaxed">{item.summary}</p>

              {/* Key Findings */}
              {item.key_findings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Findings</h4>
                  <ul className="space-y-1">
                    {item.key_findings.map((finding, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Research Gaps */}
              {item.gaps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Research Gaps</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.gaps.map((gap, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-normal">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
