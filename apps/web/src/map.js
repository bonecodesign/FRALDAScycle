const testers = [
  { name: "Ana Silva", neighborhood: "Savassi", brand: "Pampers Confort Sec", size: "M", units: 36, price: "R$ 52,90", coords: [-19.9372, -43.9345] },
  { name: "Bruno Lima", neighborhood: "Funcionários", brand: "Huggies Supreme Care", size: "G", units: 30, price: "R$ 48,90", coords: [-19.9327, -43.9280] },
  { name: "Carla Santos", neighborhood: "Lourdes", brand: "MamyPoko Dia & Noite", size: "M", units: 42, price: "R$ 57,90", coords: [-19.9353, -43.9447] },
  { name: "Diego Rocha", neighborhood: "Santa Efigênia", brand: "Cremer Magic Care", size: "P", units: 34, price: "R$ 39,90", coords: [-19.9258, -43.9264] },
  { name: "Elisa Moraes", neighborhood: "Floresta", brand: "Pampers Pants", size: "XG", units: 28, price: "R$ 55,90", coords: [-19.9183, -43.9306] },
  { name: "Felipe Costa", neighborhood: "Buritis", brand: "Huggies Tripla Proteção", size: "G", units: 40, price: "R$ 51,90", coords: [-19.9656, -43.9684] },
  { name: "Gabriela Alves", neighborhood: "Sion", brand: "Personal Baby", size: "M", units: 32, price: "R$ 35,90", coords: [-19.9504, -43.9292] },
  { name: "Henrique Souza", neighborhood: "Cidade Nova", brand: "Babysec UltraSec", size: "G", units: 36, price: "R$ 42,90", coords: [-19.9008, -43.9234] },
  { name: "Isabela Ramos", neighborhood: "Castelo", brand: "Pampers Premium Care", size: "P", units: 28, price: "R$ 46,90", coords: [-19.8843, -43.9743] },
  { name: "João Martins", neighborhood: "Pampulha", brand: "Huggies Natural Care", size: "M", units: 44, price: "R$ 53,90", coords: [-19.8552, -43.9688] },
];

const mapElement = document.querySelector("#map");
const list = document.querySelector("#tester-list");
const markers = [];
const leafletAvailable = typeof window.L !== "undefined";
const map = leafletAvailable
  ? L.map("map", { scrollWheelZoom: false }).setView([-19.927, -43.94], 12)
  : null;

if (map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);
} else {
  mapElement.classList.add("map-unavailable");
  mapElement.textContent = "Mapa indisponível offline. As ofertas demonstrativas continuam disponíveis na lista.";
}

function selectTester(index) {
  const tester = testers[index];
  if (map && markers[index]) {
    map.flyTo(tester.coords, 14, { duration: 0.65 });
    markers[index].openPopup();
  }
  document.querySelectorAll("#tester-list button").forEach((button, buttonIndex) => {
    button.classList.toggle("selected", buttonIndex === index);
  });
}

testers.forEach((tester, index) => {
  if (map) {
    const icon = L.divIcon({
      className: "tester-marker",
      html: `<span>${index + 1}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker(tester.coords, { icon })
      .addTo(map)
      .bindPopup(`<strong>${tester.brand}</strong><br>${tester.neighborhood} · tamanho ${tester.size}<br><b>${tester.price}</b>`);
    marker.on("click", () => selectTester(index));
    markers.push(marker);
  } else {
    markers.push(null);
  }

  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `<span class="avatar">${tester.name.split(" ").map((part) => part[0]).join("")}</span><span><b>${tester.name}</b><small>${tester.neighborhood} · ${tester.brand}</small></span><em>${tester.price}</em>`;
  button.addEventListener("click", () => selectTester(index));
  item.append(button);
  list.append(item);
});