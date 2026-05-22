// @ts-ignore
import lamejs from "lamejs";

export async function wavBlobToMp3(wavBlob: Blob, kbps = 128): Promise<Blob> {
  const arrayBuffer = await wavBlob.arrayBuffer();
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const numChannels = Math.min(audioBuffer.numberOfChannels, 2) as 1 | 2;
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);

  const left = audioBuffer.getChannelData(0);
  const right = numChannels === 2 ? audioBuffer.getChannelData(1) : left;

  const blockSize = 1152;
  const mp3Chunks: ArrayBuffer[] = [];

  const pushChunk = (buf: { length: number; [i: number]: number }) => {
    if (buf.length === 0) return;
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i++) view[i] = buf[i];
    mp3Chunks.push(ab);
  };

  for (let i = 0; i < left.length; i += blockSize) {
    const l16 = toInt16(left.subarray(i, i + blockSize));
    const r16 = numChannels === 2 ? toInt16(right.subarray(i, i + blockSize)) : l16;
    pushChunk(numChannels === 2 ? encoder.encodeBuffer(l16, r16) : encoder.encodeBuffer(l16));
  }

  pushChunk(encoder.flush());

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

function toInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}
