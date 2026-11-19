// URL da foto de perfil (com a versão para o navegador não mostrar a antiga do cache).
export const urlFoto = (usuarioId: string, foto: { atualizadaEm: Date } | null | undefined) =>
  foto ? `/api/equipe/${usuarioId}/foto?v=${foto.atualizadaEm.getTime()}` : null;
