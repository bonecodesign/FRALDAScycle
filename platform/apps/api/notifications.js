export function createNotificationService(deliver = null) {
  return Object.freeze({
    configured: typeof deliver === "function",
    async verification({ email, token }) {
      if (!deliver) return { delivered: false };
      await deliver({ kind: "email_verification", recipient: email, token });
      return { delivered: true };
    },
    async passwordRecovery({ email, token }) {
      if (!deliver) return { delivered: false };
      await deliver({ kind: "password_recovery", recipient: email, token });
      return { delivered: true };
    },
  });
}
