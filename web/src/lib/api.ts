import { User } from "firebase/auth";

export async function authFetch(user: User, url: string, options: RequestInit = {}): Promise<Response> {
  const token = await user.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}
