export class Timer {
  target: number;
  hours: string;
  minutes: string;
  seconds: string;
  timeIntervalRef: NodeJS.Timeout;

  constructor(target: number) {
    this.target = target;
    this.hours = '--';
    this.minutes = '--';
    this.seconds = '--';
  }

  start() {
    this.timeIntervalRef = setInterval(() => {
      this.update();
    }, 1000);
  }

  stop() {
    clearInterval(this.timeIntervalRef);
  }

  update() {
    if (+this.hours === 0 && +this.minutes === 0 && +this.seconds === 0) {
      this.stop();
      return;
    }

    const HOUR = 60 * 60;
    const MINUTE = 60;
    const now = Math.floor(Date.now() / 1e3);
    let hours = Math.floor(Math.abs((now - this.target) / HOUR)).toString();
    if (hours.length < 2) {
      hours = `0${hours}`;
    }
    let minutes = Math.floor(Math.abs((now - this.target) % HOUR / MINUTE)).toString();
    if (minutes.length < 2) {
      minutes = `0${minutes}`;
    }
    let seconds = Math.floor(Math.abs((now - this.target) % MINUTE)).toString();
    if (seconds.length < 2) {
      seconds = `0${seconds}`;
    }
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
  }
}
