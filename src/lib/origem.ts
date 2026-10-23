export const ehLiveEvento = (origem: string | null | undefined) => /live|evento/i.test(origem ?? "");
