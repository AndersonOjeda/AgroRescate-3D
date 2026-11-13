// Parámetros de jugabilidad, no recomendaciones agronómicas reales.
export const PEST_CONTROL_ENERGY = 12;
export const pestLevel = (pressure = 0) => pressure >= 70 ? 'crítica' : pressure >= 40 ? 'alta' : pressure >= 15 ? 'incipiente' : 'baja';

export function resetPests(plot) {
  plot.pestPressure = 0;
  plot.pestProtectionDays = 0;
  plot.pestTreatedDay = -1;
  plot.pestDamage = 0;
}

// La propagación usa una foto del día anterior: no depende del orden de las parcelas.
export function advancePests(plots, weatherId) {
  const list = Object.values(plots);
  const sources = list.filter(p => p.isPlanted && p.pestPressure >= 40);
  const alerts = [];
  for (const plot of list) {
    if (!plot.isPlanted) { resetPests(plot); continue; }
    const before = plot.pestPressure || 0;
    const protectedToday = plot.pestProtectionDays > 0;
    const spread = Math.min(16, sources.filter(p => p.id !== plot.id).length * 8);
    const climate = weatherId === 'heatwave' ? 8 : weatherId === 'rain' ? 4 : weatherId === 'frost' ? -8 : 0;
    const stress = plot.moisture > 85 || plot.moisture < 30 ? 7 : 0;
    const resistance = Math.max(0, plot.seedVariety?.healthResilienceBonus || 0) * 0.5;
    const growth = 18 + spread + climate + stress - resistance - (plot.composted ? 3 : 0);
    plot.pestPressure = Math.round(Math.max(0, Math.min(100, before + (protectedToday ? -16 : growth))));
    plot.pestProtectionDays = Math.max(0, (plot.pestProtectionDays || 0) - 1);
    // Una primera señal visible da tiempo para actuar antes del daño.
    const damage = plot.pestPressure < 30 ? 0 : Math.ceil((plot.pestPressure - 20) / 4);
    plot.pestDamage = (plot.pestDamage || 0) + damage;
    plot.health = Math.max(0, plot.health - damage);
    if (pestLevel(before) !== pestLevel(plot.pestPressure) && plot.pestPressure >= 15) {
      alerts.push(`${plot.name}: plaga ${pestLevel(plot.pestPressure)} (${plot.pestPressure}%). ${damage ? 'Está dañando el cultivo.' : 'Controla el foco antes del próximo día.'}`);
    }
  }
  return alerts;
}
