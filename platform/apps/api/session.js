import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";

export async function authenticatedUser(request, authService, { optionalService = false } = {}) {
  const user = optionalService
    ? await authService?.session(readSessionCookie(request.headers.cookie))
    : await authService.session(readSessionCookie(request.headers.cookie));
  if (!user) throw new AuthError("unauthenticated", 401, "Sessão não autenticada.");
  return user;
}
