"use client";

import { useRouter } from "next/navigation";
import { StudyForm } from "@/components/study/study-form";
import { Header } from "@/components/layout/header";

export default function NewStudyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Create New Study</h1>
          <StudyForm
            onSuccess={(study) => {
              router.push(`/studies/${study.id}`);
            }}
          />
        </div>
      </main>
    </div>
  );
}
