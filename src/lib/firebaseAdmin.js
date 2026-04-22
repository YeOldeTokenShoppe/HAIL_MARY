import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

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

export { FieldValue, Timestamp };
