const API_URL = window.FRALDACYCLE_API_URL;
const token = sessionStorage.getItem("fraldacycle.token");
const container = document.querySelector("#notifications");

const demoNotifications = [
  { message: "Seu anúncio demonstrativo foi enviado para moderação." },
  { message: "Uma família demonstrou interesse em uma oferta próxima." },
  { message: "Checklist de pacote fechado concluído." },
];

async function loadNotifications() {
  if (!token) {
    container.textContent = "Entre na sua conta pelo marketplace para consultar notificações.";
    return;
  }

  try {
    const notifications = API_URL
      ? await loadRemoteNotifications()
      : demoNotifications;

    if (notifications.length === 0) {
      container.textContent = "Você não possui notificações.";
      return;
    }

    container.replaceChildren();
    notifications.forEach((notification) => {
      const item = document.createElement("article");
      item.className = "listing";
      item.textContent = notification.message;
      container.append(item);
    });
  } catch {
    container.textContent = "Não foi possível carregar as notificações agora.";
    container.className = "results error";
  }
}

async function loadRemoteNotifications() {
  const response = await fetch(`${API_URL}/my/notifications`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { notifications, error } = await response.json();
  if (!response.ok) throw new Error(error);
  return notifications;
}

loadNotifications();
