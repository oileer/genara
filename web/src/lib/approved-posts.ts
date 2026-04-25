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

export interface ApprovedPost {
  id?: string;
  brandId: string;
  brandName: string;
  tema: string;
  formato: string;
  tipo: "post" | "carrossel";
  copy: { headline: string; subtitle: string; cta: string };
  imageUrl: string;
  createdAt?: unknown;
}

export async function saveApprovedPost(
  uid: string,
  post: Omit<ApprovedPost, "id" | "imageUrl">,
  imageBase64: string
): Promise<string> {
  const postId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `approved_posts/${uid}/${postId}.png`);
  await uploadString(storageRef, imageBase64, "data_url");
  const imageUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, "approved_posts", uid, "list"), {
    ...post,
    imageUrl,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getApprovedPostsForBrand(
  uid: string,
  brandId: string,
  maxResults = 2
): Promise<ApprovedPost[]> {
  try {
    const q = query(
      collection(db, "approved_posts", uid, "list"),
      where("brandId", "==", brandId),
      orderBy("createdAt", "desc"),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovedPost));
  } catch {
    // índice composto pode não existir ainda — retorna vazio sem quebrar
    return [];
  }
}

export async function fetchImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
