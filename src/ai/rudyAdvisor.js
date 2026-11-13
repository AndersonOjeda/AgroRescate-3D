import { MODE_CONFIGS } from '../simulation/constants.js';

export const RUDY_QUICK_QUESTIONS = [
  { id: 'now', label: '🌾 ¿Qué hago ahora?', query: '¿Qué debo hacer ahora en la finca?' },
  { id: 'water', label: '💧 Agua y Riego', query: '¿Cómo está la humedad y el riego?' },
  { id: 'pests', label: '🐛 Plagas y Suelo', query: '¿Hay plagas o problemas en el suelo?' },
  { id: 'modes', label: '🧭 Modos y Energía', query: '¿Cómo funciona mi modalidad y energía?' }
];

function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getPlotsList(state) {
  return Object.values(state?.plots || {});
}

function formatCop(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString('es-CO')} COP`;
}

/**
 * Analiza en vivo el estado de la finca y genera un diagnóstico agronómico priorizado.
 * Funciona 100% offline sin latencia ni consumo de APIs externas.
 */
export function analyzeFarmWithRudyAI(state, dayPhase = 'Mañana') {
  if (!state) {
    return {
      score: 100,
      urgency: 'normal',
      headline: '¡Kikirikí! Estoy lista para analizar tu finca.',
      summary: 'Aún no hay datos de parcelas cargados. Acércate a una parcela para comenzar.',
      tips: ['Camina con W, A, S, D y mantén E para trabajar la tierra.'],
      priorities: [],
      spokenText: 'Kikirikí. Estoy lista para analizar tu finca cuando comiences a trabajar.'
    };
  }

  const plots = getPlotsList(state);
  const priorities = [];
  const modeCfg = MODE_CONFIGS[state.mode] || {};
  const weather = state.currentWeather || { id: 'sunny', name: 'Soleado', description: '' };
  const energy = Math.round(state.farmerEnergy ?? 100);
  const waterReserve = Math.round(state.waterReserve ?? 0);
  const budget = Math.round(state.budget ?? 0);

  let score = 100;

  // 1. Revisión de energía campesina y ciclo del día
  if (energy <= 20) {
    score -= 22;
    priorities.push({
      severity: 'critical',
      label: `Energía crítica (${energy}%)`,
      detail: 'El cansancio campesino frena tu labor. Ve a la Casa Rural (E) para cerrar los ojos y reponer fuerzas.'
    });
  } else if (energy <= 40 || dayPhase === 'Noche') {
    score -= 10;
    priorities.push({
      severity: 'warning',
      label: dayPhase === 'Noche' ? `Anochece (${energy}% energía)` : `Energía baja (${energy}%)`,
      detail: 'Conviene pasar por la Casa Rural para descansar y preparar el amanecer.'
    });
  }

  // 2. Revisión de clima extremo
  if (['storm', 'flood', 'frost', 'heatwave'].includes(weather.id)) {
    score -= 12;
    priorities.push({
      severity: 'warning',
      label: `Alerta climática: ${weather.name}`,
      detail: weather.description || 'Vigila la humedad y evita riegos innecesarios.'
    });
  }

  // 3. Revisión parcela por parcela
  const plantedPlots = plots.filter((p) => p.isPlanted && !p.isWithered);
  const readyPlots = plantedPlots.filter((p) => p.daysGrown >= p.daysToMature);
  const witheredPlots = plots.filter((p) => p.isWithered);
  const emptyPlots = plots.filter((p) => !p.isPlanted && !p.isWithered);

  if (readyPlots.length > 0) {
    priorities.push({
      severity: 'info',
      label: `Cosecha madura (${readyPlots.map((p) => p.name).join(', ')})`,
      detail: 'Mantén E sobre la parcela madura para cosechar antes de que pierda calidad o atraiga plagas.'
    });
  }

  for (const plot of plantedPlots) {
    if ((plot.pestPressure || 0) >= 40) {
      score -= 18;
      priorities.push({
        severity: 'critical',
        label: `Plaga fuerte en ${plot.name} (${plot.pestPressure}%)`,
        detail: plot.pestAction
          ? `Acércate y mantén E para aplicar "${plot.pestAction.label}".`
          : 'Controla el foco de plaga en la parcela cuanto antes.'
      });
    } else if ((plot.pestPressure || 0) >= 15) {
      score -= 8;
      priorities.push({
        severity: 'warning',
        label: `Brote de plaga en ${plot.name} (${plot.pestPressure}%)`,
        detail: plot.pestAction
          ? `Puedes frenarlo ya manteniendo E ("${plot.pestAction.label}").`
          : 'Vigila la parcela para que no escale.'
      });
    }

    if (plot.moisture < 30) {
      score -= 16;
      priorities.push({
        severity: 'critical',
        label: `Estrés hídrico en ${plot.name} (${Math.round(plot.moisture)}%)`,
        detail: 'Riega desde la Bomba de Agua (sur) antes de que el cultivo se marchite.'
      });
    } else if (plot.moisture > 85) {
      score -= 6;
      priorities.push({
        severity: 'warning',
        label: `Exceso de humedad en ${plot.name} (${Math.round(plot.moisture)}%)`,
        detail: 'Suspende el riego para no ahogar las raíces ni favorecer hongos.'
      });
    }

    if (plot.fertility < 40) {
      score -= 10;
      priorities.push({
        severity: 'warning',
        label: `Suelo agotado en ${plot.name} (${Math.round(plot.fertility)}% fertilidad)`,
        detail: 'Prepara abono en la Compostera Orgánica (suroeste) o usa fertilizante.'
      });
    }
  }

  if (witheredPlots.length > 0) {
    score -= 15 * witheredPlots.length;
    priorities.push({
      severity: 'warning',
      label: `Cultivo marchito en ${witheredPlots.map((p) => p.name).join(', ')}`,
      detail: 'Mantén E sobre el lote para limpiar los restos y volver a preparar la tierra.'
    });
  }

  if (waterReserve < 150) {
    score -= 10;
    priorities.push({
      severity: 'warning',
      label: `Reserva hídrica baja (${waterReserve} L)`,
      detail: 'Prioriza riego por goteo o espera lluvias; cuida cada litro.'
    });
  }

  if (plantedPlots.length === 0 && emptyPlots.length > 0) {
    priorities.push({
      severity: 'info',
      label: 'Parcelas listas para trabajar',
      detail: 'Acércate a una parcela vacía y mantén E para preparar el terreno con el azadón y sembrar.'
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const hasCritical = priorities.some((p) => p.severity === 'critical');
  const hasWarning = priorities.some((p) => p.severity === 'warning');
  const urgency = hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal';

  // Ordenar por severidad: critical > warning > info > success
  const weight = { critical: 0, warning: 1, info: 2, success: 3 };
  priorities.sort((a, b) => (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3));

  const top = priorities[0];
  let headline = '¡Kikirikí! Finca estable y bajo control';
  if (urgency === 'critical') {
    headline = `🚨 Atención urgente: ${top.label}`;
  } else if (urgency === 'warning') {
    headline = `⚠️ Recomendación IA: ${top.label}`;
  } else if (top) {
    headline = `🌱 Sugerencia IA: ${top.label}`;
  }

  const modeLabel = modeCfg.label || state.mode;
  const summary =
    `Día ${state.day || 1} (${dayPhase}) · Modo ${modeLabel} · Clima: ${weather.name} · ` +
    `Salud de finca: ${score}/100 · Saldo: ${formatCop(budget)}.`;

  const tips = priorities.slice(0, 3).map((p) => `${p.label}: ${p.detail}`);
  if (tips.length === 0) {
    tips.push('Tus cultivos están equilibrados. Aprovecha el tiempo para revisar la comparativa o preparar compost.');
  }

  const spokenText = top
    ? `Kikirikí. Diagnóstico de Rudy: ${top.label}. ${top.detail}`
    : `Kikirikí. Todo marcha muy bien en tu finca en el día ${state.day || 1}.`;

  return {
    score,
    urgency,
    headline,
    summary,
    tips,
    priorities,
    spokenText
  };
}

/**
 * Responde preguntas del jugador en lenguaje natural usando el estado real de la finca.
 */
export function askRudyAI(question, state, dayPhase = 'Mañana') {
  const q = normalizeText(question);
  const analysis = analyzeFarmWithRudyAI(state, dayPhase);
  const plots = getPlotsList(state);
  const modeCfg = MODE_CONFIGS[state?.mode] || {};

  if (!q) {
    return {
      title: analysis.headline,
      body: analysis.summary,
      tips: analysis.tips,
      spokenText: analysis.spokenText
    };
  }

  if (/(agua|riego|regar|humedad|bomba|seco|seca|sequia|litro)/.test(q)) {
    const dry = plots.filter((p) => p.isPlanted && !p.isWithered && p.moisture < 45);
    const wet = plots.filter((p) => p.isPlanted && !p.isWithered && p.moisture > 80);
    const tips = plots.map(
      (p) => `${p.name}: ${Math.round(p.moisture)}% humedad${p.isPlanted ? ` (${p.cropName})` : ' (sin siembra)'}`
    );
    const advice =
      dry.length > 0
        ? `Riega cuanto antes ${dry.map((p) => p.name).join(', ')} desde la Bomba de Agua al sur.`
        : wet.length > 0
          ? `Suspende el riego en ${wet.map((p) => p.name).join(', ')} para evitar encharcamiento.`
          : 'Todas las parcelas tienen humedad adecuada por ahora.';
    return {
      title: `💧 Análisis Hídrico (Reserva: ${Math.round(state?.waterReserve ?? 0)} L)`,
      body: `${advice} En modo ${modeCfg.label || state?.mode}, el consumo de agua depende de tu técnica de riego.`,
      tips,
      spokenText: `Kikirikí. Tienes ${Math.round(state?.waterReserve ?? 0)} litros de agua. ${advice}`
    };
  }

  if (/(plaga|bicho|insecto|hongo|fumig|enferm|suelo|abono|fertil|compost)/.test(q)) {
    const infested = plots.filter((p) => (p.pestPressure || 0) >= 15);
    const lowFert = plots.filter((p) => p.isPlanted && p.fertility < 50);
    const tips = [];
    if (infested.length > 0) {
      for (const p of infested) {
        tips.push(`🐛 ${p.name}: ${p.pestPressure}% plaga — ${p.pestAction?.label || 'controlar con E'}.`);
      }
    } else {
      tips.push('✅ Sin focos activos de plagas en este momento.');
    }
    if (lowFert.length > 0) {
      tips.push(`🌱 Fertilidad baja en ${lowFert.map((p) => p.name).join(', ')}. Usa la Compostera Orgánica.`);
    } else {
      tips.push('🌿 La fertilidad del suelo está en buen rango.');
    }
    const body =
      infested.length > 0
        ? `Detecté ${infested.length} parcela(s) con plagas. Acércate y mantén E para controlarlas antes de perder cosecha.`
        : 'Tu suelo y sanidad vegetal están estables. Mantén el equilibrio entre humedad y abono.';
    return {
      title: '🐛 Sanidad Vegetal y Suelo',
      body,
      tips,
      spokenText: `Kikirikí. ${body}`
    };
  }

  if (/(energi|cansad|descans|dormir|casa|fatiga|ojos|noche|dia|hora|clima|lluvia|helada)/.test(q)) {
    const energy = Math.round(state?.farmerEnergy ?? 100);
    const weather = state?.currentWeather?.name || 'Soleado';
    const body =
      `Estamos en ${dayPhase} del Día ${state?.day || 1} con clima ${weather} y ${energy}% de energía campesina. ` +
      `El tiempo avanza de forma continua (Mañana, Mediodía, Tarde y Noche).`;
    return {
      title: '🏡 Energía Campesina, Clima y Tiempo',
      body,
      tips: [
        'Cuando tu energía baje o llegue la noche, entra a la Casa Rural (E) y cierra los ojos para descansar.',
        'Puedes recuperar fuerzas sin cambiar de día o dormir hasta el amanecer siguiente.',
        'Las labores con azadón, siembra y cosecha exigen más esfuerzo según la modalidad agrícola.'
      ],
      spokenText: `Kikirikí. Estás en ${dayPhase} con ${energy} por ciento de energía y clima ${weather}. Visita la Casa Rural cuando necesites descansar.`
    };
  }

  if (/(modo|modalidad|subsistencia|precision|iot|ecologic|integrad|diferencia|comparar|dinero|plata|presupuesto|vender|cosecha)/.test(q)) {
    const labor = modeCfg.laborProfile;
    const tips = [
      'Subsistencia: trabajo manual exigente, mayor gasto de agua y menor costo inicial.',
      'Precisión IoT: riego eficiente y sensores con menor desgaste físico.',
      'Ecológica: regenera el suelo con compost y controla plagas de forma biológica.',
      'Integrada: combina eficiencia hídrica, bioinsumos y rendimiento equilibrado.'
    ];
    if (labor) {
      tips.unshift(`Tu modo actual (${modeCfg.label}): ${labor.description}`);
    }
    return {
      title: `🧭 Modalidades y Economía (${formatCop(state?.budget ?? 0)})`,
      body: 'Cada tipo de agricultura cambia el esfuerzo campesino, el uso de agua, las plagas y el retorno económico.',
      tips,
      spokenText: `Kikirikí. Estás en modo ${modeCfg.label || state?.mode} con saldo de ${Math.round(state?.budget ?? 0)} pesos.`
    };
  }

  if (/(control|tecla|mover|caminar|jugar|como|boton)/.test(q)) {
    return {
      title: '🎮 Controles Rápidos de AgroRescate 3D',
      body: 'Muévete libremente por la finca y mantén E para realizar las labores campesinas reales.',
      tips: [
        'W, A, S, D: caminar · Shift: correr · Ratón: girar cámara.',
        'Mantén E cerca de parcelas para cavar con azadón, sembrar, tratar plagas o cosechar.',
        'Usa E en Bomba, Compostera, Sensor IoT, Centro de Acopio y Casa Rural.'
      ],
      spokenText: 'Kikirikí. Camina con W A S D, corre con Shift y mantén E cerca de parcelas o estaciones para trabajar.'
    };
  }

  if (/(que hago|ahora|consejo|ayuda|resumen|diagnostico|prioridad)/.test(q)) {
    return {
      title: analysis.headline,
      body: analysis.summary,
      tips: analysis.tips,
      spokenText: analysis.spokenText
    };
  }

  // Respuesta fallback inteligente con diagnóstico en vivo
  return {
    title: `🐔 Rudy IA responde sobre "${question.slice(0, 36)}"`,
    body: `${analysis.headline}. ${analysis.summary}`,
    tips: analysis.tips,
    spokenText: analysis.spokenText
  };
}
