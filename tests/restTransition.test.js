import { it, expect, vi, afterEach } from 'vitest';
import { withRestTransition } from '../src/ui/restTransition.js';

function fakeDocument() {
  const nodes = [];
  const doc = { nodes, createElement() {
    const classes = new Set();
    const node = {
      children: [],
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name)
      },
      setAttribute() {},
      appendChild(child) { this.children.push(child); },
      remove: vi.fn()
    };
    nodes.push(node);
    return node;
  } };
  doc.body = doc.createElement();
  return doc;
}

afterEach(() => vi.useRealTimers());

it('cambia el día con los ojos cerrados y espera antes de revelar el amanecer', async () => {
  vi.useFakeTimers();
  const doc = fakeDocument();
  let release;
  const action = vi.fn(() => {
    expect(doc.body.children[0].classList.contains('closed')).toBe(true);
    return new Promise(resolve => { release = resolve; });
  });
  const transition = withRestTransition(action, true, doc);
  await vi.advanceTimersByTimeAsync(1049);
  expect(action).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(action).toHaveBeenCalledTimes(1);
  const overlay = doc.body.children[0];
  await vi.advanceTimersByTimeAsync(5000);
  expect(overlay.classList.contains('closed')).toBe(true);
  release({ success: true });
  await vi.runAllTimersAsync();
  expect(await transition).toEqual({ success: true });
  expect(overlay.remove).toHaveBeenCalledTimes(1);
});
