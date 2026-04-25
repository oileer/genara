import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Invite {
  id?: string;
  code: string;
  brandId: string;
  brandName: string;
  ownerId: string;
  ownerName: string;
  email: string;
  status: "pending" | "accepted";
  createdAt?: unknown;
}

export interface BrandAccess {
  id?: string;
  ownerId: string;
  brandId: string;
  brandName: string;
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export async function createInvite(
  ownerId: string,
  ownerName: string,
  brandId: string,
  brandName: string,
  email: string
): Promise<string> {
  const code = generateCode();
  await addDoc(collection(db, "invitations"), {
    code,
    brandId,
    brandName,
    ownerId,
    ownerName,
    email,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return code;
}

export async function getInviteByCode(code: string): Promise<Invite | null> {
  const q = query(collection(db, "invitations"), where("code", "==", code), where("status", "==", "pending"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Invite;
}

export async function acceptInvite(inviteId: string, invite: Invite, uid: string): Promise<void> {
  // Marca convite como aceito
  await updateDoc(doc(db, "invitations", inviteId), { status: "accepted" });

  // Adiciona referência de acesso para o usuário (usando brandId como ID do doc)
  await setDoc(doc(db, "user_access", uid, "brands", invite.brandId), {
    ownerId: invite.ownerId,
    brandId: invite.brandId,
    brandName: invite.brandName,
  });
}

export async function getSharedBrandRefs(uid: string): Promise<BrandAccess[]> {
  try {
    const snap = await getDocs(collection(db, "user_access", uid, "brands"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BrandAccess));
  } catch {
    return [];
  }
}

export async function getBrandInvites(ownerId: string, brandId: string): Promise<Invite[]> {
  try {
    const q = query(
      collection(db, "invitations"),
      where("ownerId", "==", ownerId),
      where("brandId", "==", brandId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite));
  } catch {
    return [];
  }
}
