import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType | 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId?: string | null;
    providerInfo: { providerId: string; displayName: string | null; email: string | null; photoUrl?: string | null }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType | string, path: string | null = null): never {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error?.message || String(error),
    operationType: operationType as any,
    path,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || '',
        photoUrl: p.photoURL || ''
      })) || []
    }
  };
  
  throw new Error(JSON.stringify(errorInfo));
}

async function testConnection() {
  try {
    // Only test if we have a config that makes sense
    if (firebaseConfig.projectId !== 'remixed-project-id') {
      await getDocFromServer(doc(db, 'system_test', 'connection'));
    }
  } catch (error: any) {
    if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.error("Please check your Firebase configuration or internet connection.");
    }
    // We expect permission denied if the document doesn't exist or rules are tight
  }
}

// testConnection();
