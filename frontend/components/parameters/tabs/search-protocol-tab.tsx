"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchProtocolEditor } from "@/components/parameters/search-protocol-editor";
import { SearchStrategyEditor } from "@/components/parameters/search-strategy-editor";

interface SearchProtocolTabProps {
  studyId: string;
}

export function SearchProtocolTab({ studyId }: SearchProtocolTabProps) {
  return (
    <div className="space-y-6">
      <SearchStrategyEditor studyId={studyId} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Execution Log</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Record each search as you execute it. Document the database, query, date, and result count
            for reproducibility.
          </p>
        </CardHeader>
        <CardContent>
          <SearchProtocolEditor studyId={studyId} />
        </CardContent>
      </Card>
    </div>
  );
}
