import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { FormTrocaSenha } from '../../../core/auth/senha/form-troca-senha';

const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp'];
const LADO_FOTO = 256;

// Reduz a imagem escolhida a um quadrado centralizado de 256 px, em JPEG, para caber folgado no limite da API.
export function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = LADO_FOTO;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas indisponível'));
      ctx.drawImage(
        img,
        (img.naturalWidth - lado) / 2,
        (img.naturalHeight - lado) / 2,
        lado,
        lado,
        0,
        0,
        LADO_FOTO,
        LADO_FOTO,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-configuracoes',
  imports: [FormsModule, MatIconModule, FormTrocaSenha],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.scss',
})
export class Configuracoes implements OnInit {
  nome = '';
  cargo = '';
  readonly foto = signal('');
  readonly erro = signal('');
  readonly salvo = signal(false);
  readonly salvando = signal(false);

  // Trocável nos testes: o canvas não existe fora do navegador.
  reduzir = reduzirFoto;

  private readonly formSenha = viewChild(FormTrocaSenha);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  constructor(readonly auth: AuthService) {}

  get login(): string {
    return this.auth.sessao()?.username ?? '';
  }

  get iniciais(): string {
    return (this.nome || this.login).slice(0, 2).toUpperCase();
  }

  ngOnInit() {
    // "Trocar senha" no menu do usuário abre esta tela em #senha, já com o cursor no primeiro campo.
    this.route?.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((f) => {
      if (f === 'senha') setTimeout(() => this.irParaSenha());
    });
    this.preencher(this.auth.sessao());
    // A sessão guardada pode não ter foto nem cargo (login antigo): a API tem a versão atual.
    this.auth.perfilAtual().subscribe({
      next: (u) => this.preencher({ nome: u.nome, cargo: u.cargo ?? undefined, foto: u.foto ?? undefined }),
      error: () => undefined,
    });
  }

  irParaSenha() {
    this.host.nativeElement.querySelector('#senha')?.scrollIntoView?.({ block: 'start' });
    this.formSenha()?.focar();
  }

  private preencher(dados: { nome?: string; cargo?: string; foto?: string } | null) {
    this.nome = dados?.nome ?? '';
    this.cargo = dados?.cargo ?? '';
    this.foto.set(dados?.foto ?? '');
  }

  async escolherFoto(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (!arquivo) return;
    this.salvo.set(false);
    if (!TIPOS_FOTO.includes(arquivo.type)) {
      this.erro.set('Escolha uma imagem PNG, JPEG ou WebP.');
      return;
    }
    try {
      this.foto.set(await this.reduzir(arquivo));
      this.erro.set('');
    } catch {
      this.erro.set('Não foi possível ler essa imagem.');
    }
  }

  removerFoto() {
    this.foto.set('');
    this.salvo.set(false);
  }

  salvar() {
    this.salvo.set(false);
    if (!this.nome.trim()) {
      this.erro.set('Informe o nome.');
      return;
    }
    this.erro.set('');
    this.salvando.set(true);
    this.auth
      .atualizarPerfil({ nome: this.nome.trim(), cargo: this.cargo.trim() || null, foto: this.foto() || null })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.salvo.set(true);
        },
        error: (e: HttpErrorResponse) => {
          this.salvando.set(false);
          this.erro.set(
            e.status === 400 && e.error?.message
              ? e.error.message
              : 'Não foi possível salvar. Verifique a conexão e tente de novo.',
          );
        },
      });
  }
}
