const NUM_BARS = 80;

export async function extractWaveformPeaks(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new OfflineAudioContext(1, 1, 44100);
  let decoded: AudioBuffer;
  try {
    decoded = await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    return [];
  }

  const channelData = decoded.getChannelData(0);
  const blockSize = Math.floor(channelData.length / NUM_BARS);
  const peaks: number[] = [];

  for (let i = 0; i < NUM_BARS; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = start; j < start + blockSize; j++) {
      const abs = Math.abs(channelData[j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  const globalMax = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / globalMax);
}
