import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface HistoryPost {
  id?: string;
  brandId: string;
  brandName: string;
  tema: string;
  formato: string;
  tipo: "post" | "carrossel";
  copy: { headline: string; subtitle: string; cta: string };
  imageUrl: string;
  approved: boolean;
  createdAt?: unknown;
}

export async function saveToHistory(
  uid: string,
  post: Omit<HistoryPost, "id" | "imageUrl">,
  imageBase64: string
): Promise<string> {
  const postId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `history/${uid}/${postId}.png`);
  await uploadString(storageRef, imageBase64, "data_url");
  const imageUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, "history", uid, "posts"), {
    ...post,
    imageUrl,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getHistory(
  uid: string,
  brandId?: string,
  maxResults = 50
): Promise<HistoryPost[]> {
  try {
    const col = collection(db, "history", uid, "posts");
    const q = brandId
      ? query(col, where("brandId", "==", brandId), orderBy("createdAt", "desc"), limit(maxResults))
      : query(col, orderBy("createdAt", "desc"), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HistoryPost));
  } catch {
    return [];
  }
}

export async function getApprovedForBrand(
  uid: string,
  brandId: string,
  maxResults = 3
): Promise<HistoryPost[]> {
  try {
    const q = query(
      collection(db, "history", uid, "posts"),
      where("brandId", "==", brandId),
      where("approved", "==", true),
      orderBy("createdAt", "desc"),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HistoryPost));
  } catch {
    return [];
  }
}
