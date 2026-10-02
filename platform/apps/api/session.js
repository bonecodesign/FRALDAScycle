import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";

export async function authenticatedUser(request, authService) {
  const user = await authService.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  return user;
}
