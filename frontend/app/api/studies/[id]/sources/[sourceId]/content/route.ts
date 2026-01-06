import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFile, getFileMetadata } from "@/lib/minio";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
    try {
        const { id: studyId, sourceId } = await params;

        const source = await prisma.source.findFirst({
            where: {
                id: sourceId,
                studyId,
            },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        if (!source.storagePath) {
            return NextResponse.json({ error: "Source has no stored file" }, { status: 404 });
        }

        try {
            // Get file content
            const buffer = await downloadFile(source.storagePath);

            // Try to get metadata for content type, otherwise default to PDF
            let contentType = "application/pdf";
            try {
                const metadata = await getFileMetadata(source.storagePath);
                if (metadata.metaData && metadata.metaData["content-type"]) {
                    contentType = metadata.metaData["content-type"];
                }
            } catch (e) {
                // Ignore metadata error, use default
            }

            // Create response with file content
            // We explicitly cast buffer to any because NextResponse body types are strict but accept Buffer
            return new NextResponse(buffer as any, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `inline; filename="${source.title || "source"}.pdf"`,
                },
            });
        } catch (error) {
            console.error("Error downloading file:", error);
            return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
        }
    } catch (error) {
        console.error("Error serving source content:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
