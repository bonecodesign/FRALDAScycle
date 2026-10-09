import { adultDeclaration } from "../../packages/contracts/account-age.js";
import { AuthError } from "./auth-service.js";

export function requireAdultDeclaration(user) {
  if (!user?.adultDeclared) {
    throw new AuthError("adult_declaration_required", 403, "Confirme que você tem 18 anos ou mais antes de iniciar esta operação.");
  }
  return user;
}

export function createAdultDeclarationService(repository) {
  return Object.freeze({
    async status(actor) {
      const state = await repository.status(actor.id);
      return {
        declared: Boolean(state?.adult_declared_at),
        version: state?.adult_declaration_version ?? null,
        declaredAt: state?.adult_declared_at ?? null,
      };
    },
    async declare(actor, input) {
      let declaration;
      try { declaration = adultDeclaration(input); }
      catch { throw new AuthError("adult_declaration_required", 422, "Confirme que você tem 18 anos ou mais usando a versão atual."); }
      const state = await repository.declare({ actorUserId: actor.id, version: declaration.version });
      if (!state) throw new AuthError("account_not_found", 404, "Conta não encontrada.");
      return { declared: true, version: state.adult_declaration_version, declaredAt: state.adult_declared_at, reused: state.reused };
    },
  });
}
