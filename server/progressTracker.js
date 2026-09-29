export class ProgressTracker {
  constructor(totalSize) {
    this.totalSize = totalSize;
    this.lastUpdate = Date.now();
    this.lastBytes = 0;
    this.speed = 0;
    this.eta = 0;
    this.updateThreshold = 250; // milliseconds
  }

  reset(currentBytes = 0) {
    this.lastUpdate = Date.now();
    this.lastBytes = currentBytes;
    this.speed = 0;
    this.eta = 0;
  }

  shouldUpdate() {
    return Date.now() - this.lastUpdate >= this.updateThreshold;
  }

  update(bytesDownloaded) {
    if (!this.shouldUpdate()) return null;

    const now = Date.now();
    const elapsed = (now - this.lastUpdate) / 1000; // seconds
    const bytesDelta = bytesDownloaded - this.lastBytes;

    // Avoid division by zero in speed calculation
    if (elapsed > 0) {
      this.speed = bytesDelta / elapsed;
      const remaining = this.totalSize - bytesDownloaded;
      this.eta = this.speed > 0 ? remaining / this.speed : 0;
    }

    this.lastUpdate = now;
    this.lastBytes = bytesDownloaded;

    return { speed: this.speed, eta: this.eta };
  }
}
