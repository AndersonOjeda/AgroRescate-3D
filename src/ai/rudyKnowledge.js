import { fertilizerAdvice } from '../simulation/fertilizer.js';

export function answerGameRule(q, state) {
  if (!state) return null;
  const plots = Object.values(state.plots || {});
  const active = state.plots?.[state.activePlotId] || plots[0];
  const all = plots.flatMap(p => p.rows || [p]);
  const reply = (title, body, tips = []) => ({ title: `🐔 ${title}`, body, tips, spokenText: `${body} ${tips[0] || ''}` });
  if (/(plaga|bicho|insecto|hongo|fumig|enferm)/.test(q)) {
    const infested = all.filter(p => p.isPlanted && p.pestPressure >= 15);
    const tips = infested.slice().sort((a, b) => b.pestPressure - a.pestPressure).slice(0, 5).map(p => {
      if (p.isWithered) return `${p.name}: cultivo perdido. Retira los restos manteniendo E.`;
      if (p.daysGrown >= p.daysToMature) return `${p.name}: ${p.pestPressure}% de plaga y cosecha lista. Prioriza cosechar.`;
      if (p.pestTreatedDay === state.day || p.pestProtectionDays > 0) return `${p.name}: ${p.pestPressure}% de plaga; control activo. Espera y vigila antes de repetir.`;
      const action = p.pestAction;
      return `${p.name}: ${p.pestPressure}% de plaga. ${action?.label || 'Control manual'}${action ? `: ${action.energy} energía${action.cost ? ` y $${action.cost} COP` : ', sin gasto de dinero'}` : ''}. Guarda el abono con B si está equipado y mantén E en el surco.`;
    });
    return reply('Sanidad Vegetal: plagas en vivo', infested.length ? `Detecté ${infested.length} surcos con focos activos. Atiende primero los más afectados sin protección.` : 'No hay focos activos. No necesitas tratar ahora.', [...tips, 'Subsistencia: retirada manual. Precisión: trampas selectivas, o retirada manual si falta dinero. Ecológica: saneamiento y barreras.', 'El calor y el estrés hídrico favorecen la propagación. El control no devuelve la salud perdida.']);
  }
  if (/(objetivo|meta|ganar|gano|victoria|terminar|final|empezar|comenzar)/.test(q)) {
    const goal = state.goal;
    return reply('Tu misión en AgroRescate', goal ? goal.complete ? 'Ya completaste la meta económica. Puedes seguir cultivando o consultar Resultados.' : `Lleva el saldo a $${goal.target.toLocaleString('es-CO')} COP. Ahora tienes $${Math.round(state.budget).toLocaleString('es-CO')}; faltan $${Math.max(0, goal.target - state.budget).toLocaleString('es-CO')}.` : 'Prepara, siembra, cuida y cosecha para hacer prosperar la finca.', ['Empieza con un surco: mantén E para prepararlo y otra vez para sembrar.', 'Cada lote tiene cinco surcos independientes. El clima y el tiempo siguen avanzando mientras consultas menús.']);
  }
  if (/(no puedo|no me deja|bloquead|no funciona|por que no|porque no|sembrar|preparar|surco)/.test(q) && !/(abon|compost|fertil|compr|inventario|descans|dorm|riego|regar|humedad)/.test(q)) {
    if (!active) return null;
    const problems = [];
    if (active.isWithered) problems.push('Retira primero el cultivo perdido manteniendo E.');
    else if (active.isPlanted) problems.push(active.daysGrown >= active.daysToMature ? 'Ya está listo para cosechar: mantén E.' : `Ya está sembrado y crece (${active.daysGrown}/${active.daysToMature} días). No debes volver a sembrarlo.`);
    else if (!active.isPrepared) problems.push('Primero prepara la tierra de este surco manteniendo E.');
    else problems.push('La tierra está preparada: mantén E para sembrar.');
    if (state.farmerEnergy < (active.isPrepared ? active.laborProfile?.plantEnergy || 15 : active.laborProfile?.prepareEnergy || 20)) problems.push('La energía no alcanza para esa faena. Consulta cuándo puedes descansar.');
    if (!active.isPlanted && state.budget < state.seedCost) problems.push(`Falta saldo para las semillas: necesitas $${state.seedCost} COP para este surco.`);
    return reply(`Diagnóstico: ${active.name}`, problems.join(' '), ['B guarda el abono si quieres preparar, sembrar o cosechar.', 'Camina hacia otro surco para seleccionarlo. La barra indica cuál estás atendiendo.', 'Si sueltas E o te mueves antes de terminar, la faena se cancela sin completarse.']);
  }
  if (/(abono|abon|fertil|compost|nutriente|residuo)/.test(q)) {
    const advice = active ? fertilizerAdvice(active, active.modeAffinity || state.mode, state.fertilizerStock || {}) : null;
    return reply('Abono e inventario', `${active?.name || 'Surco actual'}: ${advice?.reason || 'Consulta el suelo antes de aplicar.'}`, [
      `Existencias: ${state.fertilizerStock?.compost || 0} dosis de compost, ${state.fertilizerStock?.nutrients || 0} de nutrientes y ${state.cropResidues || 0} residuos.`,
      'Equipa con B, acércate al surco y mantén E. Consume una dosis y energía; la fertilidad mejora en varios días.',
      state.compostBatch ? state.compostBatch.ready ? 'El compost ya maduró: recógelo en la compostera.' : `Tu compost estará listo el día ${state.compostBatch.readyDay}.` : 'La compostera convierte dos residuos en dos dosis después de dos días.',
      'El almacén vende compost a $2.500 y nutrientes a $4.500 COP. No compres si ya tienes existencias o una dosis actuando.'
    ]);
  }
  if (/(compr|almacen|inventario|mochila|material|semilla|dinero|plata|presupuesto|vender)/.test(q)) {
    const dry = all.filter(p => p.isPlanted && p.moisture < 30);
    return reply('Plan de recursos y compras', `Saldo actual: $${Math.round(state.budget || 0).toLocaleString('es-CO')} COP. ${dry.length ? 'Prioriza salvar los surcos con humedad crítica antes de ampliar la siembra.' : 'Siembra de forma escalonada para poder atender cada surco.'}`, [
      `Tienes ${state.ownSeedInventory || 0} semillas propias, ${state.fertilizerStock?.compost || 0} compost y ${state.fertilizerStock?.nutrients || 0} nutrientes.`,
      'Ve al almacén para elegir semillas y comprar dosis. Los menús se cierran al alejarte.',
      'Cada cosecha suma ingresos automáticamente al saldo. Llevarla al acopio también forma parte de las misiones.',
      state.compostBatch?.ready ? 'Antes de comprar compost, recoge el lote que ya está maduro.' : 'Reserva presupuesto para agua, cuidados y mantenimiento; no gastes todo en sembrar.'
    ]);
  }
  if (/(pis|aplast|dano|atraves|saltar|monticulo|subir)/.test(q)) return reply('Movimiento y protección del cultivo', 'Los lotes se suben automáticamente levantando la rodilla. Dentro caminas más despacio; pasa entre las hileras.', ['Pisar las plantas reduce su salud y cosecha. Las pasadas repetidas acumulan daño.', 'Quedarte quieto no causa daño. Las cajas y estructuras bloquean el paso.']);
  if (/(sol|reloj|orient|amanecer|atardecer|horizonte|este|oeste)/.test(q)) return reply('Orientación por el cielo', 'El sol sigue el reloj acelerado de la partida: amanecer al Este cerca de las 06:00, sol alto al mediodía y ocaso al Oeste cerca de las 18:00.', ['Mira el cielo con la cámara y observa las sombras. Las nubes pueden ocultar el sol.', 'El clima afecta a los surcos durante las consultas. No se controla manualmente con R.']);
  return null;
}
