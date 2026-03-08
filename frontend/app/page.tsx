import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <section className="text-center space-y-4">
            <h2 className="text-4xl font-bold tracking-tight">
              AI-Powered Systematic Mapping Studies
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Streamline your research with intelligent source analysis, automated classification,
              and comprehensive study management.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/studies">View Studies</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/studies/new">Create New Study</Link>
              </Button>
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-6 pt-8">
            <Card>
              <CardHeader>
                <CardTitle>Study Management</CardTitle>
                <CardDescription>
                  Create and manage systematic mapping studies with research questions,
                  inclusion/exclusion criteria, and classification schemas.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source Analysis</CardTitle>
                <CardDescription>
                  Upload PDFs or add grey literature URLs. AI automatically evaluates against your
                  criteria and classifies sources.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Review Interface</CardTitle>
                <CardDescription>
                  Review AI recommendations side-by-side with source content. Accept, reject, or
                  manually adjust classifications.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reports & Export</CardTitle>
                <CardDescription>
                  Generate visualizations and export results to CSV/Excel for further analysis and
                  publication.
                </CardDescription>
              </CardHeader>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          SMS Assistant - Built with Next.js, FastAPI, and Claude
        </div>
      </footer>
    </div>
  );
}
