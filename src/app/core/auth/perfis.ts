export type Perfil = 'ADMIN' | 'GESTOR_PROJETO' | 'USER';

// Perfis oferecidos na tela; o enum do backend ainda guarda outros, sem uso.
export const PERFIS: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador', descricao: 'Cria projetos e metas e gerencia contas' },
  { valor: 'GESTOR_PROJETO', rotulo: 'Gestor de projeto', descricao: 'PO ou Scrum Master; edita os projetos a que está vinculado' },
  { valor: 'USER', rotulo: 'Visualizador', descricao: 'Só consulta' },
];

export function rotuloPerfil(perfil: string): string {
  return PERFIS.find((p) => p.valor === perfil)?.rotulo ?? perfil;
}
