export function organizeGameUI(hud, doc = document) {
  const menu = doc.createElement('details');
  menu.className = 'game-utility-menu';
  const summary = doc.createElement('summary');
  summary.textContent = '☰ Menú';
  menu.appendChild(summary);
  const content = doc.createElement('div');
  content.className = 'game-utility-content';
  const stats = doc.createElement('button');
  stats.type = 'button'; stats.className = 'hud-btn';
  stats.textContent = '🌱 Cultivos e inventario';
  stats.addEventListener('click', () => { hud.togglePanel(); menu.open = false; });
  content.appendChild(stats);
  for (const id of ['hud-top', 'hud-bottom']) {
    const element = doc.getElementById(id);
    if (element) content.appendChild(element);
  }
  const goal = doc.createElement('div');
  goal.className = 'menu-goal';
  for (const id of ['farm-goal', 'farm-goal-progress']) {
    const element = doc.getElementById(id);
    if (element) goal.appendChild(element);
  }
  content.appendChild(goal);
  menu.appendChild(content);
  doc.getElementById('app').appendChild(menu);
  content.addEventListener('click', event => { if (event.target.closest('button')) menu.open = false; });
  doc.addEventListener('keydown', event => { if (event.code === 'Escape') menu.open = false; });
  return menu;
}
