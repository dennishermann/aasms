"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { Plus } from "lucide-react";

interface Study {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  _count: {
    sources: number;
  };
}

async function fetchStudies(): Promise<Study[]> {
  const response = await fetch("/api/studies");
  if (!response.ok) throw new Error("Failed to fetch studies");
  const data = await response.json();
  return data.data;
}

export default function StudiesPage() {
  const {
    data: studies,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["studies"],
    queryFn: fetchStudies,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Studies</h1>
          <Button asChild>
            <Link href="/studies/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Study
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load studies. Please try again.</p>
          </div>
        )}

        {studies && studies.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No studies yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first systematic mapping study to get started.
            </p>
            <Button asChild>
              <Link href="/studies/new">Create Study</Link>
            </Button>
          </div>
        )}

        {studies && studies.length > 0 && (
          <div className="space-y-4">
            {studies.map((study) => (
              <Link key={study.id} href={`/studies/${study.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle>{study.title}</CardTitle>
                        {study.description && (
                          <CardDescription className="line-clamp-2">
                            {study.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge
                        variant={
                          study.status === "ACTIVE"
                            ? "default"
                            : study.status === "COMPLETED"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {study.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{study._count.sources} sources</span>
                      <span>•</span>
                      <span>Created {new Date(study.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
