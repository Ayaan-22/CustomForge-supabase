import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function getJSONCookie<T>(key: string, fallback: T): Promise<T> {
  try {
    const cookieStore = await cookies();
    const v = cookieStore.get(key)?.value;
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setJSONCookie<T>(
  res: NextResponse,
  key: string,
  value: T,
  maxAgeDays = 7
) {
  res.cookies.set({
    name: key,
    value: JSON.stringify(value),
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * maxAgeDays,
  });
}

export function ok<T>(data: T, setCookies?: (res: NextResponse) => void) {
  const res = NextResponse.json(data, { status: 200 });
  if (setCookies) setCookies(res);
  return res;
}

export function created<T>(data: T, setCookies?: (res: NextResponse) => void) {
  const res = NextResponse.json(data, { status: 201 });
  if (setCookies) setCookies(res);
  return res;
}

export function err(message = "Bad Request", status = 400, details?: unknown) {
  return NextResponse.json({ message, error: message, details }, { status });
}

export function requireBody<T>(req: Request): Promise<T> {
  return req.json();
}

export const res = NextResponse;

export async function getAuthUser<T = any>(): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const v = cookieStore.get("cf_user")?.value;
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function setAuthUser<T = any>(user: T, maxAgeDays = 7) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: "cf_user",
    value: JSON.stringify(user),
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * maxAgeDays,
  });
}

export async function requireAuth<T = any>(): Promise<T> {
  const user = await getAuthUser<T>();
  if (!user) {
    // In mock mode, fall back to a demo user to keep flows working without a real backend
    return {
      id: "u_demo",
      name: "Demo User",
      email: "demo@customforge.dev",
      verified: true,
      twoFactorEnabled: false,
    } as unknown as T;
  }
  return user;
}
