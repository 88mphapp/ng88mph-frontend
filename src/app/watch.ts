export class Watch {
  watching: boolean;
  address: string;

  constructor(watching: boolean, address: string) {
    this.watching = watching;
    this.address = address;
  }
}
