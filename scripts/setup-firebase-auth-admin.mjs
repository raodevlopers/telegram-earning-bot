import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const adminEmail = process.env.ADMIN_AUTH_EMAIL ?? "raosahab.admin@hybrid-engineer.local";
const adminPassword = process.env.ADMIN_AUTH_PASSWORD;
const adminDisplayName = process.env.ADMIN_AUTH_USERNAME ?? "rao sahab";
const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY ?? "AIzaSyD7vnjAbV-aOJ0gG34-h1X1XM5XheFeXEc";
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
  throw new Error("Missing Firebase Admin credentials in environment variables.");
}

if (!adminPassword) {
  throw new Error("Set ADMIN_AUTH_PASSWORD in the environment before running this script.");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey
    })
  });
}

const auth = getAuth();

let userRecord;

try {
  userRecord = await auth.getUserByEmail(adminEmail);
  userRecord = await auth.updateUser(userRecord.uid, {
    displayName: adminDisplayName,
    password: adminPassword,
    emailVerified: true,
    disabled: false
  });
  console.log(`Updated Firebase Auth admin user ${adminEmail}`);
} catch (error) {
  if (error?.code !== "auth/user-not-found") {
    throw error;
  }

  userRecord = await auth.createUser({
    email: adminEmail,
    password: adminPassword,
    displayName: adminDisplayName,
    emailVerified: true,
    disabled: false
  });
  console.log(`Created Firebase Auth admin user ${adminEmail}`);
}

await auth.setCustomUserClaims(userRecord.uid, {
  admin: true,
  role: "admin"
});

console.log(`Applied admin claims to uid ${userRecord.uid}`);

const verifyResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: adminEmail,
    password: adminPassword,
    returnSecureToken: true
  })
});

const verifyPayload = await verifyResponse.json();

if (!verifyResponse.ok) {
  const message = verifyPayload?.error?.message ?? "Unknown Firebase Auth sign-in error.";
  console.error(`Admin user was created, but email/password sign-in verification failed: ${message}`);
  if (message === "PASSWORD_LOGIN_DISABLED") {
    console.error("Enable Email/Password sign-in in Firebase Authentication, then rerun this script.");
  }
  process.exit(1);
}

console.log("Firebase Auth email/password sign-in verified successfully.");
