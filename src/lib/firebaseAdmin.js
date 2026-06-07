import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let db = null;

function initAdmin() {
  if (db) return db;
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else {
      initializeApp({
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }
  db = getFirestore();
  return db;
}

export function getAdminDb() {
  return initAdmin();
}

// Storage bucket via the admin SDK (bypasses storage rules) — used to delete a
// polaroid blob when a pending dispatch is rejected. Bucket name is passed
// explicitly since the admin app isn't initialized with a default bucket.
export function getAdminBucket() {
  initAdmin();
  const name =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) return null;
  return getStorage().bucket(name);
}

export { FieldValue, Timestamp };
