import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { destinoSeguro } from '../../core/auth/auth.guard';
import { FormTrocaSenha } from '../../core/auth/senha/form-troca-senha';

// Conta com senha temporária (criada ou redefinida pelo admin) para aqui até trocar a senha.
@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-primeiro-acesso',
  imports: [FormTrocaSenha],
  templateUrl: './primeiro-acesso.html',
  styleUrl: './primeiro-acesso.scss',
})
export class PrimeiroAcesso {
  constructor(
    readonly auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  get nome(): string {
    const s = this.auth.sessao();
    return s?.nome || s?.username || '';
  }

  seguir() {
    this.router.navigateByUrl(destinoSeguro(this.route.snapshot.queryParamMap.get('voltar')));
  }

  sair() {
    this.auth.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
