// Service stockage — Upload vers MinIO (S3-compatible) depuis Next.js
// Appelé par la route API upload avant de lancer le traitement

import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "mistra-dev",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "mistra-dev-secret-123",
    },
    forcePathStyle: true, // Obligatoire pour MinIO
  });
}

const BUCKET = process.env.S3_BUCKET ?? "pieces";
let bucketPret = false;

// Crée le bucket s'il n'existe pas et le passe en lecture publique
// (nécessaire pour que Gotenberg puisse télécharger les fichiers)
async function preparerBucket(client: S3Client): Promise<void> {
  if (bucketPret) return;

  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (err: unknown) {
    // Le bucket existe déjà → normal
    const code = (err as { Code?: string; name?: string })?.Code ?? (err as { name?: string })?.name;
    if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") {
      throw err;
    }
  }

  // Politique lecture publique pour que Gotenberg puisse télécharger les fichiers
  try {
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            },
          ],
        }),
      }),
    );
  } catch {
    // Ignore si la politique échoue (ex: droits insuffisants en dev local)
  }

  bucketPret = true;
}

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function uploadFichier(
  buffer: Buffer,
  cabinetId: string,
  fichierNom: string,
  fichierType: string,
): Promise<string> {
  const client = getS3Client();
  await preparerBucket(client);

  const cleanNom = fichierNom.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${cabinetId}/${Date.now()}-${cleanNom}`;
  const mimeType = MIME_TYPES[fichierType] ?? "application/octet-stream";

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  // URL interne Docker (accessible depuis Gotenberg et Next.js dans le même réseau)
  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  return `${endpoint}/${BUCKET}/${key}`;
}
