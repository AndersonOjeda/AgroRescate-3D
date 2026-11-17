export const FERTILIZERS = Object.freeze({
  subsistence: { label: 'Abono compostado', stock: 'compost', energy: 8, gain: 4, days: 3, duration: 1.8 },
  precision: { label: 'Dosis medida de nutrientes', stock: 'nutrients', energy: 5, gain: 8, days: 2, duration: 1.2 },
  ecological: { label: 'Compost maduro', stock: 'compost', energy: 10, gain: 5, days: 4, duration: 2.1 }
});

export function fertilizerAdvice(plot, mode, stock = {}) {
  const profile = FERTILIZERS[mode] || FERTILIZERS.subsistence;
  const pending = plot.fertilizer?.remainingDays || 0;
  const reason = plot.isWithered ? 'Retira los restos antes de cuidar el suelo.' : pending ? `Abono actuando: ${pending} días restantes.${plot.fertilizer?.washed ? ' La lluvia redujo el aprovechamiento.' : ''}` : plot.fertility >= 85 ? 'Suelo fértil: no necesita abono.' : (stock[profile.stock] || 0) < 1 ? `Sin ${profile.label.toLowerCase()}: consigue una dosis.` : 'Conviene abonar este surco.';
  return { ...profile, gain: mode === 'precision' ? Math.min(profile.gain, Math.ceil(Math.max(0, 85 - plot.fertility) / profile.days)) : profile.gain, canApply: !pending && plot.fertility < 85 && (stock[profile.stock] || 0) >= 1 && !plot.isWithered, reason };
}

export function advanceFertilizer(plot, weatherId) {
  const effect = plot.fertilizer;
  if (!effect?.remainingDays) return;
  const washed = ['rain', 'storm', 'flood'].includes(weatherId);
  const gain = washed ? Math.max(1, Math.floor(effect.gain * 0.5)) : effect.gain;
  plot.fertility = Math.min(100, plot.fertility + gain);
  plot.composted = effect.stock === 'compost';
  effect.remainingDays--;
  effect.washed = washed;
}
