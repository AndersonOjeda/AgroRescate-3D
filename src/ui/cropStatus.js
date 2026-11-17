export function cropWarnings(plot, weather) {
  const warnings = [];
  if (!plot.isPlanted) return ['Sin cultivo: prepara la tierra y siembra.'];
  if (plot.isWithered) return ['Cultivo perdido: retira los restos.'];
  if (plot.moisture < 30) warnings.push('Humedad baja: revisa el riego.');
  if (plot.moisture > 85) warnings.push('Exceso de agua: suspende el riego.');
  if (plot.fertility < 40) warnings.push('Fertilidad baja: revisa el abonado de esta modalidad.');
  if (plot.health < 50) warnings.push('Salud deteriorada: atiende agua y plagas antes de avanzar.');
  if (Object.keys(plot.trampledPlants || {}).length) warnings.push('Daño por pisoteo: camina entre las hileras para proteger la cosecha.');
  if (plot.pestPressure >= 15) warnings.push(`Plagas ${plot.pestPressure}%: ${plot.pestAction?.label || 'revisa el foco'}.`);
  if (weather && ['storm', 'flood', 'frost', 'heatwave'].includes(weather.id)) warnings.push(`${weather.name}: ${weather.description}`);
  if (plot.daysGrown >= plot.daysToMature) warnings.push('Cosecha lista: recolecta antes de que se deteriore.');
  return warnings.length ? warnings : ['Cultivo estable. Continúa vigilando sus condiciones.'];
}

export function renderCropStatus(state, container, doc = document) {
  if (!container) return;
  container.replaceChildren();
  for (const plot of Object.values(state.plots)) {
    const card = doc.createElement('article');
    card.className = 'crop-status-card';
    const heading = doc.createElement('h4');
    heading.textContent = `${plot.name} · ${plot.cropName}`;
    const stage = doc.createElement('p');
    stage.textContent = `${plot.modeAffinity} · ${plot.stageLabel} · ${plot.daysGrown}/${plot.daysToMature} días · estimación ${plot.isPlanted ? plot.yieldKg : 0} kg`;
    card.append(heading, stage);
    for (const [key, label] of [['moisture', 'Humedad'], ['fertility', 'Fertilidad'], ['health', 'Salud']]) {
      const row = doc.createElement('label');
      row.textContent = `${label}: ${Math.round(plot[key])}%`;
      const meter = doc.createElement('progress');
      meter.max = 100;
      meter.value = plot[key];
      meter.setAttribute('aria-label', `${label} de ${plot.name}`);
      row.appendChild(meter);
      card.appendChild(row);
    }
    const list = doc.createElement('ul');
    for (const warning of cropWarnings(plot, state.currentWeather)) {
      const item = doc.createElement('li');
      item.textContent = warning;
      list.appendChild(item);
    }
    card.appendChild(list);
    container.appendChild(card);
  }
}
