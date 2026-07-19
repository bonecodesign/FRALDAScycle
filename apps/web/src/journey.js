(() => {
  const STORAGE_KEY = "fraldacycle.demo.journey.v1";
  const defaultState = {
    view: "pedido",
    deal: "Compra",
    proposal: "draft",
    payment: "pending",
    paymentMethod: "PIX",
    delivery: 0,
    rating: 0,
    review: "",
    ticket: null,
    messages: [
      { from: "seller", text: "Olá! O pacote continua disponível e está lacrado.", time: "10:31" },
      { from: "me", text: "Ótimo! Podemos combinar a retirada no bairro Castelo?", time: "10:32" },
      { from: "seller", text: "Podemos sim. Qual período funciona melhor?", time: "10:33" }
    ]
  };

  const readState = () => {
    try {
      return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...defaultState };
    }
  };

  let state = readState();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const timeNow = () => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const toast = (message) => {
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
  };

  const queryView = new URLSearchParams(location.search).get("view");
  if (queryView && $("[data-screen='" + queryView + "']")) state.view = queryView;

  const view = (name, updateUrl = true) => {
    if (!$("[data-screen='" + name + "']")) name = "pedido";
    state.view = name;
    $$("[data-screen]").forEach((screen) => { screen.hidden = screen.dataset.screen !== name; });
    $$("[data-view]").forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "step" : "false");
    });
    if (updateUrl) {
      const url = new URL(location.href);
      if (name === "pedido") url.searchParams.delete("view");
      else url.searchParams.set("view", name);
      history.replaceState({}, "", url);
    }
    save();
    window.scrollTo({ top: Math.max(0, $(".journey-tabs").offsetTop - 82), behavior: reduceMotion ? "auto" : "smooth" });
  };

  const orderStage = () => {
    if (state.delivery >= 4) return 5;
    if (state.payment === "approved") return 4;
    if (state.proposal === "accepted") return 3;
    if (state.proposal === "sent") return 2;
    return 1;
  };

  const renderOrder = () => {
    const stage = orderStage();
    const labels = ["Negociação aberta", "Proposta enviada", "Aguardando pagamento", "Entrega em andamento", "Pedido concluído"];
    $("#order-status").textContent = labels[stage - 1];
    $$("#order-stepper li").forEach((item) => {
      const itemStage = Number(item.dataset.stage);
      item.classList.toggle("complete", itemStage < stage);
      item.classList.toggle("active", itemStage === stage);
    });
  };

  const renderMessages = () => {
    const container = $("#messages");
    container.innerHTML = "";
    state.messages.forEach((message) => {
      const bubble = document.createElement("div");
      bubble.className = "message" + (message.from === "me" ? " mine" : "");
      const text = document.createElement("span");
      text.textContent = message.text;
      const time = document.createElement("small");
      time.textContent = message.time;
      bubble.append(text, time);
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  };

  const renderProposal = () => {
    $$("[data-deal]").forEach((button) => button.classList.toggle("active", button.dataset.deal === state.deal));
    $("#accept-proposal").disabled = state.proposal !== "sent";
    $("#send-proposal").textContent = state.proposal === "draft" ? "Enviar proposta" : state.proposal === "sent" ? "Proposta enviada" : "Proposta registrada";
    $("#accept-proposal").textContent = state.proposal === "accepted" ? "✓ Proposta aceita" : "Aceitar proposta simulada";
  };

  const renderPayment = () => {
    const success = state.payment === "approved";
    $("#payment-success").hidden = !success;
    $("#simulate-payment").textContent = success ? "✓ Aprovação simulada" : "Simular aprovação";
    $("#simulate-payment").disabled = success;
    const input = $("input[name='payment'][value='" + state.paymentMethod + "']");
    if (input) input.checked = true;
  };

  const renderDelivery = () => {
    const labels = ["Pedido confirmado", "Coleta realizada", "Em trânsito", "Próximo ao destino", "Entrega concluída"];
    $("#delivery-badge").textContent = state.payment === "approved" ? labels[state.delivery] : "Aguardando acordo";
    $$("#delivery-timeline li").forEach((item) => {
      const step = Number(item.dataset.delivery);
      item.classList.toggle("complete", step < state.delivery);
      item.classList.toggle("active", step === state.delivery);
    });
    $("#advance-delivery").disabled = state.payment !== "approved" || state.delivery >= 4;
    $("#advance-delivery").textContent = state.delivery >= 4 ? "✓ Entrega concluída" : "Avançar status demonstrativo";
  };

  const renderReview = () => {
    const unlocked = state.delivery >= 4;
    $("#review-status").textContent = unlocked ? "Avaliação liberada" : "Disponível após a entrega";
    $("#save-review").disabled = !unlocked;
    $("#review-text").disabled = !unlocked;
    $("#review-text").value = state.review;
    $$(".stars button").forEach((button) => {
      const selected = Number(button.dataset.rating) <= state.rating;
      button.classList.toggle("selected", selected);
      button.disabled = !unlocked;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", Number(button.dataset.rating) === state.rating ? "true" : "false");
    });
  };

  const renderTicket = () => {
    const result = $("#ticket-result");
    if (!state.ticket) {
      result.hidden = true;
      return;
    }
    result.hidden = false;
    result.innerHTML = "<strong>Protocolo local " + state.ticket.id + "</strong><p>" + state.ticket.topic + " · salvo apenas neste dispositivo.</p>";
  };

  const render = () => {
    renderOrder();
    renderMessages();
    renderProposal();
    renderPayment();
    renderDelivery();
    renderReview();
    renderTicket();
    view(state.view, false);
  };

  $$("[data-view]").forEach((button) => button.addEventListener("click", () => view(button.dataset.view)));
  $$("[data-go]").forEach((control) => control.addEventListener("click", (event) => {
    event.preventDefault();
    view(control.dataset.go);
  }));

  $("#message-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#message-input");
    const text = input.value.trim();
    if (!text) return;
    state.messages.push({ from: "me", text, time: timeNow() });
    input.value = "";
    save();
    renderMessages();
    toast("Mensagem salva apenas nesta demonstração.");
  });

  $$("[data-deal]").forEach((button) => button.addEventListener("click", () => {
    state.deal = button.dataset.deal;
    save();
    renderProposal();
  }));

  $("#send-proposal").addEventListener("click", () => {
    state.proposal = "sent";
    const value = $("#proposal-value").value.trim() || "42,00";
    const delivery = $("#delivery-choice").value;
    state.messages.push({ from: "me", text: "Proposta de " + state.deal.toLowerCase() + ": R$ " + value + " · " + delivery + ".", time: timeNow() });
    save();
    render();
    toast("Proposta demonstrativa enviada.");
  });

  $("#accept-proposal").addEventListener("click", () => {
    if (state.proposal !== "sent") return;
    state.proposal = "accepted";
    state.messages.push({ from: "seller", text: "Combinado! A proposta foi aceita e o pacote está reservado.", time: timeNow() });
    save();
    render();
    toast("Aceite simulado. A etapa de pagamento foi liberada.");
    setTimeout(() => view("pagamento"), 700);
  });

  $$("input[name='payment']").forEach((input) => input.addEventListener("change", () => {
    state.paymentMethod = input.value;
    save();
  }));

  $("#simulate-payment").addEventListener("click", () => {
    if (state.proposal !== "accepted") {
      toast("Primeiro simule o aceite da proposta no chat.");
      view("chat");
      return;
    }
    state.payment = "approved";
    state.delivery = Math.max(0, state.delivery);
    save();
    render();
    toast("Aprovação registrada localmente. Nenhum valor foi cobrado.");
  });

  $("#advance-delivery").addEventListener("click", () => {
    if (state.payment !== "approved") {
      toast("Simule o pagamento antes de iniciar a entrega.");
      return;
    }
    state.delivery = Math.min(4, state.delivery + 1);
    save();
    render();
    toast(state.delivery === 4 ? "Entrega concluída. Avaliação liberada." : "Status demonstrativo atualizado.");
  });

  $("#support-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const message = $("#support-message").value.trim();
    if (!message) return;
    state.ticket = {
      id: "FC-" + String(Date.now()).slice(-6),
      topic: $("#support-topic").value,
      message
    };
    save();
    renderTicket();
    $("#support-message").value = "";
    toast("Protocolo salvo somente neste dispositivo.");
  });

  $$(".stars button").forEach((button) => button.addEventListener("click", () => {
    if (state.delivery < 4) return;
    state.rating = Number(button.dataset.rating);
    save();
    renderReview();
  }));

  $("#save-review").addEventListener("click", () => {
    if (state.delivery < 4 || !state.rating) {
      toast("Selecione uma nota para salvar.");
      return;
    }
    state.review = $("#review-text").value.trim();
    save();
    renderReview();
    toast("Avaliação demonstrativa salva neste dispositivo.");
  });

  $("#reset-demo").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = { ...defaultState, messages: defaultState.messages.map((item) => ({ ...item })) };
    save();
    render();
    view("pedido");
    toast("Jornada reiniciada.");
  });

  window.addEventListener("popstate", () => {
    const next = new URLSearchParams(location.search).get("view") || "pedido";
    view(next, false);
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
  }

  render();
})();