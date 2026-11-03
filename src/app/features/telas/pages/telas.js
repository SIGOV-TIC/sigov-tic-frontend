"use strict";
(() => {
    montarLayout('dashboard', 'Dashboard');
    const KPIS = [
        { titulo: 'PROJETOS ATIVOS', valor: '12', nota: '+1 em planejamento' },
        { titulo: 'ORÇAMENTO EXECUTADO', valor: fmtMilhoes(soma(PROJETOS.map((p) => p.realizado))), nota: 'De R$ 39.7M autorizados' },
        { titulo: 'PROJETOS EM ATRASO', valor: String(PROJETOS.filter((p) => p.status === 'ATRASADO').length), nota: 'Atenção necessária' },
        { titulo: 'BENEFÍCIOS PLANEJADOS', valor: 'R$ 39.7M', nota: 'Economia estimada anual' },
    ];
    qs('#kpis').innerHTML = KPIS.map((k) => `<div class="card kpi"><small>${k.titulo}</small><b>${k.valor}</b><span>${k.nota}</span></div>`).join('');
    const top5 = [...PROJETOS].sort((a, b) => b.planejado - a.planejado).slice(0, 5);
    qs('#cronograma').innerHTML = top5
        .map((p) => `<tr><td>${esc(p.nome)}</td>${p.trimestres
        .map((on) => `<td class="q">${on ? '<span class="bar"></span>' : ''}</td>`)
        .join('')}</tr>`)
        .join('');
    qs('#top5').innerHTML = top5
        .map((p, i) => {
        const pct = p.realizado ? Math.round((p.realizado / p.planejado) * 100) : 0;
        const st = ROTULO_STATUS[p.status];
        return `<tr>
        <td class="rank">#${i + 1}</td>
        <td>${esc(p.nome)}</td>
        <td>${esc(p.area)}</td>
        <td><b>${fmtMilhoes(p.planejado)}</b></td>
        <td><div class="progress"><i><em style="width:${pct}%"></em></i>${pct}%</div></td>
        <td><span class="tag ${st.classe}">${st.texto}</span></td>
      </tr>`;
    })
        .join('');
    const AREAS = [
        { nome: 'Coordenação-Geral de TIC', qtd: 3, pct: 25, cor: '#3b82f6' },
        { nome: 'Diretoria de Tecnologia da Informação', qtd: 2, pct: 17, cor: '#22c55e' },
        { nome: 'GECOR', qtd: 1, pct: 8, cor: '#eab308' },
        { nome: 'GERED', qtd: 1, pct: 8, cor: '#ef4444' },
        { nome: 'Outras (5 áreas)', qtd: 5, pct: 40, cor: '#94a3b8', outras: true },
    ];
    const totalProjetos = AREAS.reduce((s, a) => s + a.qtd, 0);
    let acumulado = 0;
    const segmentos = AREAS.map((a) => {
        const fatia = (a.qtd / totalProjetos) * 100;
        const svg = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${a.cor}" stroke-width="3.2"
      stroke-dasharray="${Math.max(fatia - 1, 0)} ${100 - Math.max(fatia - 1, 0)}" stroke-dashoffset="${-acumulado}"/>`;
        acumulado += fatia;
        return svg;
    }).join('');
    qs('#donut').innerHTML = `<svg viewBox="0 0 42 42">${segmentos}</svg>
    <div class="center"><b>${totalProjetos}</b><small>PROJETOS</small></div>`;
    const hex2rgba = (hex, a) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    qs('#areas').innerHTML = AREAS.map((a) => `<div class="area${a.outras ? ' area--other' : ''}">
      <div class="fill" style="width:${a.pct}%;background:${hex2rgba(a.cor, 0.27)}"></div>
      <span class="dot" style="background:${a.cor}"></span>${esc(a.nome)}
      <span class="n">${a.qtd}</span><span class="p">${a.pct}%${a.outras ? ' &#9013;' : ''}</span>
    </div>`).join('');
})();
