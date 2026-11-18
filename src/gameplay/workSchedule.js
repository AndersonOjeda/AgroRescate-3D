// El reloj solar usa 0.04 para las 06:00 y 0.72 para las 18:00.
export const WORK_START = 0.04 + 0.34 / 6;
export const WORK_END = 0.72;

export const isBedtime = time => Number.isFinite(time) && time >= WORK_END;
