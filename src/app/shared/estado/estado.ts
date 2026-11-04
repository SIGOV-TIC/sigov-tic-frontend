import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// Carregando, vazio ou erro de uma tela que depende da API. No vazio, o conteúdo projetado
// (um link, um botão) aparece abaixo da mensagem.
@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-estado',
  imports: [MatIconModule],
  templateUrl: './estado.html',
  styleUrl: './estado.scss',
})
export class EstadoTela {
  readonly tipo = input.required<'carregando' | 'vazio' | 'erro'>();
  readonly mensagem = input('');
  readonly icone = input('');
  readonly tentar = output<void>();
}
