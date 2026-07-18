const statusMessages = {
  active: "Seu anúncio foi aprovado e já está visível.",
  blocked: "Seu anúncio foi bloqueado pela moderação.",
  closed: "Seu anúncio foi encerrado pela moderação.",
};

export class NotificationService {
  constructor({ repository }) {
    this.repository = repository;
  }

  async notifyListingStatus(listing) {
    const message = statusMessages[listing.status];

    if (!message) {
      return null;
    }

    return this.repository.create({
      userId: listing.ownerId,
      type: `listing.${listing.status}`,
      message,
    });
  }
}
