import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

export interface Post {
  id?: string;
  brandId: string;
  brandName: string;
  tema: string;
  formato: string;
  imageUrl: string;
  createdAt?: unknown;
}

export async function savePost(uid: string, post: Omit<Post, "id">, base64Image: string): Promise<string> {
  const fileName = `posts/${uid}/${Date.now()}.png`;
  const storageRef = ref(storage, fileName);
  await uploadString(storageRef, base64Image.split(",")[1], "base64", { contentType: "image/png" });
  const imageUrl = await getDownloadURL(storageRef);

  const ref2 = await addDoc(collection(db, "posts", uid, "history"), {
    ...post,
    imageUrl,
    createdAt: serverTimestamp(),
  });
  return ref2.id;
}

export async function getPosts(uid: string): Promise<Post[]> {
  const q = query(collection(db, "posts", uid, "history"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}
