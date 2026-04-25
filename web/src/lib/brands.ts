import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface Brand {
  id?: string;
  ownerId?: string;
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
  const ownSnap = await getDocs(collection(db, "brands", uid, "list"));
  const ownBrands = ownSnap.docs.map((d) => ({ id: d.id, ownerId: uid, ...d.data() } as Brand));

  // Busca marcas compartilhadas
  try {
    const accessSnap = await getDocs(collection(db, "user_access", uid, "brands"));
    const sharedBrands = await Promise.all(
      accessSnap.docs.map(async (accessDoc) => {
        const { ownerId, brandId } = accessDoc.data();
        const brandSnap = await getDoc(doc(db, "brands", ownerId, "list", brandId));
        if (!brandSnap.exists()) return null;
        const brandData = brandSnap.data();
        // Verifica se ainda está no array members (não foi removido pelo dono)
        const members: string[] = brandData.members || [];
        if (!members.includes(uid)) return null;
        return { id: brandSnap.id, ownerId, ...brandData } as Brand;
      })
    );
    const validShared = sharedBrands.filter(Boolean) as Brand[];
    const all = [...ownBrands, ...validShared];
    const seen = new Set<string>();
    return all.filter((b) => {
      const key = `${b.ownerId}-${b.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return ownBrands;
  }
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
