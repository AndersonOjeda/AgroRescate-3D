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

  // 4. Revisión de presupuesto y economía campesina
  if (budget < 12000) {
    score -= 8;
    priorities.push({
      severity: 'warning',
      label: `Presupuesto ajustado (${formatCop(budget)})`,
      detail: readyPlots.length > 0
        ? 'Vende tu cosecha lista en el Centro de Acopio para recuperar capital.'
        : 'Usa la Compostera Orgánica y labores manuales para evitar gastos extra.'
    });
  } else if (budget >= 65000 && emptyPlots.length > 0) {
    priorities.push({
      severity: 'info',
      label: `Capital disponible (${formatCop(budget)})`,
      detail: 'Tienes buen presupuesto para comprar semillas en el Centro de Acopio y ampliar siembra.'
    });
  }

  // 5. Recomendación según modalidad agrícola activa
  const modeAdviceMap = {
    SUBSISTENCE: {
      label: 'Estrategia Subsistencia',
      detail: 'Tu trabajo manual exige más energía y agua; descansa en la Casa Rural y usa compost para cuidar el suelo.'
    },
    PRECISION: {
      label: 'Estrategia Precisión IoT',
      detail: 'Aprovecha el microriego y revisa el Sensor IoT para ahorrar agua y reducir el desgaste físico.'
    },
    ECOLOGICAL: {
      label: 'Estrategia Ecológica',
      detail: 'Regenera fertilidad en la Compostera Orgánica y frena plagas con control biológico sin químicos.'
    },
    INTEGRATED: {
      label: 'Estrategia Integrada',
      detail: 'Equilibra riego eficiente, bioinsumos y vigilancia de plagas para maximizar sostenibilidad.'
    }
  };
  if (modeAdviceMap[state.mode]) {
    priorities.push({
      severity: 'success',
      ...modeAdviceMap[state.mode]
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
  } else if (top && top.severity === 'info') {
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

/**
 * Genera una recomendación automática estilo viñeta con voz según modo, clima,
 * presupuesto, energía y estado real de las parcelas.
 * Rota entre candidatos relevantes usando `recentKeys` para no repetir siempre el mismo aviso.
 */
export function generateAutoRudyBubble(state, dayPhase = 'Mañana', options = {}) {
  if (!state) {
    return {
      key: 'idle:welcome',
      urgency: 'normal',
      category: '🐔 Rudy',
      badge: 'Asesor Automático',
      title: '¡Kikirikí! Listo para asesorarte',
      message: 'Acércate a una parcela y mantén E para empezar a trabajar la tierra.',
      spokenText: 'Kikirikí. Acércate a una parcela y mantén E para empezar a trabajar la tierra.'
    };
  }

  const recentKeys = new Set(options.recentKeys || []);
  const plots = getPlotsList(state);
  const modeCfg = MODE_CONFIGS[state.mode] || {};
  const modeLabel = modeCfg.label || state.mode || 'Agrícola';
  const weather = state.currentWeather || { id: 'sunny', name: 'Soleado' };
  const energy = Math.round(state.farmerEnergy ?? 100);
  const waterReserve = Math.round(state.waterReserve ?? 0);
  const budget = Math.round(state.budget ?? 0);

  const plantedPlots = plots.filter((p) => p.isPlanted && !p.isWithered);
  const readyPlots = plantedPlots.filter((p) => p.daysGrown >= p.daysToMature);
  const witheredPlots = plots.filter((p) => p.isWithered);
  const emptyPlots = plots.filter((p) => !p.isPlanted && !p.isWithered);

  const candidates = [];

  if (energy <= 20) {
    candidates.push({
      key: 'energy:critical',
      urgency: 'critical',
      category: '⚡ Energía',
      badge: `Energía ${energy}%`,
      title: '¡Estás agotado!',
      message: `Solo te queda ${energy}% de energía. Ve a la Casa Rural y presiona E para cerrar los ojos y descansar.`,
      spokenText: `Kikirikí. Atención, solo te queda ${energy} por ciento de energía. Ve a la Casa Rural para descansar.`
    });
  } else if (energy <= 40 || dayPhase === 'Noche') {
    candidates.push({
      key: `energy:low:${dayPhase}`,
      urgency: 'warning',
      category: dayPhase === 'Noche' ? '🌙 Noche' : '⚡ Energía',
      badge: `${dayPhase} · ${energy}%`,
      title: dayPhase === 'Noche' ? 'Cayó la noche en la finca' : 'Energía campesina baja',
      message: `Con ${energy}% de energía en ${dayPhase.toLowerCase()}, te conviene descansar en la Casa Rural para rendir mejor.`,
      spokenText: `Kikirikí. Con ${energy} por ciento de energía, te recomiendo descansar en la Casa Rural.`
    });
  }

  for (const plot of plantedPlots) {
    if ((plot.pestPressure || 0) >= 40) {
      candidates.push({
        key: `pest:${plot.id}:high`,
        urgency: 'critical',
        category: '🐛 Plagas',
        badge: `${plot.name} · ${plot.pestPressure}%`,
        title: `¡Plaga fuerte en ${plot.name}!`,
        message: plot.pestAction
          ? `Acércate a ${plot.name} y mantén E para aplicar "${plot.pestAction.label}".`
          : `Atiende el brote en ${plot.name} antes de perder tu ${plot.cropName}.`,
        spokenText: `Kikirikí. Plaga fuerte en ${plot.name}. Acércate y mantén E para controlarla cuanto antes.`
      });
    } else if ((plot.pestPressure || 0) >= 15) {
      candidates.push({
        key: `pest:${plot.id}:mid`,
        urgency: 'warning',
        category: '🐛 Sanidad',
        badge: `${plot.name} · ${plot.pestPressure}%`,
        title: `Brote inicial en ${plot.name}`,
        message: `Hay ${plot.pestPressure}% de plaga en ${plot.cropName}. Trátalo pronto con E para evitar daños mayores.`,
        spokenText: `Kikirikí. Detecté un brote inicial de plaga en ${plot.name}. Trátalo pronto con la tecla E.`
      });
    }

    if (plot.moisture < 30) {
      candidates.push({
        key: `moisture:${plot.id}:low`,
        urgency: 'critical',
        category: '💧 Riego',
        badge: `${plot.name} · ${Math.round(plot.moisture)}%`,
        title: `¡${plot.cropName} con sed!`,
        message: `${plot.name} bajó a ${Math.round(plot.moisture)}% de humedad. Riega desde la Bomba de Agua al sur.`,
        spokenText: `Kikirikí. ${plot.name} está muy seca. Riega pronto desde la Bomba de Agua.`
      });
    } else if (plot.moisture > 85) {
      candidates.push({
        key: `moisture:${plot.id}:high`,
        urgency: 'warning',
        category: '💧 Humedad',
        badge: `${plot.name} · ${Math.round(plot.moisture)}%`,
        title: `Exceso de agua en ${plot.name}`,
        message: `Humedad en ${Math.round(plot.moisture)}%. No riegues por ahora para evitar hongos en la raíz.`,
        spokenText: `Kikirikí. ${plot.name} tiene exceso de humedad. Evita regar por ahora.`
      });
    }

    if (plot.fertility < 40) {
      candidates.push({
        key: `fertility:${plot.id}:low`,
        urgency: 'warning',
        category: '🌱 Suelo',
        badge: `${plot.name} · ${Math.round(plot.fertility)}%`,
        title: `Suelo agotado en ${plot.name}`,
        message: `Fertilidad en ${Math.round(plot.fertility)}%. Pasa por la Compostera Orgánica para nutrir la tierra.`,
        spokenText: `Kikirikí. El suelo de ${plot.name} necesita abono. Usa la Compostera Orgánica.`
      });
    }
  }

  if (readyPlots.length > 0) {
    const firstReady = readyPlots[0];
    candidates.push({
      key: `harvest:${firstReady.id}`,
      urgency: 'normal',
      category: '🌾 Cosecha',
      badge: `${firstReady.name} lista`,
      title: `¡${firstReady.cropName} lista para cosechar!`,
      message: `Mantén E sobre ${firstReady.name} para recoger tu cosecha y venderla en el Centro de Acopio.`,
      spokenText: `Kikirikí. Tu cosecha de ${firstReady.cropName} en ${firstReady.name} está lista. Recógela con la tecla E.`
    });
  }

  if (['storm', 'flood', 'frost', 'heatwave', 'rainy', 'drought'].includes(weather.id)) {
    const isRain = weather.id === 'rainy' || weather.id === 'storm' || weather.id === 'flood';
    candidates.push({
      key: `weather:${weather.id}`,
      urgency: ['storm', 'flood', 'frost', 'heatwave'].includes(weather.id) ? 'warning' : 'normal',
      category: '🌦️ Clima',
      badge: weather.name,
      title: `Clima actual: ${weather.name}`,
      message: isRain
        ? 'La lluvia ayuda a hidratar las parcelas; ahorra reserva de la bomba y vigila hongos.'
        : 'El calor y el clima seco evaporan rápido el agua. Revisa la humedad de tus cultivos.',
      spokenText: `Kikirikí. Clima ${weather.name}. ${isRain ? 'Aprovecha la lluvia y ahorra agua de la bomba.' : 'Vigila la humedad de tus cultivos.'}`
    });
  }

  if (budget < 12000) {
    candidates.push({
      key: 'budget:low',
      urgency: 'warning',
      category: '💰 Presupuesto',
      badge: formatCop(budget),
      title: 'Presupuesto ajustado',
      message: `Te quedan ${formatCop(budget)}. Apóyate en la Compostera y vende cosechas en el Centro de Acopio.`,
      spokenText: `Kikirikí. Tu presupuesto está ajustado en ${budget} pesos. Aprovecha el compost y vende cosechas.`
    });
  } else if (budget >= 65000 && emptyPlots.length > 0) {
    candidates.push({
      key: 'budget:high',
      urgency: 'normal',
      category: '💰 Capital',
      badge: formatCop(budget),
      title: 'Buen presupuesto para invertir',
      message: `Tienes ${formatCop(budget)} disponibles. Puedes comprar más semillas en el Centro de Acopio.`,
      spokenText: `Kikirikí. Tienes buen presupuesto de ${budget} pesos para invertir en semillas.`
    });
  }

  if (waterReserve < 150) {
    candidates.push({
      key: 'water:low',
      urgency: 'warning',
      category: '🚰 Reserva',
      badge: `${waterReserve} L`,
      title: 'Reserva de agua baja',
      message: `Solo quedan ${waterReserve} L en la bomba. Prioriza las parcelas más secas.`,
      spokenText: `Kikirikí. Quedan solo ${waterReserve} litros de agua. Cuida cada riego.`
    });
  }

  if (witheredPlots.length > 0) {
    candidates.push({
      key: `withered:${witheredPlots[0].id}`,
      urgency: 'warning',
      category: '🧹 Limpieza',
      badge: witheredPlots[0].name,
      title: `Limpia ${witheredPlots[0].name}`,
      message: `Hay restos marchitos en ${witheredPlots[0].name}. Mantén E encima para limpiar y volver a sembrar.`,
      spokenText: `Kikirikí. Limpia el cultivo marchito en ${witheredPlots[0].name} manteniendo E.`
    });
  }

  if (plantedPlots.length === 0 && emptyPlots.length > 0) {
    candidates.push({
      key: `empty:${emptyPlots[0].id}`,
      urgency: 'normal',
      category: '🌱 Siembra',
      badge: `${emptyPlots.length} libre(s)`,
      title: 'Parcelas listas para sembrar',
      message: `Acércate a ${emptyPlots[0].name} y mantén E para labrar con azadón y sembrar en modo ${modeLabel}.`,
      spokenText: `Kikirikí. Tienes parcelas vacías listas para labrar y sembrar en modo ${modeLabel}.`
    });
  }

  const modeTipById = {
    SUBSISTENCE: 'En Subsistencia el trabajo manual gasta más energía y agua: descansa a tiempo en la Casa Rural.',
    PRECISION: 'En Precisión IoT el microriego y el Sensor IoT te ayudan a ahorrar agua y esfuerzo.',
    ECOLOGICAL: 'En Ecológica la Compostera Orgánica y el control biológico mantienen el suelo vivo.',
    INTEGRATED: 'En Integrada combinas riego eficiente y bioinsumos para equilibrar costos y cosecha.'
  };
  candidates.push({
    key: `mode:${state.mode}`,
    urgency: 'normal',
    category: '🧭 Modo',
    badge: modeLabel,
    title: `Consejo de modo ${modeLabel}`,
    message: modeTipById[state.mode] || `Trabajas en modo ${modeLabel}. Revisa tus parcelas y el clima.`,
    spokenText: `Kikirikí. ${modeTipById[state.mode] || `Estás en modo ${modeLabel}.`}`
  });

  // Elegir primero una alerta crítica no repetida, luego cualquiera no repetida, y si todas se repitieron, la más urgente
  const fresh = candidates.filter((c) => !recentKeys.has(c.key));
  const pool = fresh.length > 0 ? fresh : candidates;
  const critical = pool.find((c) => c.urgency === 'critical');
  return critical || pool[0];
}
