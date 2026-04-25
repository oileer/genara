import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app: App;

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var não configurada");
  }

  const credentials = JSON.parse(serviceAccount);
  app = initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

export async function verifyAuthToken(authHeader: string | null): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
