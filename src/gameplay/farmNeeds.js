export function getFarmNeed(state) {
  if (state.farmerEnergy < 20) return { title: 'Recupera fuerzas en la casa rural', reason: 'Necesitas energía para atender los cultivos.' };
  const plots = Object.values(state.plots);
  const lost = plots.find(p => p.isWithered);
  if (lost) return { title: `Retira los restos: ${lost.name}`, reason: 'Limpia el terreno para iniciar un nuevo ciclo.' };
  const dry = plots.find(p => p.isPlanted && p.moisture < 30);
  if (dry) return { title: `Revisa el riego: ${dry.name}`, reason: `Humedad ${dry.moisture}%. Atiende el agua antes de perder salud.` };
  const pest = plots.find(p => p.isPlanted && p.pestPressure >= 40 && p.pestTreatedDay !== state.day);
  if (pest) return { title: `Controla el foco: ${pest.name}`, reason: pest.pestAction?.label || 'Retira las plagas antes de que se propaguen.' };
  const ripe = plots.find(p => p.isPlanted && p.daysGrown >= p.daysToMature);
  if (ripe) return { title: `Cosecha: ${ripe.name}`, reason: 'El cultivo está listo. Esperar lo expone a nuevas pérdidas.' };
  const wet = plots.find(p => p.isPlanted && p.moisture > 85);
  if (wet) return { title: `Suspende el riego: ${wet.name}`, reason: 'El exceso de agua deteriora las raíces. Vigila la humedad.' };
  const poor = plots.find(p => p.isPlanted && p.fertility < 40);
  if (poor) return { title: `Mejora el suelo: ${poor.name}`, reason: 'Consulta el abonado disponible para su modalidad.' };
  const empty = plots.find(p => !p.isPlanted);
  if (empty) return { title: `${empty.isPrepared ? 'Siembra' : 'Prepara el terreno'}: ${empty.name}`, reason: empty.isPrepared ? 'Elige semillas acordes al presupuesto.' : 'Acércate y mantén E para trabajar.' };
  return { title: 'Vigila los cultivos hasta la cosecha', reason: 'Consulta humedad, salud y plagas. El tiempo sigue avanzando.' };
}

export function outsideInteraction(position, anchor, radius) {
  return Math.hypot(position.x - anchor.x, position.z - anchor.z) > radius;
}
