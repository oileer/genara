import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  whatsapp: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await createUserDoc(credential.user, { name, whatsapp });
  return credential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle(whatsapp?: string) {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const exists = await userDocExists(user.uid);
  if (!exists) {
    await createUserDoc(user, {
      name: user.displayName || "",
      whatsapp: whatsapp || "",
    });
  }
  return user;
}

export async function getUserDoc(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserDoc(uid: string, data: Record<string, unknown>) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

export async function logout() {
  await signOut(auth);
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

async function userDocExists(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists();
}

async function createUserDoc(user: User, extra: { name: string; whatsapp: string }) {
  await setDoc(doc(db, "users", user.uid), {
    name: extra.name || user.displayName || "",
    email: user.email,
    whatsapp: extra.whatsapp,
    createdAt: serverTimestamp(),
  });
}
