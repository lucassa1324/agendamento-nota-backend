import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

type B2Config = {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpoint: string;
};

let s3Client: S3Client | null = null;

const getB2Config = (): B2Config => {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;

  if (!keyId || !applicationKey || !bucketName || !endpoint) {
    throw new Error("B2_STORAGE_MISSING_ENV");
  }

  return {
    keyId,
    applicationKey,
    bucketName,
    endpoint
  };
};

const getS3Client = () => {
  if (s3Client) return s3Client;
  const { keyId, applicationKey, endpoint } = getB2Config();

  // Garante que o endpoint tenha https://
  let normalizedEndpoint = endpoint;
  if (!normalizedEndpoint.startsWith("http")) {
    normalizedEndpoint = `https://${normalizedEndpoint}`;
  }

  s3Client = new S3Client({
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: applicationKey
    },
    region: "us-east-1",
    endpoint: normalizedEndpoint, // Usar o endpoint normalizado com https
    forcePathStyle: true
  });

  return s3Client;
};

export const uploadToB2 = async (params: {
  buffer: Buffer;
  contentType: string;
  key: string;
  cacheControl?: string;
}): Promise<string> => {
  const { bucketName, endpoint } = getB2Config();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
    CacheControl: params.cacheControl
  });

  await getS3Client().send(command);

  // Retorna a URL do proxy local em vez da URL do Backblaze
  // Ajuste o localhost:3001 para process.env.BETTER_AUTH_URL se disponível
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
  return `${baseUrl}/api/storage/${params.key}`;
};

export const getFileStreamFromB2 = async (key: string) => {
  const { bucketName } = getB2Config();

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const response = await getS3Client().send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
};

export const deleteFileFromB2 = async (key: string): Promise<void> => {
  const { bucketName } = getB2Config();

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  try {
    await getS3Client().send(command);
  } catch (error) {
    console.error("[B2_DELETE_ERROR]:", error);
    // Não lançamos erro aqui para não impedir a exclusão no banco de dados
    // se o arquivo já não existir ou houver erro de conexão
  }
};
