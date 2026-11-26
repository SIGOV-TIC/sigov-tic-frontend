export type Perfil = 'ADMIN' | 'ESCRITORIO' | 'PMO' | 'GESTOR_PROJETO' | 'SOLICITANTE' | 'USER';

// Perfis oferecidos na tela; o enum do backend ainda guarda outros, sem uso.
export const PERFIS: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador', descricao: 'Gerencia contas e perfis; não altera projetos' },
  { valor: 'ESCRITORIO', rotulo: 'Escritório de Projetos', descricao: 'Cria e edita projetos, metas e contas' },
  { valor: 'PMO', rotulo: 'PMO', descricao: 'Aprova ou recusa solicitações' },
  { valor: 'GESTOR_PROJETO', rotulo: 'Gestor de projeto', descricao: 'PO ou Scrum Master; edita os projetos a que está vinculado' },
  { valor: 'SOLICITANTE', rotulo: 'Solicitante', descricao: 'Consulta e abre solicitações' },
  { valor: 'USER', rotulo: 'Visualizador', descricao: 'Só consulta' },
];

export function rotuloPerfil(perfil: string): string {
  return PERFIS.find((p) => p.valor === perfil)?.rotulo ?? perfil;
}
