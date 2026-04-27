import { cookies, headers } from "next/headers";
import { err, ok } from "../../_utils";

export async function GET() {
  const cookieStore = await cookies();
  const headersList = await headers();
  
  // Check for JWT cookie from backend server
  const jwtCookie = cookieStore.get("jwt")?.value;
  // Check for Authorization header
  const authHeader = headersList.get("authorization");
  
  // If JWT cookie or Authorization header exists, proxy to backend server
  if (jwtCookie || authHeader) {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";
    const backendMeUrl = `${backendUrl.replace(/\/+$/, "")}/users/me`;
    
    try {
      // Build headers for backend request
      const backendHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };
      
      // Forward Authorization header if present
      if (authHeader) {
        backendHeaders["Authorization"] = authHeader;
      }
      
      // Forward JWT cookie if present
      if (jwtCookie) {
        backendHeaders["Cookie"] = `jwt=${jwtCookie}`;
      }
      
      // Forward the request to the backend
      const response = await fetch(backendMeUrl, {
        method: "GET",
        headers: backendHeaders,
        // Don't follow redirects
        redirect: "manual",
      });

      if (!response.ok) {
        // If backend returns 401, return 401
        if (response.status === 401) {
          return err("Unauthorized", 401);
        }
        // For other errors, try to parse and return
        const errorData = await response.json().catch(() => ({}));
        return err(errorData.message || "Backend error", response.status);
      }

      const data = await response.json();
      // Backend returns { success: true, status: "success", data: { user } }
      const user = data?.data?.user || data?.user;
      if (user) {
        return ok({ user });
      }
      return err("Invalid response from backend", 500);
    } catch (error: any) {
      console.error("Error proxying to backend:", error);
      // If it's a network error or the backend is unreachable, return 500
      // Otherwise, return the error status
      return err(error?.message || "Backend connection failed", 500);
    }
  }
  
  // Fallback to mock mode: check for cf_user cookie
  const raw = cookieStore.get("cf_user")?.value;
  if (!raw) return err("Unauthorized", 401);
  return ok({ user: JSON.parse(raw) });
}
