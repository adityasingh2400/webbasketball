import { Container, Graphics } from 'pixi.js';
import type { ShotMeterConfig } from '../../types';

const DEFAULT_CONFIG: ShotMeterConfig = {
  width: 60,
  height: 8,
  oscillationSpeed: 2.5,
  sweetSpotMin: 0.75,
  sweetSpotMax: 0.95,
  colors: {
    low: 0xff4444,
    mid: 0xffff44,
    high: 0x44ff44,
    perfect: 0x00ffff
  }
};

export default class ShotMeter {
  private container: Container;
  private background: Graphics;
  private fill: Graphics;
  private sweetSpotIndicator: Graphics;
  private value: number = 0;
  private direction: number = 1;
  private isActive: boolean = false;
  private config: ShotMeterConfig;

  constructor(config?: Partial<ShotMeterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.container = new Container();

    this.background = new Graphics();
    this.background.roundRect(0, 0, this.config.width, this.config.height, 4);
    this.background.fill({ color: 0x333333 });
    this.background.stroke({ color: 0xffffff, width: 1 });
    this.container.addChild(this.background);

    this.fill = new Graphics();
    this.container.addChild(this.fill);

    this.sweetSpotIndicator = new Graphics();
    const sweetSpotStart = this.config.width * this.config.sweetSpotMin;
    const sweetSpotWidth = this.config.width * (this.config.sweetSpotMax - this.config.sweetSpotMin);
    this.sweetSpotIndicator.rect(sweetSpotStart, 0, sweetSpotWidth, this.config.height);
    this.sweetSpotIndicator.fill({ color: 0xffffff, alpha: 0.3 });
    this.container.addChild(this.sweetSpotIndicator);

    this.updateFill();
  }

  getContainer(): Container {
    return this.container;
  }

  start(): void {
    this.value = 0;
    this.direction = 1;
    this.isActive = true;
  }

  stop(): number {
    this.isActive = false;
    return this.value;
  }

  update(deltaTime: number): void {
    if (!this.isActive) {
      return;
    }

    this.value += this.direction * this.config.oscillationSpeed * deltaTime;

    if (this.value >= 1) {
      this.value = 1;
      this.direction = -1;
    } else if (this.value <= 0) {
      this.value = 0;
      this.direction = 1;
    }

    this.updateFill();
  }

  private updateFill(): void {
    this.fill.clear();

    let color: number;
    if (this.value < 0.5) {
      color = this.config.colors.low;
    } else if (this.value < 0.75) {
      color = this.config.colors.mid;
    } else if (this.value < 0.95) {
      color = this.config.colors.high;
    } else {
      color = this.config.colors.perfect;
    }

    const fillWidth = this.config.width * this.value;
    this.fill.roundRect(0, 0, fillWidth, this.config.height, 4);
    this.fill.fill({ color });
  }

  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  getValue(): number {
    return this.value;
  }

  isInSweetSpot(): boolean {
    return this.value >= this.config.sweetSpotMin && this.value <= this.config.sweetSpotMax;
  }

  destroy(): void {
    this.background.destroy();
    this.fill.destroy();
    this.sweetSpotIndicator.destroy();
    this.container.destroy();
  }
}
