export class Duration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;

  constructor(
    years: number,
    months: number,
    days: number,
    hours: number,
    minutes: number,
    seconds: number,
  ) {
    this.years = years;
    this.months = months;
    this.days = days;
    this.hours = hours;
    this.minutes = minutes;
    this.seconds = seconds;
  }

  [Symbol.toPrimitive](hint: string) {
    if (hint === 'number')
      return (
        this.seconds +
        60 * this.minutes +
        60 * 60 * this.hours +
        60 * 60 * 24 * this.days +
        60 * 60 * 24 * 30.4375 * this.months +
        60 * 60 * 24 * 365.25 * this.years
      );
    return null;
  }
}
