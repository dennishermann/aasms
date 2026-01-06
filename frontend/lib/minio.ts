import * as Minio from "minio";

const minioEndpoint = process.env.MINIO_ENDPOINT || "localhost";
const minioPort = parseInt(process.env.MINIO_PORT || "9000");
const minioAccessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
const minioSecretKey = process.env.MINIO_SECRET_KEY || "minioadmin";
const minioUseSSL = process.env.MINIO_USE_SSL === "true";

export const minioClient = new Minio.Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
});

export const BUCKET_NAME = "sms-documents";

/**
 * Initialize MinIO bucket if it doesn't exist
 */
export async function initializeBucket(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, "us-east-1");
      console.log(`Created MinIO bucket: ${BUCKET_NAME}`);
    }
  } catch (error) {
    console.error("Error initializing MinIO bucket:", error);
    throw error;
  }
}

/**
 * Upload a file to MinIO
 */
export async function uploadFile(
  objectPath: string,
  buffer: Buffer,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    await minioClient.putObject(BUCKET_NAME, objectPath, buffer, buffer.length, metadata);
  } catch (error) {
    console.error("Error uploading file to MinIO:", error);
    throw error;
  }
}

/**
 * Download a file from MinIO
 */
export async function downloadFile(objectPath: string): Promise<Buffer> {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, objectPath);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  } catch (error) {
    console.error("Error downloading file from MinIO:", error);
    throw error;
  }
}

/**
 * Get a presigned URL for downloading a file
 */
export async function getPresignedUrl(
  objectPath: string,
  expirySeconds: number = 3600
): Promise<string> {
  try {
    return await minioClient.presignedGetObject(BUCKET_NAME, objectPath, expirySeconds);
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw error;
  }
}

/**
 * Delete a file from MinIO
 */
export async function deleteFile(objectPath: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET_NAME, objectPath);
  } catch (error) {
    console.error("Error deleting file from MinIO:", error);
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(objectPath: string) {
  try {
    return await minioClient.statObject(BUCKET_NAME, objectPath);
  } catch (error) {
    console.error("Error getting file metadata:", error);
    throw error;
  }
}

/**
 * Generate storage path for a source document
 */
export function generateStoragePath(studyId: string, sourceId: string, extension: string): string {
  return `studies/${studyId}/sources/${sourceId}${extension}`;
}

