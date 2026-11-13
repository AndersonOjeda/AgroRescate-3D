import { pestLevel } from '../simulation/pests.js';

export function updatePestPanel(state, doc = document) {
  const list = doc.getElementById('pest-status-list');
  if (!list) return;
  list.replaceChildren();
  for (const plot of Object.values(state.plots)) {
    const item = doc.createElement('li');
    const pressure = plot.pestPressure || 0;
    item.dataset.severity = pressure >= 70 ? 'critical' : pressure >= 40 ? 'high' : 'low';
    const label = doc.createElement('strong');
    label.textContent = plot.name;
    const status = doc.createElement('span');
    status.textContent = !plot.isPlanted ? 'Sin cultivo' : plot.isWithered ? 'Cultivo perdido · retira los restos' : `Plaga ${pestLevel(pressure)} · ${pressure}%`;
    const meter = doc.createElement('progress');
    meter.max = 100;
    meter.value = pressure;
    meter.setAttribute('aria-label', `Infestación de ${plot.name}`);
    const advice = doc.createElement('small');
    advice.textContent = !plot.isPlanted ? 'Prepara y siembra para empezar.' : plot.isWithered ? 'Mantén E en el lote para limpiar.' : plot.daysGrown >= plot.daysToMature ? 'Cosecha ya: esperar expone el cultivo.' : plot.pestProtectionDays > 0 ? `Control activo: ${plot.pestProtectionDays} días. Revisa la humedad.` : pressure >= 15 ? 'Mantén E en el lote: control manual (12 energía; 15 con calor).' : 'Revisa mañana. El calor y el estrés favorecen los focos.';
    item.append(label, status, meter, advice);
    list.appendChild(item);
  }
}
