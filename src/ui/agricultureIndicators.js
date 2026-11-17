export function hasPrecisionIndicators(state, plot) {
  return (state.mode === 'integrated' ? plot.modeAffinity : state.mode) === 'precision';
}

export function fieldObservation(plot) {
  if (!plot.isPlanted) return 'Tierra preparada para sembrar' + (plot.isPrepared ? '.' : ': primero debes labrar.');
  if (plot.isWithered) return 'Plantas secas o perdidas: retira los restos.';
  const observations = [];
  observations.push(plot.moisture < 30 ? 'Tierra seca' : plot.moisture > 85 ? 'Tierra encharcada' : 'Tierra húmeda');
  observations.push(plot.fertility < 40 ? 'Suelo agotado' : 'Suelo con buen aspecto');
  observations.push(plot.health < 50 ? 'Plantas debilitadas' : 'Plantas vigorosas');
  if (plot.pestPressure >= 15) observations.push('Insectos visibles: revisa el cultivo');
  if (plot.fertilizer?.remainingDays) observations.push('Abono actuando: espera');
  return observations.join(' · ') + '.';
}
