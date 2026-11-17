// Parámetros de jugabilidad, no recomendaciones agronómicas reales.
export const PEST_CONTROL_ENERGY = 12;
export const PEST_PROFILES = Object.freeze({
  subsistence: Object.freeze({ method: 'manual', label: 'retirar insectos y hojas afectadas', energy: 12, cost: 0, reduction: 55, protectionDays: 2, duration: 1.8, animation: 'plant' }),
  precision: Object.freeze({ method: 'traps', label: 'revisar y renovar trampas selectivas', energy: 8, cost: 1200, reduction: 70, protectionDays: 2, duration: 1.1, animation: 'action' }),
  ecological: Object.freeze({ method: 'ecological', label: 'sanear hojas y mantener barreras ecológicas', energy: 16, cost: 0, reduction: 45, protectionDays: 3, duration: 2.1, animation: 'compost' })
});

// Fuente compartida por simulación, HUD y acciones 3D. En integral manda la parcela.
export function getPestAction(plot, state) {
  const mode = state.mode === 'integrated' ? plot.modeAffinity : state.mode;
  const preferred = PEST_PROFILES[mode] || PEST_PROFILES.subsistence;
  const fallback = preferred.cost > (state.budget ?? 0);
  const profile = fallback ? PEST_PROFILES.subsistence : preferred;
  const energy = state.currentWeather?.id === 'heatwave' ? Math.ceil(profile.energy * 1.25) : profile.energy;
  return { ...profile, energy, fallback, label: profile.label + (fallback ? ' (respaldo manual sin presupuesto)' : '') };
}
export const pestLevel = (pressure = 0) => pressure >= 70 ? 'crítica' : pressure >= 40 ? 'alta' : pressure >= 15 ? 'incipiente' : 'baja';

export function resetPests(plot) {
  plot.pestPressure = 0;
  plot.pestProtectionDays = 0;
  plot.pestTreatedDay = -1;
  plot.pestDamage = 0;
  plot.trampledPlants = {};
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
    const ecological = plot.modeAffinity === 'ecological';
    const growth = 18 + spread + climate + stress - resistance - (plot.composted ? (ecological ? 6 : 3) : 0);
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
