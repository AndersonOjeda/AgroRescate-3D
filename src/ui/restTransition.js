export async function withRestTransition(action, sleep, doc = document) {
  const overlay = doc.createElement('div');
  overlay.className = 'rest-eyes';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const vignette = doc.createElement('div');
  vignette.className = 'rest-eyes-vignette';

  const lidTop = doc.createElement('div');
  lidTop.className = 'rest-eyes-lid rest-eyes-lid-top';

  const lidBottom = doc.createElement('div');
  lidBottom.className = 'rest-eyes-lid rest-eyes-lid-bottom';

  const card = doc.createElement('div');
  card.className = 'rest-eyes-card';

  const icon = doc.createElement('div');
  icon.className = 'rest-eyes-icon';
  icon.textContent = sleep ? '🌙' : '☕';

  const message = doc.createElement('span');
  message.className = 'rest-eyes-title';
  message.textContent = sleep ? 'Cerrando los ojos… Hasta el amanecer.' : 'Cerrando los ojos… Recuperando fuerzas.';

  const subtitle = doc.createElement('small');
  subtitle.className = 'rest-eyes-sub';
  subtitle.textContent = sleep ? 'Descansando profundamente en la Casa Rural' : 'Tomando un respiro en el corredor';

  const breathBar = doc.createElement('div');
  breathBar.className = 'rest-eyes-progress';
  const breathFill = doc.createElement('div');
  breathFill.className = 'rest-eyes-progress-fill';
  breathBar.appendChild(breathFill);

  card.appendChild(icon);
  card.appendChild(message);
  card.appendChild(subtitle);
  card.appendChild(breathBar);

  overlay.appendChild(vignette);
  overlay.appendChild(lidTop);
  overlay.appendChild(lidBottom);
  overlay.appendChild(card);
  doc.body.appendChild(overlay);

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    await wait(30);
    // Primer parpadeo pesado (somnolencia)
    overlay.classList.add('drowsy');
    await wait(320);
    // Cierre completo y suave de párpados
    overlay.classList.add('closed');
    await wait(700);
    await action();
    overlay.classList.add('restored');
    icon.textContent = sleep ? '🌅' : '✨';
    message.textContent = sleep ? 'Un nuevo día en la casa rural…' : '¡Energía renovada! Listo para volver al campo…';
    subtitle.textContent = sleep ? 'Abriendo los ojos con el primer sol' : 'Fuerzas recuperadas';
    await wait(650);
  } finally {
    overlay.classList.remove('closed');
    overlay.classList.add('waking');
    await wait(520);
    overlay.classList.remove('drowsy');
    await wait(320);
    overlay.remove();
  }
}
