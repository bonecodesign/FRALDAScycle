import { createListing } from "@fraldacycle/domain";

import { AuthService } from "./auth-service.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileUserRepository } from "./file-user-repository.js";

const password = "TesterFralda!2026";
const secret =
  process.env.AUTH_SECRET ??
  "fraldacycle-demo-seed-secret-with-more-than-thirty-two-characters";
const userRepository = new FileUserRepository(
  process.env.USERS_DATA_FILE ?? "data/users.json",
);
const listingRepository = new FileListingRepository(
  process.env.LISTINGS_DATA_FILE ?? "data/listings.json",
);
const authService = new AuthService({ userRepository, secret });

const testerNames = [
  "ana.silva",
  "bruno.lima",
  "carla.santos",
  "diego.rocha",
  "elisa.moraes",
  "felipe.costa",
  "gabriela.alves",
  "henrique.souza",
  "isabela.ramos",
  "joao.martins",
];

const demoListings = [
  ["Pampers Confort Sec", "M", 36, 5290, "São Paulo", "SP"],
  ["Huggies Supreme Care", "G", 30, 4890, "Campinas", "SP"],
  ["MamyPoko Dia & Noite", "M", 42, 5790, "Santos", "SP"],
  ["Cremer Magic Care", "P", 34, 3990, "São José dos Campos", "SP"],
  ["Pampers Pants", "XG", 28, 5590, "Sorocaba", "SP"],
  ["Huggies Tripla Proteção", "G", 40, 5190, "Ribeirão Preto", "SP"],
  ["Personal Baby", "M", 32, 3590, "Guarulhos", "SP"],
  ["Babysec UltraSec", "G", 36, 4290, "Osasco", "SP"],
  ["Pampers Premium Care", "P", 28, 4690, "São Bernardo do Campo", "SP"],
  ["Huggies Natural Care", "M", 44, 5390, "São Paulo", "SP"],
];

async function userFor(email) {
  const existing = await userRepository.findByEmail(email);

  if (existing) return existing;

  const { user } = await authService.register({ email, password });
  return user;
}

const existingListings = await listingRepository.list({ status: null });
let usersCreated = 0;
let listingsCreated = 0;

for (const [index, name] of testerNames.entries()) {
  const email = `${name}@tester.fraldacycle.local`;
  const knownUser = await userRepository.findByEmail(email);
  const user = await userFor(email);
  if (!knownUser) usersCreated += 1;

  const [brand, diaperSize, units, priceCents, city, state] = demoListings[index];
  if (existingListings.some((listing) => listing.brand === brand)) continue;

  await listingRepository.create(
    createListing({
      ownerId: user.id,
      type: "sell",
      status: "active",
      sealed: true,
      brand,
      diaperSize,
      units,
      priceCents,
      photoUrl: `https://placehold.co/640x480/eaf2ec/26734d?text=${encodeURIComponent(brand)}`,
      location: { city, state },
    }),
  );
  listingsCreated += 1;
}

console.log(
  `Demo ready: ${usersCreated} tester accounts and ${listingsCreated} active listings created.\n` +
    `Tester password: ${password}`,
);
