import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
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
  acceptedByUid?: string;
  createdAt?: unknown;
}

export interface BrandAccess {
  id?: string;
  ownerId: string;
  brandId: string;
  brandName: string;
}

function generateCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function createInvite(
  ownerId: string,
  ownerName: string,
  brandId: string,
  brandName: string,
  email: string
): Promise<string> {
  // Bloqueia convite duplicado para o mesmo email+marca
  if (email.trim()) {
    const q = query(
      collection(db, "invitations"),
      where("ownerId", "==", ownerId),
      where("brandId", "==", brandId),
      where("email", "==", email.trim()),
      where("status", "in", ["pending", "accepted"])
    );
    const existing = await getDocs(q);
    if (!existing.empty) throw new Error("duplicate");
  }

  const code = generateCode();
  await addDoc(collection(db, "invitations"), {
    code,
    brandId,
    brandName,
    ownerId,
    ownerName,
    email: email.trim(),
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
  await updateDoc(doc(db, "invitations", inviteId), { status: "accepted", acceptedByUid: uid });

  // Referência de acesso no user_access do colaborador
  await setDoc(doc(db, "user_access", uid, "brands", invite.brandId), {
    ownerId: invite.ownerId,
    brandId: invite.brandId,
    brandName: invite.brandName,
  });

  // Adiciona UID no array members da marca (dono pode sempre editar)
  await updateDoc(doc(db, "brands", invite.ownerId, "list", invite.brandId), {
    members: arrayUnion(uid),
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

export async function removeCollaborator(
  inviteId: string,
  invite: Invite,
  ownerId: string
): Promise<void> {
  // Marca convite como removido
  await updateDoc(doc(db, "invitations", inviteId), { status: "removed" });

  // Remove UID do array members da marca (dono tem permissão)
  if (invite.acceptedByUid) {
    await updateDoc(doc(db, "brands", ownerId, "list", invite.brandId), {
      members: arrayRemove(invite.acceptedByUid),
    });
    // Tenta limpar user_access (pode falhar por permissão — não é crítico)
    try {
      await deleteDoc(doc(db, "user_access", invite.acceptedByUid, "brands", invite.brandId));
    } catch { /* silencioso — o members já foi removido */ }
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
