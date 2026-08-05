export const DIAPER_CATEGORIES = Object.freeze([
  Object.freeze({ value: "infant", label: "Infantil descartável" }),
  Object.freeze({ value: "swim", label: "Descartável para piscina" }),
]);

// Catálogo vivo para o piloto brasileiro. "Outro modelo" permite moderação sem
// bloquear lançamentos regionais ou renomeações posteriores dos fabricantes.
export const DIAPER_MODELS = Object.freeze([
  Object.freeze({ brand: "Pampers", model: "Recém Nascido", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Primeiros Dias", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Premium Care", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Premium Care Pants", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Confort Sec", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Pants Ajuste Total", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Supersequinha", category: "infant" }),
  Object.freeze({ brand: "Pampers", model: "Splashers", category: "swim" }),
  Object.freeze({ brand: "Huggies", model: "Natural Care", category: "infant" }),
  Object.freeze({ brand: "Huggies", model: "Máxima Proteção", category: "infant" }),
  Object.freeze({ brand: "Huggies", model: "Rápida Absorção", category: "infant" }),
  Object.freeze({ brand: "Huggies", model: "Proteção Acolchoada Pants", category: "infant" }),
  Object.freeze({ brand: "Huggies", model: "Little Swimmers", category: "swim" }),
  Object.freeze({ brand: "MamyPoko", model: "Fralda-Calça Dia & Noite", category: "infant" }),
  Object.freeze({ brand: "MamyPoko", model: "Fralda-Calça Super Seca", category: "infant" }),
  Object.freeze({ brand: "Babysec", model: "Premium", category: "infant" }),
  Object.freeze({ brand: "Babysec", model: "Ultrasec", category: "infant" }),
  Object.freeze({ brand: "Babysec", model: "Super Premium", category: "infant" }),
  Object.freeze({ brand: "Babysec", model: "Pants", category: "infant" }),
  Object.freeze({ brand: "Pom Pom", model: "Derma Protek", category: "infant" }),
  Object.freeze({ brand: "Pom Pom", model: "Proteção de Mãe", category: "infant" }),
  Object.freeze({ brand: "Personal Baby", model: "Protect & Sec", category: "infant" }),
  Object.freeze({ brand: "Personal Baby", model: "Premium Protection", category: "infant" }),
  Object.freeze({ brand: "Cremer", model: "Disney Baby", category: "infant" }),
  Object.freeze({ brand: "Capricho", model: "Bummis", category: "infant" }),
  Object.freeze({ brand: "Turma da Mônica Baby", model: "Baby", category: "infant" }),
  Object.freeze({ brand: "Needs", model: "Baby", category: "infant" }),
  Object.freeze({ brand: "Outro", model: "Outro modelo — sujeito à moderação", category: "infant" }),
  Object.freeze({ brand: "Outro", model: "Outro modelo para piscina — sujeito à moderação", category: "swim" }),
]);

export const DIAPER_SIZES = Object.freeze(["RN", "RN+", "P", "P/M", "M", "G", "XG", "XXG", "XXXG"]);

export function modelsForCategory(category) {
  return DIAPER_MODELS.filter((item) => item.category === category);
}

export function catalogHasModel(category, brand, model) {
  return DIAPER_MODELS.some((item) => item.category === category && item.brand === brand && item.model === model);
}

export function catalogOptions(category, selectedModel = "") {
  return modelsForCategory(category).map((item) =>
    `<option value="${item.model}" data-brand="${item.brand}"${item.model === selectedModel ? " selected" : ""}>${item.brand} — ${item.model}</option>`,
  ).join("");
}
