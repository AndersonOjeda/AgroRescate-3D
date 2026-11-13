import { cropWarnings } from './cropStatus.js';

let lastSignature = '';
let lastDocument = null;
export function updatePestPanel(state, doc = document) {
  const list = doc.getElementById('pest-status-list');
  if (!list || !state?.plots) return;
  const signature = JSON.stringify([state.day, state.farmerEnergy, state.restAvailability, state.currentWeather, state.activePlotId, state.plots, state.fertilizerStock, state.cropResidues, state.compostBatch]);
  if (lastDocument === doc && lastSignature === signature) return;
  lastDocument = doc;
  lastSignature = signature;
  for (const [id, allowed, reason] of [['btn-house-rest', state.restAvailability?.canRest, state.restAvailability?.restReason], ['btn-house-sleep', state.restAvailability?.canSleep, state.restAvailability?.sleepReason]]) {
    const button = doc.getElementById(id);
    if (button) {
      button.disabled = !allowed;
      button.title = reason || '';
      if (id === 'btn-house-rest' && state.restAvailability?.restLabel) button.textContent = state.restAvailability.restLabel;
    }
  }
  list.replaceChildren();
  const inventory = doc.getElementById('fertilizer-stock');
  if (inventory && state.fertilizerStock) inventory.textContent = `Abonos: ${state.fertilizerStock.compost} compost · ${state.fertilizerStock.nutrients} nutrientes · ${state.cropResidues} residuos${state.compostBatch ? state.compostBatch.ready ? ' · Compost listo para recoger' : ` · Madura el día ${state.compostBatch.readyDay}` : ''}`;
  const weather = doc.getElementById('live-crop-weather');
  if (weather) weather.textContent = (state.currentWeather?.icon || '') + ' ' + (state.currentWeather?.name || 'Despejado');
  for (const plot of Object.values(state.plots)) {
    const isCritical = plot.isWithered || plot.health < 30 || plot.pestPressure >= 70;
    const isHigh = !isCritical && (plot.pestPressure >= 40 || plot.moisture < 35 || plot.fertility < 35);
    const severity = isCritical ? 'critical' : isHigh ? 'high' : 'low';

    const item = doc.createElement('li');
    item.dataset.severity = severity;
    if (plot.id === state.activePlotId) {
      item.classList.add('is-active-plot');
    }

    const headerRow = doc.createElement('div');
    headerRow.className = 'live-plot-head';
    const label = doc.createElement('strong');
    label.textContent = plot.name;
    const statusBadge = doc.createElement('span');
    statusBadge.className = `live-plot-badge severity-${severity}`;
    statusBadge.textContent = isCritical ? '⚠️ Crítico' : isHigh ? '⚡ Atención' : '✓ Estable';
    headerRow.appendChild(label);
    headerRow.appendChild(statusBadge);
    item.appendChild(headerRow);

    if (plot.rows) {
      const rows = doc.createElement('small');
      rows.className = 'live-plot-rows';
      rows.textContent = plot.rows.map((row, index) => `${index === plot.selectedRow ? '▶' : ''}${index + 1}:${row.isWithered ? 'perdido' : row.isPlanted ? row.daysGrown >= row.daysToMature ? 'listo' : 'crece' : row.isPrepared ? 'preparado' : 'tierra'}`).join(' · ');
      item.appendChild(rows);
    }

    const metrics = doc.createElement('div');
    metrics.className = 'live-crop-metrics';
    for (const [key, icon, name] of [
      ['moisture', '💧', 'Humedad'],
      ['fertility', '🌱', 'Fertilidad'],
      ['health', '❤️', 'Salud']
    ]) {
      const val = Math.max(0, Math.min(100, Math.round(plot[key] ?? 0)));
      const level = val < 30 ? 'crit' : val < 55 ? 'warn' : 'ok';

      const metric = doc.createElement('div');
      metric.className = `metric-stat metric-${key} level-${level}`;

      const head = doc.createElement('div');
      head.className = 'metric-stat-head';
      const titleSpan = doc.createElement('span');
      titleSpan.textContent = `${icon} ${name}`;
      const valSpan = doc.createElement('strong');
      valSpan.textContent = `${val}%`;
      head.appendChild(titleSpan);
      head.appendChild(valSpan);

      const track = doc.createElement('div');
      track.className = 'metric-bar-track';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `${name} de ${plot.name}`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(val));

      const fill = doc.createElement('div');
      fill.className = 'metric-bar-fill';
      fill.style.width = `${val}%`;
      track.appendChild(fill);

      metric.appendChild(head);
      metric.appendChild(track);
      metrics.appendChild(metric);
    }
    item.appendChild(metrics);

    const notice = doc.createElement('small');
    notice.className = 'live-plot-notice';
    const warning = cropWarnings(plot, state.currentWeather)[0];
    notice.textContent = warning;
    if (plot.fertilizerAdvice) notice.textContent += ` ${plot.fertilizerAdvice.reason}`;
    notice.title = cropWarnings(plot, state.currentWeather).join(' ');
    item.appendChild(notice);
    list.appendChild(item);
  }
  const active = state.plots[state.activePlotId];
  if (active) for (const key of ['moisture', 'fertility', 'health']) {
    const bar = doc.getElementById('player-crop-' + key);
    const value = doc.getElementById('player-crop-' + key + '-value');
    if (bar) bar.value = active[key];
    if (value) value.textContent = Math.round(active[key]) + '%';
  }
  const energy = doc.getElementById('house-energy-val');
  if (energy) energy.textContent = (state.farmerEnergy ?? 100) + '%';
  const day = doc.getElementById('house-day-val');
  if (day) day.textContent = 'Día ' + state.day;
  const summary = doc.getElementById('house-crop-status');
  if (summary) summary.textContent = 'Las barras y alertas de tus tres lotes permanecen visibles en el tablero en vivo.';
}
