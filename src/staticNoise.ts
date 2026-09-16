/**
 * Band-passed white noise played between stations, like the dial static in-game.
 * The AudioContext is created lazily so it always starts from a user gesture.
 */
const LEVEL = 0.14

export class StaticNoise {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private volume = 1

  setVolume(volume: number) {
    this.volume = volume
    if (this.ctx && this.gain && this.source) {
      this.gain.gain.setTargetAtTime(LEVEL * volume, this.ctx.currentTime, 0.05)
    }
  }

  start() {
    const ctx = this.ensureContext()
    if (!ctx || !this.gain || this.source) return

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.7

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(filter).connect(this.gain)

    this.gain.gain.cancelScheduledValues(ctx.currentTime)
    this.gain.gain.setValueAtTime(LEVEL * this.volume, ctx.currentTime)
    source.start()
    this.source = source
  }

  stop(fadeSeconds = 0.25) {
    if (!this.ctx || !this.gain || !this.source) return
    const now = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds)
    this.source.stop(now + fadeSeconds)
    this.source = null
  }

  /** A short crackle, used when switching the radio off. */
  burst() {
    this.start()
    this.stop(0.3)
  }

  private ensureContext() {
    if (!this.ctx) {
      if (typeof AudioContext === 'undefined') return null
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }
}
