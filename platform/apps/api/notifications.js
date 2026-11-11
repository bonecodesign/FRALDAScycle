export function createNotificationService(repository = null) {
  const optionalReminderKinds = new Set(["payment_reminder", "delivery_reminder", "general_reminder"]);
  async function enqueue(kind, { email, phone, token, authTokenHash }) {
    if (!repository) return { queued: false };
    const recipient = email ?? phone;
    if (!recipient) throw new Error("Notification recipient is required");
    const id = await repository.enqueue({
      kind,
      recipient,
      payload: { token, channel: email ? "email" : "sms" },
      ...(authTokenHash ? { authTokenHash } : {}),
    });
    return id ? { queued: true, id } : { queued: false };
  }

  async function reminder({ kind, userId, email, phone, pushReference, channel, payload = {} }) {
    if (!optionalReminderKinds.has(kind)) throw new Error("Optional reminder kind is not allowed");
    if (typeof userId !== "string" || !userId || !["email", "sms", "push"].includes(channel)) {
      throw new Error("Optional reminder requires an account and an explicit channel");
    }
    if ((channel === "email" && (typeof email !== "string" || !email.trim() || phone != null || pushReference != null)) ||
        (channel === "sms" && (typeof phone !== "string" || !phone.trim() || email != null || pushReference != null)) ||
        (channel === "push" && (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,255}$/.test(String(pushReference??"")) || email != null || phone != null))) throw new Error("Optional reminder recipient must match its supported channel");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Optional reminder payload must be an object");
    const recipient = email ?? phone ?? pushReference;
    if (!repository) return { queued: false };
    const id = await repository.enqueue({ kind, userId, recipient, payload: { ...payload, channel } });
    return id ? { queued: true, id } : { queued: false };
  }

  return Object.freeze({
    configured: true,
    verification(message) {
      return enqueue("email_verification", message);
    },
    passwordRecovery(message) {
      return enqueue("password_recovery", message);
    },
    adminLoginChallenge(message) {
      return enqueue("admin_login_mfa", message);
    },
    reminder,
  });
}
