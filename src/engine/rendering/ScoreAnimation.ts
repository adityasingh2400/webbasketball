import { Container, Text, TextStyle } from 'pixi.js';

const SCORE_FONT_SIZE = 72;
const POPUP_FONT_SIZE = 36;
const ANIMATION_DURATION = 800;
const FLOAT_DISTANCE = 60;
const INITIAL_POOL_SIZE = 3;

function easeOutCubic(t: number): number {
  const mt = 1 - t;
  return 1 - mt * mt * mt;
}

export default class ScoreAnimation {
  private container: Container;
  private scoreText: Text;
  private popupPool: Text[] = [];
  private activePopups: Array<{
    text: Text;
    startTime: number;
    startY: number;
  }> = [];
  private scaleAnimation: {
    active: boolean;
    startTime: number;
    startScale: number;
  } = {
    active: false,
    startTime: 0,
    startScale: 1,
  };

  constructor() {
    this.container = new Container();

    const scoreTextStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: SCORE_FONT_SIZE,
      fontWeight: 'bold',
      fill: 0xffffff,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        angle: Math.PI / 4,
        distance: 2,
        alpha: 0.5,
      },
    });

    this.scoreText = new Text({
      text: '0',
      style: scoreTextStyle,
    });
    this.scoreText.anchor.set(0.5, 0.5);
    this.container.addChild(this.scoreText);

    this.initializePopupPool();
  }

  /**
   * Initialize the popup text pool with pre-created texts
   */
  private initializePopupPool(): void {
    const popupTextStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: POPUP_FONT_SIZE,
      fontWeight: 'bold',
      fill: 0xffd700,
    });

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      const popupText = new Text({
        text: '+1',
        style: popupTextStyle,
      });
      popupText.anchor.set(0.5, 0.5);
      popupText.visible = false;
      this.popupPool.push(popupText);
    }
  }

  /**
   * Get a popup text from the pool or create a new one
   */
  private getPopupFromPool(): Text {
    if (this.popupPool.length > 0) {
      const popup = this.popupPool.pop();
      if (popup) {
        popup.visible = true;
        popup.alpha = 1;
        return popup;
      }
    }

    const popupTextStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: POPUP_FONT_SIZE,
      fontWeight: 'bold',
      fill: 0xffd700,
    });

    const popupText = new Text({
      text: '+1',
      style: popupTextStyle,
    });
    popupText.anchor.set(0.5, 0.5);
    return popupText;
  }

  /**
   * Return a popup text to the pool
   */
  private returnPopupToPool(popup: Text): void {
    popup.visible = false;
    popup.alpha = 1;
    this.popupPool.push(popup);
  }

  /**
   * Get the container for adding to the scene
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the current score and trigger scale animation
   */
  setScore(score: number): void {
    this.scoreText.text = String(score);

    this.scaleAnimation.active = true;
    this.scaleAnimation.startTime = performance.now();
    this.scaleAnimation.startScale = this.scoreText.scale.x;
  }

  /**
   * Trigger a +1 popup animation at the given position
   */
  triggerScorePopup(x: number, y: number): void {
    const popup = this.getPopupFromPool();

    popup.position.set(x, y);

    this.activePopups.push({
      text: popup,
      startTime: performance.now(),
      startY: y,
    });

    if (!this.container.children.includes(popup)) {
      this.container.addChild(popup);
    }
  }

  /**
   * Update animations
   */
  update(currentTime: number): void {
    if (this.scaleAnimation.active) {
      const elapsed = currentTime - this.scaleAnimation.startTime;
      const progress = Math.min(elapsed / 200, 1);

      if (progress < 1) {
        const scaleProgress = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        const targetScale = 1 + scaleProgress * 0.3;
        this.scoreText.scale.set(targetScale, targetScale);
      } else {
        this.scoreText.scale.set(1, 1);
        this.scaleAnimation.active = false;
      }
    }

    const popupsToRemove: number[] = [];

    for (let i = 0; i < this.activePopups.length; i++) {
      const popup = this.activePopups[i];
      const elapsed = currentTime - popup.startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      if (progress >= 1) {
        this.returnPopupToPool(popup.text);
        popupsToRemove.push(i);
      } else {
        const easedProgress = easeOutCubic(progress);
        const newY = popup.startY - FLOAT_DISTANCE * easedProgress;
        popup.text.position.y = newY;
        popup.text.alpha = 1 - progress;
      }
    }

    for (let i = popupsToRemove.length - 1; i >= 0; i--) {
      this.activePopups.splice(popupsToRemove[i], 1);
    }
  }

  /**
   * Set the position of the score display
   */
  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    for (const popup of this.popupPool) {
      if (this.container.children.includes(popup)) {
        this.container.removeChild(popup);
      }
      popup.destroy();
    }
    this.popupPool = [];

    for (const popup of this.activePopups) {
      if (this.container.children.includes(popup.text)) {
        this.container.removeChild(popup.text);
      }
      popup.text.destroy();
    }
    this.activePopups = [];

    if (this.scoreText) {
      this.scoreText.destroy();
    }

    if (this.container) {
      this.container.destroy();
    }
  }
}
