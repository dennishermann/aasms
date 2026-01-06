"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudyLayout } from "@/components/layout/study-layout";
import { FileText } from "lucide-react";

export default function ReviewPage() {
  const params = useParams();
  const studyId = params.id as string;

  return (
    <StudyLayout studyId={studyId} studyTitle="Source Review">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <CardTitle>Review Interface</CardTitle>
                <CardDescription>
                  Placeholder for Step 7 - Review & Classification Interface
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-primary pl-4 py-2">
              <h3 className="font-semibold mb-2">Planned Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>View source (PDF viewer or webpage content) side-by-side with AI analysis</li>
                <li>Edit AI recommendations and classifications</li>
                <li>Add manual notes</li>
                <li>Accept (include in study) or Reject (exclude from study)</li>
                <li>Track which fields were manually edited</li>
                <li>Navigate between sources for batch review</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                <strong>Implementation Note:</strong> This interface will be implemented in step 7
                after the AI analysis pipeline (step 5-6) is complete. It will provide a comprehensive
                review workflow for researchers to validate and adjust AI recommendations.
              </p>
            </div>

            <Button asChild>
              <Link href={`/studies/${studyId}`}>Back to Study</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </StudyLayout>
  );
}

