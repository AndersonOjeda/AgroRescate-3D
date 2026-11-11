// Generador de archivos WAV sintéticos limpios para Web Audio
import fs from 'fs';
import path from 'path';

function createWavBuffer({ numChannels = 1, sampleRate = 44100, durationSec = 1, generator }) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // FMT sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // DATA sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generator(t, i, numSamples)));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// 1. Sonido de bomba de agua / aspersor (burbujeo y aspersión rítmica de 2 segundos en bucle)
const pumpAudio = createWavBuffer({
  durationSec: 2.0,
  generator: (t) => {
    // Ruido con filtro pasobanda simulado + pulso rítmico de aspersor (4 Hz)
    const noise = Math.random() * 2 - 1;
    const pulse = Math.pow(Math.sin(2 * Math.PI * 4 * t), 2);
    const lowHum = Math.sin(2 * Math.PI * 60 * t) * 0.25;
    const spray = noise * (0.3 + 0.5 * pulse);
    return spray * 0.6 + lowHum;
  }
});

// 2. Sonido de éxito global (campanada arpegiada C5 -> E5 -> G5 -> C6 con decay exponencial)
const successAudio = createWavBuffer({
  durationSec: 1.5,
  generator: (t) => {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    let sample = 0;
    notes.forEach((freq, idx) => {
      const noteStart = idx * 0.12;
      if (t >= noteStart) {
        const noteT = t - noteStart;
        const envelope = Math.exp(-noteT * 4.5);
        sample += Math.sin(2 * Math.PI * freq * noteT) * envelope * 0.25;
        // Agregamos un armónico suave
        sample += Math.sin(2 * Math.PI * freq * 2 * noteT) * envelope * 0.08;
      }
    });
    return sample;
  }
});

// 3. Click de interacción
const clickAudio = createWavBuffer({
  durationSec: 0.1,
  generator: (t) => {
    const env = Math.exp(-t * 50);
    return Math.sin(2 * Math.PI * 880 * t) * env * 0.4;
  }
});

const outDir = path.resolve('public', 'audio');
fs.writeFileSync(path.join(outDir, 'pump.wav'), pumpAudio);
fs.writeFileSync(path.join(outDir, 'water.wav'), pumpAudio);
fs.writeFileSync(path.join(outDir, 'success.wav'), successAudio);
fs.writeFileSync(path.join(outDir, 'click.wav'), clickAudio);

console.log('Archivos de audio WAV generados exitosamente en public/audio');
