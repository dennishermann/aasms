"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchProtocolEditor } from "@/components/parameters/search-protocol-editor";
import { SaveButton } from "@/components/parameters/tabs/save-button";

interface SearchProtocolTabProps {
  studyId: string;
}

export function SearchProtocolTab({ studyId }: SearchProtocolTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Search Protocol Documentation</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Document all searches performed across different databases and sources. This ensures
          reproducibility of your systematic mapping study.
        </p>
      </CardHeader>
      <CardContent>
        <SearchProtocolEditor studyId={studyId} />
      </CardContent>
    </Card>
  );
}
