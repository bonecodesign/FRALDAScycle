export function createProofReviewController({ request, showPhoto, now = Date.now }) {
  let generation = 0;
  let selected = null;
  return {
    async load(shipmentId) {
      const current = ++generation;
      selected = null;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shipmentId)) throw new Error('Informe um identificador de entrega válido.');
      const session = await request('/v1/auth/session');
      if (session.user?.role !== 'admin') throw new Error('Somente administradores autorizados podem validar comprovantes.');
      const { proof } = await request(`/v1/shipments/${shipmentId}/proof`);
      if (current !== generation) return null;
      if (proof.validatedAt) return { proof, alreadyValidated: true };
      const { image } = await request(`/v1/shipments/${shipmentId}/proof/photo`);
      if (current !== generation) return null;
      const expiresAt = Date.parse(image.expiresAt);
      const imageUrl = new URL(image.readUrl);
      if (imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password || !Number.isFinite(expiresAt) || expiresAt <= now()) throw new Error('Acesso à foto indisponível ou expirado. Consulte novamente.');
      await showPhoto(imageUrl.toString());
      if (current !== generation) return null;
      if (expiresAt <= now()) throw new Error('Acesso à foto expirado. Consulte novamente.');
      selected = { shipmentId, expiresAt };
      return { proof, alreadyValidated: false };
    },
    clear() { generation += 1; selected = null; },
    async validate(reason, verified) {
      const current = selected;
      if (!current || current.expiresAt <= now()) throw new Error('Consulte e carregue a foto novamente antes de validar.');
      if (verified !== true || reason.trim().length < 10 || reason.trim().length > 1000) throw new Error('Confirme a conferência e preencha a justificativa.');
      selected = null;
      // Retry requires a fresh read; avoids duplicate clicks and stale delivery selection.
      return request(`/v1/shipments/${current.shipmentId}/proof/validate`, {
        method: 'POST', body: { validated: true, reason: reason.trim() },
      });
    },
  };
}
