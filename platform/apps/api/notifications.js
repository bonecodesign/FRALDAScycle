export function createNotificationService(repository = null) {
  async function enqueue(kind, { email, phone, token }) {
    if (!repository) return { queued: false };
    const recipient = email ?? phone;
    if (!recipient) throw new Error("Notification recipient is required");
    const id = await repository.enqueue({
      kind,
      recipient,
      payload: { token, channel: email ? "email" : "sms" },
    });
    return { queued: true, id };
  }

  return Object.freeze({
    configured: true,
    verification(message) {
      return enqueue("email_verification", message);
    },
    passwordRecovery(message) {
      return enqueue("password_recovery", message);
    },
  });
}
