import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Feedback {
  id: string;
  texto: string;
  tela?: string;
  usuario: string;
  tema?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly url = '/api/feedback';

  constructor(private http: HttpClient) {}

  listar(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.url);
  }

  // Usuário e data são registrados pela API; a tela e o tema vão daqui.
  enviar(texto: string, tela: string, tema: string): Observable<Feedback> {
    return this.http.post<Feedback>(this.url, { texto, tela, tema });
  }
}
