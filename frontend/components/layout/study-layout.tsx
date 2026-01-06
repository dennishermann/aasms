"use client";

import { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Badge } from "@/components/ui/badge";

interface StudyLayoutProps {
  children: ReactNode;
  studyId?: string;
  studyTitle?: string;
  studyStatus?: string;
  showSidebar?: boolean;
  headerRight?: ReactNode;
}

export function StudyLayout({
  children,
  studyId,
  studyTitle,
  studyStatus,
  showSidebar = true,
  headerRight,
}: StudyLayoutProps) {
  const rightContent = studyTitle ? (
    <div className="flex flex-col items-end gap-1">
      <h1 className="text-lg font-semibold truncate max-w-xl">{studyTitle}</h1>
      {studyStatus && (
        <Badge variant={studyStatus === "ACTIVE" ? "default" : "outline"} className="text-xs">
          {studyStatus}
        </Badge>
      )}
    </div>
  ) : headerRight;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header rightContent={rightContent} />

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && studyId && <Sidebar studyId={studyId} />}

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

