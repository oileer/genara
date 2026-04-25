import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface Brand {
  id?: string;
  name: string;
  handle: string;
  segment: string;
  tone: string;
  visual_style: string;
  colors: { background: string; primary: string; text: string; secondary: string };
  copy_examples: { headline: string; subtitle: string; cta: string };
  effects: string[];
  dont: string[];
  logo_url?: string | null;
  reference_images?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function uploadBrandLogo(
  uid: string,
  brandId: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const storageRef = ref(storage, `logos/${uid}/${brandId}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadReferenceImage(
  uid: string,
  brandId: string,
  file: File
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const ext = file.name.split(".").pop() || "jpg";
  const storageRef = ref(storage, `references/${uid}/${brandId}/${id}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getBrands(uid: string): Promise<Brand[]> {
  const snap = await getDocs(collection(db, "brands", uid, "list"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function createBrand(uid: string, brand: Omit<Brand, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "brands", uid, "list"), {
    ...brand,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBrand(uid: string, brandId: string, brand: Partial<Brand>) {
  await updateDoc(doc(db, "brands", uid, "list", brandId), {
    ...brand,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBrand(uid: string, brandId: string) {
  await deleteDoc(doc(db, "brands", uid, "list", brandId));
}
