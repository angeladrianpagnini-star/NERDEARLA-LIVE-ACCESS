class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.inputBuffer = [];
  }

  process(inputs) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const channel = input[0];

    // Copy samples because the AudioWorklet input buffer is reused.
    for (let i = 0; i < channel.length; i++) {
      this.inputBuffer.push(channel[i]);
    }

    const ratio = sampleRate / this.targetSampleRate;

    // Accumulate enough source audio to generate useful ~16 kHz chunks.
    if (this.inputBuffer.length < sampleRate / 10) {
      return true;
    }

    const outputLength = Math.floor(this.inputBuffer.length / ratio);
    const pcm16 = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      const sample1 = this.inputBuffer[index] ?? 0;
      const sample2 =
        this.inputBuffer[Math.min(index + 1, this.inputBuffer.length - 1)] ??
        sample1;

      const interpolated =
        sample1 + (sample2 - sample1) * fraction;

      const clamped = Math.max(-1, Math.min(1, interpolated));

      pcm16[i] =
        clamped < 0
          ? clamped * 0x8000
          : clamped * 0x7fff;
    }

    this.port.postMessage(
      {
        pcm: pcm16.buffer,
        sourceSampleRate: sampleRate,
        targetSampleRate: this.targetSampleRate,
        samples: pcm16.length,
      },
      [pcm16.buffer]
    );

    this.inputBuffer = [];

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
