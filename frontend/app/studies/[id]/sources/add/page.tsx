"use client";

import { useParams, useRouter } from "next/navigation";
import { AddSourceForm } from "@/components/source/forms/add-source-form";
import { StudyLayout } from "@/components/layout/study-layout";

export default function AddSourcePage() {
  const params = useParams();
  const router = useRouter();
  const studyId = params.id as string;

  return (
    <StudyLayout studyId={studyId} studyTitle="Add Source">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <AddSourceForm
            studyId={studyId}
            onSuccess={() => {
              router.push(`/studies/${studyId}/sources`);
            }}
          />
        </div>
      </div>
    </StudyLayout>
  );
}
