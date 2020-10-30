export class Timer {
  target: number;
  countDirection: 'down' | 'up';
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  running: boolean;
  timeIntervalRef: NodeJS.Timeout;

  constructor(target: number, countDirection: 'down' | 'up') {
    this.target = target;
    this.countDirection = countDirection;
    this.days = '--';
    this.hours = '--';
    this.minutes = '--';
    this.seconds = '--';
    this.running = false;
  }

  start() {
    this.running = true;
    this.timeIntervalRef = setInterval(() => {
      this.update();
    }, 1000);
  }

  stop() {
    this.running = false;
    clearInterval(this.timeIntervalRef);
  }

  update() {
    if ((this.countDirection === 'down' && Date.now() / 1e3 > this.target)
      || (this.countDirection === 'up' && Date.now() / 1e3 < this.target)) {
      this.stop();
      return;
    }

    const DAY = 24 * 60 * 60;
    const HOUR = 60 * 60;
    const MINUTE = 60;
    const now = Math.floor(Date.now() / 1e3);
    let days = Math.floor(Math.abs((now - this.target) / DAY)).toString();
    let hours = Math.floor(Math.abs((now - this.target) % DAY / HOUR)).toString();
    let minutes = Math.floor(Math.abs((now - this.target) % HOUR / MINUTE)).toString();
    let seconds = Math.floor(Math.abs((now - this.target) % MINUTE)).toString();

    this.days = days;
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
  }
}
