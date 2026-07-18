const API_URL = window.FRALDACYCLE_API_URL ?? "http://localhost:3000";
const token = sessionStorage.getItem("fraldacycle.token");
const container = document.querySelector("#notifications");

if (!token) {
  container.textContent = "Entre na sua conta para consultar notificações.";
} else {
  try {
    const response = await fetch(`${API_URL}/my/notifications`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { notifications, error } = await response.json();

    if (!response.ok) throw new Error(error);

    if (notifications.length === 0) {
      container.textContent = "Você não possui notificações.";
    } else {
      notifications.forEach((notification) => {
        const item = document.createElement("article");
        item.className = "listing";
        item.textContent = notification.message;
        container.append(item);
      });
    }
  } catch (error) {
    container.textContent = error.message;
    container.className = "results error";
  }
}
