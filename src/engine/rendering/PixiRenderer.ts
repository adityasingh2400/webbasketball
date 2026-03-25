import {
  Application,
  Container,
  Sprite,
  Texture,
  Graphics,
  type Ticker,
} from 'pixi.js';
import type {
  RenderConfig,
  NormalizedPosition,
  ParticleConfig,
  HandLandmark,
} from '../../types';
import ShotMeter from './ShotMeter';
import ScoreAnimation from './ScoreAnimation';
import StreakCounter from './StreakCounter';

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: RenderConfig = {
  width: 1280,
  height: 720,
  mirrorVideo: true,
  maxParticles: 500,
  enableScreenShake: true,
};

/** Radius in px at 720p baseline; scales proportionally with screen height */
const BALL_RADIUS_720P = 50;

const COLOR_BALL_ORANGE = 0xff6b35;
const COLOR_BALL_HIGHLIGHT = 0xff8c5a;
const COLOR_BALL_SEAM = 0x1a1a1a;
const COLOR_BALL_GLOW = 0xff6b35;
const COLOR_RIM_RED = 0xe63946;
const COLOR_RIM_GLOW = 0xff6b6b;
const COLOR_BACKBOARD_WHITE = 0xffffff;
const COLOR_BACKBOARD_BORDER = 0x333333;
const COLOR_NET_WHITE = 0xffffff;
const COLOR_SWISH_GOLD = 0xffd700;
const COLOR_RELEASE_WHITE = 0xffffff;
const COLOR_MISS_GREY = 0x888888;

const COURT_PAINT = 0xD4A574;  // Slightly darker for key area
const COURT_LINE = 0xFFFFFF;   // White lines
const LINE_ALPHA = 0.9;

const PLAYER_HEAD_RADIUS = 12;
const PLAYER_TORSO_WIDTH = 24;
const PLAYER_TORSO_HEIGHT = 32;
const PLAYER_COLOR = 0x4488ff;      // Blue jersey
const PLAYER_SKIN_COLOR = 0xffcc99; // Skin tone
const PLAYER_OUTLINE = 0x2255aa;    // Darker blue outline

/** Adaptive budget: reduce by BUDGET_DECREASE when frame > HIGH ms, grow by BUDGET_INCREASE when < LOW ms */
const FRAME_TIME_HIGH = 16;
const FRAME_TIME_LOW = 14;
const BUDGET_DECREASE = 50;
const BUDGET_INCREASE = 25;
const BUDGET_FLOOR = 50;

const SCENE_BOUNDS = {
  top: 0.40,
  bottom: 0.98,
  left: 0.02,
  right: 0.98,
  topNarrow: 0.35,
};

const DRIBBLE_FREQUENCY = 3;
const DRIBBLE_AMPLITUDE = 0.03;

// ============================================
// Internal Types
// ============================================

interface Particle {
  graphics: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
  fadeOut: boolean;
  baseSize: number;
}

// ============================================
// PixiRenderer
// ============================================

export class PixiRenderer {
  private app: Application | null = null;
  private config: RenderConfig;

  private backgroundLayer: Container | null = null;
  private courtLayer: Container | null = null;
  private shadowLayer: Container | null = null;
  private gameLayer: Container | null = null;
  private uiLayer: Container | null = null;
  
  private gameContainer: Container | null = null;
  private particleContainer: Container | null = null;

  private webcamSprite: Sprite | null = null;
  private webcamPiP: Container | null = null;
  private skeletonGraphics: Graphics | null = null;
  private courtMesh: Graphics | null = null;
  private ballGraphics: Graphics | null = null;
  private hoopContainer: Container | null = null;
  private trajectoryGraphics: Graphics | null = null;
  private handIndicator: Graphics | null = null;

  private playerContainer: Container | null = null;
  private playerBody: Graphics | null = null;
  private playerShadow: Graphics | null = null;
  private playerAnimationState: string = 'idle';

  private pipWidth = 0;
  private pipHeight = 0;

  private particles: Particle[] = [];
  private activeParticleCount = 0;
  private adaptiveMaxParticles: number;

  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeMaxDuration = 0;

  private screenWidth: number;
  private screenHeight: number;

  private dribblePhase = 0;
  private isDribbling = false;

  private shotMeter: ShotMeter | null = null;
  private scoreAnimation: ScoreAnimation | null = null;
  private streakCounter: StreakCounter | null = null;

  constructor(config: Partial<RenderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adaptiveMaxParticles = this.config.maxParticles;
    this.screenWidth = this.config.width;
    this.screenHeight = this.config.height;
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(
    container: HTMLElement,
    videoElement: HTMLVideoElement,
  ): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: this.config.width,
      height: this.config.height,
      backgroundAlpha: 1,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });

    container.appendChild(this.app.canvas);

    this.backgroundLayer = new Container();
    this.app.stage.addChild(this.backgroundLayer);
    this.backgroundLayer.addChild(this.createBackdrop());

    this.courtLayer = new Container();
    this.app.stage.addChild(this.courtLayer);
    this.courtMesh = this.createCourtMesh();
    this.courtLayer.addChild(this.courtMesh);

    this.shadowLayer = new Container();
    this.app.stage.addChild(this.shadowLayer);

    const hoopShadow = this.createHoopShadow();
    this.shadowLayer.addChild(hoopShadow);

    this.gameLayer = new Container();
    this.app.stage.addChild(this.gameLayer);
    this.gameContainer = this.gameLayer;

    this.hoopContainer = this.createHoopGraphics();
    this.hoopContainer.visible = true;
    this.gameLayer.addChild(this.hoopContainer);
    this.updateHoopScale();

    this.trajectoryGraphics = new Graphics();
    this.gameLayer.addChild(this.trajectoryGraphics);

    this.ballGraphics = this.createBallGraphics();
    this.ballGraphics.visible = false;
    this.gameLayer.addChild(this.ballGraphics);

    this.playerContainer = this.createPlayerGraphics();
    this.playerContainer.visible = false;
    this.gameLayer.addChild(this.playerContainer);
    this.gameLayer.setChildIndex(this.ballGraphics, this.gameLayer.children.length - 1);

    this.particleContainer = new Container();
    this.gameLayer.addChild(this.particleContainer);

    this.handIndicator = this.createHandIndicator();
    this.handIndicator.visible = false;
    this.gameLayer.addChild(this.handIndicator);

    this.initializeParticlePool();

    this.uiLayer = new Container();
    this.app.stage.addChild(this.uiLayer);
    this.webcamPiP = this.createWebcamPiP(videoElement);
    this.uiLayer.addChild(this.webcamPiP);

    this.shotMeter = new ShotMeter();
    this.shotMeter.setPosition(this.screenWidth / 2 - 30, this.screenHeight - 40);
    this.shotMeter.setVisible(false);
    this.uiLayer.addChild(this.shotMeter.getContainer());

    this.scoreAnimation = new ScoreAnimation();
    this.scoreAnimation.setPosition(this.screenWidth / 2, 60);
    this.uiLayer.addChild(this.scoreAnimation.getContainer());

    this.streakCounter = new StreakCounter();
    this.streakCounter.setPosition(this.screenWidth - 80, 60);
    this.uiLayer.addChild(this.streakCounter.getContainer());

    this.app.ticker.add(this.update, this);
  }

  // ============================================
  // Asset Creation
  // ============================================

  private createBallGraphics(): Graphics {
    const r = this.scaledBallRadius();
    const g = new Graphics();

    g.circle(0, 0, r + 12);
    g.fill({ color: COLOR_BALL_GLOW, alpha: 0.3 });

    g.circle(0, 0, r + 6);
    g.fill({ color: COLOR_BALL_GLOW, alpha: 0.2 });

    g.circle(3, 3, r);
    g.fill({ color: 0x000000, alpha: 0.4 });

    g.circle(0, 0, r);
    g.fill(COLOR_BALL_ORANGE);

    g.circle(-r * 0.3, -r * 0.3, r * 0.25);
    g.fill({ color: COLOR_BALL_HIGHLIGHT, alpha: 0.4 });

    g.setStrokeStyle({ width: 3, color: COLOR_BALL_SEAM, alpha: 0.9 });

    g.moveTo(0, -r);
    g.lineTo(0, r);
    g.stroke();

    g.moveTo(-r, 0);
    g.lineTo(r, 0);
    g.stroke();

    g.moveTo(-r * 0.5, -r);
    g.quadraticCurveTo(-r * 0.7, 0, -r * 0.5, r);
    g.stroke();

    g.moveTo(r * 0.5, -r);
    g.quadraticCurveTo(r * 0.7, 0, r * 0.5, r);
    g.stroke();

    g.setStrokeStyle({ width: 3, color: 0x000000, alpha: 0.3 });
    g.circle(0, 0, r);
    g.stroke();

    return g;
  }

  private createHoopGraphics(): Container {
    const hoopGroup = new Container();
    const rimWidth = this.screenWidth * 0.12;
    const rimThickness = 8;

    const backingGlow = new Graphics();
    const glowSize = rimWidth * 2.2;
    backingGlow.circle(0, -rimWidth * 0.3, glowSize / 2);
    backingGlow.fill({ color: 0x000000, alpha: 0.5 });
    hoopGroup.addChild(backingGlow);

    const backboard = new Graphics();
    const bbWidth = rimWidth * 1.8;
    const bbHeight = rimWidth * 1.2;
    
    backboard.roundRect(-bbWidth / 2 - 4, -bbHeight - 4, bbWidth + 8, bbHeight + 8, 8);
    backboard.fill({ color: COLOR_BACKBOARD_BORDER, alpha: 0.9 });
    
    backboard.roundRect(-bbWidth / 2, -bbHeight, bbWidth, bbHeight, 6);
    backboard.fill({ color: COLOR_BACKBOARD_WHITE, alpha: 0.95 });
    
    backboard.setStrokeStyle({ width: 4, color: COLOR_BACKBOARD_BORDER, alpha: 0.8 });
    backboard.roundRect(-bbWidth / 2, -bbHeight, bbWidth, bbHeight, 6);
    backboard.stroke();
    
    const targetBoxW = rimWidth * 0.8;
    const targetBoxH = rimWidth * 0.5;
    backboard.setStrokeStyle({ width: 3, color: COLOR_RIM_RED, alpha: 0.7 });
    backboard.roundRect(-targetBoxW / 2, -bbHeight + 10, targetBoxW, targetBoxH, 2);
    backboard.stroke();
    
    hoopGroup.addChild(backboard);

    const rimGlow = new Graphics();
    rimGlow.setStrokeStyle({ width: rimThickness + 8, color: COLOR_RIM_GLOW, alpha: 0.3 });
    rimGlow.ellipse(0, 0, rimWidth / 2, rimWidth * 0.18);
    rimGlow.stroke();
    hoopGroup.addChild(rimGlow);

    const rim = new Graphics();
    rim.setStrokeStyle({ width: rimThickness, color: COLOR_RIM_RED });
    rim.ellipse(0, 0, rimWidth / 2, rimWidth * 0.18);
    rim.stroke();
    
    rim.setStrokeStyle({ width: rimThickness - 2, color: 0xff5555 });
    rim.ellipse(0, -1, rimWidth / 2 - 2, rimWidth * 0.15);
    rim.stroke();
    hoopGroup.addChild(rim);

    const net = new Graphics();
    const netHeight = rimWidth * 0.7;
    const segments = 7;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = -rimWidth / 2 + rimWidth * t;
      const bottomX = x * 0.5;
      
      net.setStrokeStyle({ width: 2, color: COLOR_NET_WHITE, alpha: 0.9 });
      net.moveTo(x, 0);
      net.lineTo(bottomX, netHeight);
      net.stroke();
    }

    for (let row = 1; row <= 4; row++) {
      const rowT = row / 5;
      const y = netHeight * rowT;
      const narrowFactor = 1 - rowT * 0.5;
      const halfW = (rimWidth / 2) * narrowFactor;
      net.setStrokeStyle({ width: 1.5, color: COLOR_NET_WHITE, alpha: 0.8 - rowT * 0.3 });
      net.moveTo(-halfW, y);
      net.lineTo(halfW, y);
      net.stroke();
    }

    hoopGroup.addChild(net);

    return hoopGroup;
  }

  private createHoopShadow(): Graphics {
    const shadow = new Graphics();
    const hoopPos = this.normalizedToScene({ x: 0.5, y: 0.25 });
    shadow.ellipse(hoopPos.x, hoopPos.y + 30, 40, 10);
    shadow.fill({ color: 0x000000, alpha: 0.15 });
    return shadow;
  }

  private createHandIndicator(): Graphics {
    const g = new Graphics();
    const size = 30;

    g.circle(0, 0, size + 8);
    g.fill({ color: COLOR_BALL_GLOW, alpha: 0.2 });

    g.setStrokeStyle({ width: 4, color: 0xffffff, alpha: 0.9 });
    g.circle(0, 0, size);
    g.stroke();

    g.setStrokeStyle({ width: 3, color: 0xffffff, alpha: 0.7 });
    g.moveTo(0, -size - 12);
    g.lineTo(0, -size - 4);
    g.stroke();
    g.moveTo(0, size + 4);
    g.lineTo(0, size + 12);
    g.stroke();
    g.moveTo(-size - 12, 0);
    g.lineTo(-size - 4, 0);
    g.stroke();
    g.moveTo(size + 4, 0);
    g.lineTo(size + 12, 0);
    g.stroke();

    g.circle(0, 0, 4);
    g.fill({ color: 0xffffff, alpha: 0.8 });

    return g;
  }

  private createPlayerGraphics(): Container {
    const container = new Container();

    const shadow = new Graphics();
    shadow.ellipse(0, PLAYER_TORSO_HEIGHT / 2 + 8, 20, 6);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(shadow);
    this.playerShadow = shadow;

    const body = new Graphics();

    body.moveTo(-8, PLAYER_TORSO_HEIGHT / 2);
    body.lineTo(-10, PLAYER_TORSO_HEIGHT / 2 + 20);
    body.moveTo(8, PLAYER_TORSO_HEIGHT / 2);
    body.lineTo(10, PLAYER_TORSO_HEIGHT / 2 + 20);
    body.stroke({ width: 6, color: PLAYER_COLOR });

    body.roundRect(
      -PLAYER_TORSO_WIDTH / 2,
      -PLAYER_TORSO_HEIGHT / 2,
      PLAYER_TORSO_WIDTH,
      PLAYER_TORSO_HEIGHT,
      6
    );
    body.fill({ color: PLAYER_COLOR });
    body.stroke({ width: 2, color: PLAYER_OUTLINE });

    body.moveTo(-PLAYER_TORSO_WIDTH / 2, -PLAYER_TORSO_HEIGHT / 4);
    body.lineTo(-PLAYER_TORSO_WIDTH / 2 - 15, PLAYER_TORSO_HEIGHT / 4);
    body.moveTo(PLAYER_TORSO_WIDTH / 2, -PLAYER_TORSO_HEIGHT / 4);
    body.lineTo(PLAYER_TORSO_WIDTH / 2 + 15, PLAYER_TORSO_HEIGHT / 4);
    body.stroke({ width: 5, color: PLAYER_SKIN_COLOR });

    body.circle(0, -PLAYER_TORSO_HEIGHT / 2 - PLAYER_HEAD_RADIUS - 2, PLAYER_HEAD_RADIUS);
    body.fill({ color: PLAYER_SKIN_COLOR });
    body.stroke({ width: 2, color: 0xddaa77 });

    container.addChild(body);
    this.playerBody = body;

    return container;
  }

  private createBackdrop(): Container {
    const backdrop = new Container();
    
    const sky = new Graphics();
    const gradientSteps = 20;
    const skyHeight = this.screenHeight * 0.45;
    
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / gradientSteps;
      const color = this.lerpColor(0x87CEEB, 0x4A90D9, t);
      const stepHeight = skyHeight / gradientSteps;
      sky.rect(0, stepHeight * i, this.screenWidth, stepHeight + 1);
      sky.fill(color);
    }
    backdrop.addChild(sky);
    
    const crowd = new Graphics();
    crowd.rect(0, skyHeight - 20, this.screenWidth, 40);
    crowd.fill({ color: 0x2a2a4a, alpha: 0.7 });
    backdrop.addChild(crowd);
    
    return backdrop;
  }

  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff, g1 = (color1 >> 8) & 0xff, b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff, g2 = (color2 >> 8) & 0xff, b2 = color2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  private createCourtMesh(): Graphics {
    const court = new Graphics();
    
    const topLeft = { x: this.screenWidth * 0.15, y: this.screenHeight * 0.40 };
    const topRight = { x: this.screenWidth * 0.85, y: this.screenHeight * 0.40 };
    const bottomRight = { x: this.screenWidth * 0.98, y: this.screenHeight * 0.98 };
    const bottomLeft = { x: this.screenWidth * 0.02, y: this.screenHeight * 0.98 };
    
    court.moveTo(topLeft.x, topLeft.y);
    court.lineTo(topRight.x, topRight.y);
    court.lineTo(bottomRight.x, bottomRight.y);
    court.lineTo(bottomLeft.x, bottomLeft.y);
    court.closePath();
    court.fill(0xE8B87D);
    
    court.moveTo(topLeft.x, topLeft.y);
    court.lineTo(topRight.x, topRight.y);
    court.lineTo(bottomRight.x, bottomRight.y);
    court.lineTo(bottomLeft.x, bottomLeft.y);
    court.closePath();
    court.stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
    
    const freeThrowLineDepthT = 0.2;
    const freeThrowLineY = this.screenHeight * 0.52;
    const freeThrowLineLeft = this.lerpPoint(topLeft, bottomLeft, freeThrowLineDepthT);
    const freeThrowLineRight = this.lerpPoint(topRight, bottomRight, freeThrowLineDepthT);
    court.moveTo(freeThrowLineLeft.x, freeThrowLineY);
    court.lineTo(freeThrowLineRight.x, freeThrowLineY);
    court.stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    
    const centerCourt = this.screenHeight * 0.75;
    const centerCourtLeft = this.lerpPoint(topLeft, bottomLeft, 0.6);
    const centerCourtRight = this.lerpPoint(topRight, bottomRight, 0.6);
    court.moveTo(centerCourtLeft.x, centerCourt);
    court.lineTo(centerCourtRight.x, centerCourt);
    court.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    
    const keyBaselineDepthT = 0.0;
    const keyBaselineLeft = this.lerpPoint(topLeft, bottomLeft, keyBaselineDepthT);
    const keyBaselineRight = this.lerpPoint(topRight, bottomRight, keyBaselineDepthT);
    const keyBaselineY = this.screenHeight * 0.40;
    
    court.moveTo(keyBaselineLeft.x, keyBaselineY);
    court.lineTo(keyBaselineRight.x, keyBaselineY);
    court.lineTo(freeThrowLineRight.x, freeThrowLineY);
    court.lineTo(freeThrowLineLeft.x, freeThrowLineY);
    court.closePath();
    court.fill(COURT_PAINT);
    
    court.moveTo(keyBaselineLeft.x, keyBaselineY);
    court.lineTo(keyBaselineRight.x, keyBaselineY);
    court.lineTo(freeThrowLineRight.x, freeThrowLineY);
    court.lineTo(freeThrowLineLeft.x, freeThrowLineY);
    court.closePath();
    court.stroke({ width: 3, color: COURT_LINE, alpha: LINE_ALPHA });
    
    const freeThrowCircleRadius = (freeThrowLineRight.x - freeThrowLineLeft.x) / 2;
    const freeThrowCircleCenterX = (freeThrowLineLeft.x + freeThrowLineRight.x) / 2;
    court.arc(freeThrowCircleCenterX, freeThrowLineY, freeThrowCircleRadius, 0, Math.PI, false);
    court.stroke({ width: 2, color: COURT_LINE, alpha: LINE_ALPHA });
    
    const threePointArcRadius = (keyBaselineRight.x - keyBaselineLeft.x) * 0.6;
    const threePointArcCenterX = (keyBaselineLeft.x + keyBaselineRight.x) / 2;
    court.arc(threePointArcCenterX, keyBaselineY, threePointArcRadius, 0, Math.PI, false);
    court.stroke({ width: 3, color: COURT_LINE, alpha: LINE_ALPHA });
    
    return court;
  }

  private lerpPoint(p1: {x: number, y: number}, p2: {x: number, y: number}, t: number): {x: number, y: number} {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  private createWebcamPiP(videoElement: HTMLVideoElement): Container {
    const pip = new Container();
    
    this.pipWidth = this.screenWidth * 0.18;
    this.pipHeight = this.pipWidth * (9 / 16);
    
    const webcamTexture = Texture.from(videoElement);
    this.webcamSprite = new Sprite(webcamTexture);
    this.webcamSprite.width = this.pipWidth;
    this.webcamSprite.height = this.pipHeight;
    
    if (this.config.mirrorVideo) {
      this.webcamSprite.anchor.set(1, 0);
      this.webcamSprite.scale.x = -Math.abs(this.webcamSprite.scale.x);
    }
    
    pip.addChild(this.webcamSprite);
    
    this.skeletonGraphics = new Graphics();
    pip.addChild(this.skeletonGraphics);
    
    const border = new Graphics();
    border.roundRect(0, 0, this.pipWidth, this.pipHeight, 8);
    border.stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
    pip.addChild(border);
    
    pip.x = this.screenWidth - this.pipWidth - 16;
    pip.y = this.screenHeight - this.pipHeight - 16;
    
    return pip;
  }

  private normalizedToScene(pos: NormalizedPosition): { x: number; y: number } {
    const sceneYNorm = SCENE_BOUNDS.top + (SCENE_BOUNDS.bottom - SCENE_BOUNDS.top) * pos.y;
    
    const depthT = pos.y;
    const narrowFactor = 1 - SCENE_BOUNDS.topNarrow * (1 - depthT);
    
    const centerX = 0.5;
    const offsetFromCenter = pos.x - centerX;
    const perspectiveX = centerX + offsetFromCenter * narrowFactor;
    
    return {
      x: Math.max(0, Math.min(1, perspectiveX)) * this.screenWidth,
      y: sceneYNorm * this.screenHeight,
    };
  }

  private updateBallScale(normalizedY: number): void {
    if (!this.ballGraphics) return;
    
    const minScale = 0.7;
    const maxScale = 1.2;
    const t = Math.max(0, Math.min(1, normalizedY));
    const scale = minScale + (maxScale - minScale) * t;
    
    this.ballGraphics.scale.set(scale);
  }

  private updateHoopScale(): void {
    if (!this.hoopContainer) return;
    const hoopScale = 0.85;
    this.hoopContainer.scale.set(hoopScale);
  }

  private initializeParticlePool(): void {
    if (!this.particleContainer) return;

    this.particles = [];
    for (let i = 0; i < this.config.maxParticles; i++) {
      const graphics = new Graphics();
      graphics.circle(0, 0, 3);
      graphics.fill(COLOR_RELEASE_WHITE);
      graphics.visible = false;
      this.particleContainer.addChild(graphics);

      this.particles.push({
        graphics,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        active: false,
        fadeOut: true,
        baseSize: 3,
      });
    }
  }

  // ============================================
  // Per-Frame Update
  // ============================================

  private update = (ticker: Ticker): void => {
    const deltaTime = ticker.deltaMS / 1000;
    if (this.config.enableScreenShake) {
      this.updateScreenShake(ticker.deltaMS);
    }
    this.updateParticles(ticker.deltaTime, ticker.deltaMS);
    this.updateDribble(deltaTime);
    this.updateHUD(deltaTime);
  };

  private updateHUD(deltaTime: number): void {
    this.shotMeter?.update(deltaTime);
    this.scoreAnimation?.update(deltaTime);
    this.streakCounter?.update(deltaTime);
  }

  private updateScreenShake(deltaMS: number): void {
    if (!this.gameContainer) return;

    if (this.shakeDuration <= 0) {
      this.gameContainer.x = 0;
      this.gameContainer.y = 0;
      return;
    }

    this.shakeDuration -= deltaMS;

    const progress =
      this.shakeMaxDuration > 0
        ? 1 - this.shakeDuration / this.shakeMaxDuration
        : 1;
    const currentIntensity = this.shakeIntensity * (1 - progress);

    this.gameContainer.x = (Math.random() - 0.5) * currentIntensity * 2;
    this.gameContainer.y = (Math.random() - 0.5) * currentIntensity * 2;

    if (this.shakeDuration <= 0) {
      this.shakeDuration = 0;
      this.gameContainer.x = 0;
      this.gameContainer.y = 0;
    }
  }

  private updateParticles(deltaTime: number, deltaMS: number): void {
    let activeCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.graphics.x += p.vx * deltaTime;
      p.graphics.y += p.vy * deltaTime;
      p.vy += 0.15 * deltaTime;

      // deltaTime is ~1.0 at 60fps, so divide by 60 to get seconds
      p.life -= deltaTime / 60;

      if (p.life <= 0) {
        p.active = false;
        p.graphics.visible = false;
        continue;
      }

      if (p.fadeOut && p.maxLife > 0) {
        const lifeRatio = p.life / p.maxLife;
        p.graphics.alpha = lifeRatio;
        p.graphics.scale.set(lifeRatio * 0.5 + 0.5);
      }

      activeCount++;
    }

    this.activeParticleCount = activeCount;

    if (deltaMS > FRAME_TIME_HIGH) {
      this.adaptiveMaxParticles = Math.max(
        BUDGET_FLOOR,
        this.adaptiveMaxParticles - BUDGET_DECREASE,
      );
    } else if (
      deltaMS < FRAME_TIME_LOW &&
      this.adaptiveMaxParticles < this.config.maxParticles
    ) {
      this.adaptiveMaxParticles = Math.min(
        this.config.maxParticles,
        this.adaptiveMaxParticles + BUDGET_INCREASE,
      );
    }
  }

  // ============================================
  // Public API: Ball
  // ============================================

  setBallPosition(position: NormalizedPosition): void {
    if (!this.ballGraphics) return;
    
    const scenePos = this.normalizedToScene(position);
    this.ballGraphics.x = scenePos.x;
    this.ballGraphics.y = scenePos.y;
    
    this.updateBallScale(position.y);
  }

  setBallRotation(rotation: number): void {
    if (!this.ballGraphics) return;
    this.ballGraphics.rotation = rotation;
  }

  setBallVisible(visible: boolean): void {
    if (!this.ballGraphics) return;
    this.ballGraphics.visible = visible;
  }

  setHandPosition(position: NormalizedPosition): void {
    if (!this.handIndicator) return;
    
    const scenePos = this.normalizedToScene(position);
    this.handIndicator.x = scenePos.x;
    this.handIndicator.y = scenePos.y;
  }

  setHandVisible(visible: boolean): void {
    if (!this.handIndicator) return;
    this.handIndicator.visible = visible;
  }

  setDribbling(active: boolean): void {
    this.isDribbling = active;
    if (active) {
      this.dribblePhase = 0;
    }
  }

  getDribbleBounceOffset(): number {
    if (!this.isDribbling) return 0;
    return Math.abs(Math.sin(this.dribblePhase)) * DRIBBLE_AMPLITUDE;
  }

  private updateDribble(deltaTime: number): void {
    if (!this.isDribbling) return;
    this.dribblePhase += deltaTime * DRIBBLE_FREQUENCY * Math.PI * 2;
    if (this.dribblePhase > Math.PI * 2) {
      this.dribblePhase -= Math.PI * 2;
    }
  }

  drawHandSkeleton(landmarks: HandLandmark[]): void {
    if (!this.skeletonGraphics || landmarks.length < 21) return;
    
    this.skeletonGraphics.clear();
    
    const CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];
    
    const toLocal = (lm: HandLandmark) => {
      const x = this.config.mirrorVideo ? (1 - lm.x) * this.pipWidth : lm.x * this.pipWidth;
      const y = lm.y * this.pipHeight;
      return { x, y };
    };
    
    this.skeletonGraphics.setStrokeStyle({ width: 2, color: 0x00ff00, alpha: 0.9 });
    for (const [i, j] of CONNECTIONS) {
      const p1 = toLocal(landmarks[i]);
      const p2 = toLocal(landmarks[j]);
      this.skeletonGraphics.moveTo(p1.x, p1.y);
      this.skeletonGraphics.lineTo(p2.x, p2.y);
    }
    this.skeletonGraphics.stroke();
    
    for (const lm of landmarks) {
      const p = toLocal(lm);
      this.skeletonGraphics.circle(p.x, p.y, 4);
    }
    this.skeletonGraphics.fill({ color: 0xff0000, alpha: 0.9 });
  }

  clearHandSkeleton(): void {
    this.skeletonGraphics?.clear();
  }

  // ============================================
  // Public API: Player
  // ============================================

  setPlayerPosition(position: NormalizedPosition): void {
    if (!this.playerContainer) return;
    const scenePos = this.normalizedToScene(position);
    const depthScale = 0.6 + (position.y - SCENE_BOUNDS.top) / (SCENE_BOUNDS.bottom - SCENE_BOUNDS.top) * 0.6;
    this.playerContainer.position.set(scenePos.x, scenePos.y);
    this.playerContainer.scale.set(depthScale);
  }

  setPlayerVisible(visible: boolean): void {
    if (this.playerContainer) {
      this.playerContainer.visible = visible;
    }
  }

  setPlayerAnimationState(state: string): void {
    if (state === this.playerAnimationState) return;
    this.playerAnimationState = state;
  }

  setPlayerShadowScale(scale: number): void {
    if (this.playerShadow) {
      this.playerShadow.scale.set(scale, scale * 0.3);
    }
  }

  // ============================================
  // Public API: HUD
  // ============================================

  startShotMeter(): void {
    this.shotMeter?.start();
    this.shotMeter?.setVisible(true);
  }

  stopShotMeter(): number {
    const value = this.shotMeter?.stop() ?? 0;
    this.shotMeter?.setVisible(false);
    return value;
  }

  getShotMeterValue(): number {
    return this.shotMeter?.getValue() ?? 0;
  }

  isShotMeterInSweetSpot(): boolean {
    return this.shotMeter?.isInSweetSpot() ?? false;
  }

  setScore(score: number): void {
    this.scoreAnimation?.setScore(score);
  }

  triggerScorePopup(): void {
    const hoopPos = this.hoopContainer
      ? { x: this.hoopContainer.x, y: this.hoopContainer.y - 50 }
      : { x: this.screenWidth / 2, y: 150 };
    this.scoreAnimation?.triggerScorePopup(hoopPos.x, hoopPos.y);
  }

  setStreak(streak: number): void {
    this.streakCounter?.setStreak(streak);
  }

  // ============================================
  // Public API: Hoop
  // ============================================

  setHoopPosition(position: NormalizedPosition): void {
    if (!this.hoopContainer) return;
    
    const scenePos = this.normalizedToScene(position);
    this.hoopContainer.x = scenePos.x;
    this.hoopContainer.y = scenePos.y;
  }

  // ============================================
  // Public API: Screen Shake
  // ============================================

  triggerScreenShake(intensity: number, durationMs: number = 200): void {
    if (!this.config.enableScreenShake) return;
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
    this.shakeMaxDuration = durationMs;
  }

  // ============================================
  // Public API: Particles
  // ============================================

  spawnParticles(config: ParticleConfig, count: number): void {
    const effectiveCount = Math.min(
      count,
      this.adaptiveMaxParticles - this.activeParticleCount,
    );

    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < effectiveCount; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.graphics.visible = true;
      p.graphics.x = config.position.x;
      p.graphics.y = config.position.y;
      p.vx = config.velocity.x + (Math.random() - 0.5) * 2;
      p.vy = config.velocity.y + (Math.random() - 0.5) * 2;
      p.life = config.lifetime;
      p.maxLife = config.lifetime;
      p.fadeOut = config.fadeOut;
      p.baseSize = config.size;
      p.graphics.alpha = 1;
      p.graphics.scale.set(1);

      p.graphics.clear();
      p.graphics.circle(0, 0, config.size);
      p.graphics.fill(config.color);

      spawned++;
    }
  }

  spawnSwishEffect(position: NormalizedPosition): void {
    const scenePos = this.normalizedToScene(position);

    this.spawnParticles(
      {
        position: { x: scenePos.x, y: scenePos.y },
        velocity: { x: 0, y: -3 },
        color: COLOR_SWISH_GOLD,
        size: 5,
        lifetime: 0.8,
        fadeOut: true,
      },
      30,
    );
  }

  spawnReleaseEffect(position: NormalizedPosition): void {
    const scenePos = this.normalizedToScene(position);

    this.spawnParticles(
      {
        position: { x: scenePos.x, y: scenePos.y },
        velocity: { x: 0, y: -1 },
        color: COLOR_RELEASE_WHITE,
        size: 3,
        lifetime: 0.4,
        fadeOut: true,
      },
      12,
    );
  }

  spawnMissEffect(position: NormalizedPosition): void {
    const scenePos = this.normalizedToScene(position);

    this.spawnParticles(
      {
        position: { x: scenePos.x, y: scenePos.y },
        velocity: { x: 0, y: -1 },
        color: COLOR_MISS_GREY,
        size: 3,
        lifetime: 0.5,
        fadeOut: true,
      },
      8,
    );
  }

  spawnStreakEffect(position: NormalizedPosition, streak: number): void {
    const scenePos = this.normalizedToScene(position);

    const particleCount = Math.min(50, 20 + streak * 5);
    const colors = [0xffd700, 0xff6b35, 0xff4500, 0xffa500];
    const color = colors[Math.min(streak - 1, colors.length - 1)];

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.spawnParticles(
        {
          position: { x: scenePos.x, y: scenePos.y },
          velocity: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 - 2 },
          color,
          size: 4 + streak,
          lifetime: 1.0,
          fadeOut: true,
        },
        Math.floor(particleCount / 4),
      );
    }
  }

  // ============================================
  // Public API: Trajectory Preview
  // ============================================

  /** Draws a dashed arc through normalized-coordinate points */
  drawTrajectoryPreview(points: NormalizedPosition[]): void {
    if (!this.trajectoryGraphics || points.length < 2) return;

    this.trajectoryGraphics.clear();
    this.trajectoryGraphics.setStrokeStyle({
      width: 2,
      color: 0xffffff,
      alpha: 0.5,
    });

    const dashLength = 8;
    const gapLength = 6;
    let drawing = true;
    let segmentProgress = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = this.normalizedToScene(points[i]);
      const p1 = this.normalizedToScene(points[i + 1]);
      const x0 = p0.x;
      const y0 = p0.y;
      const x1 = p1.x;
      const y1 = p1.y;

      const dx = x1 - x0;
      const dy = y1 - y0;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      let consumed = 0;
      while (consumed < segLen) {
        const threshold = drawing ? dashLength : gapLength;
        const remaining = threshold - segmentProgress;
        const step = Math.min(remaining, segLen - consumed);
        const t = (consumed + step) / segLen;
        const px = x0 + dx * t;
        const py = y0 + dy * t;

        if (drawing) {
          if (segmentProgress === 0) {
            const tStart = consumed / segLen;
            this.trajectoryGraphics.moveTo(
              x0 + dx * tStart,
              y0 + dy * tStart,
            );
          }
          this.trajectoryGraphics.lineTo(px, py);
        }

        consumed += step;
        segmentProgress += step;

        if (segmentProgress >= threshold) {
          if (drawing) {
            this.trajectoryGraphics.stroke();
          }
          drawing = !drawing;
          segmentProgress = 0;
        }
      }
    }

    if (drawing) {
      this.trajectoryGraphics.stroke();
    }
  }

  clearTrajectoryPreview(): void {
    this.trajectoryGraphics?.clear();
  }

  // ============================================
  // Public API: Canvas & Resize
  // ============================================

  getCanvas(): HTMLCanvasElement | null {
    return (this.app?.canvas as HTMLCanvasElement) ?? null;
  }

  resize(width: number, height: number): void {
    if (!this.app) return;

    this.screenWidth = width;
    this.screenHeight = height;

    this.app.renderer.resize(width, height);

    if (this.backgroundLayer) {
      this.backgroundLayer.removeChildren();
      this.backgroundLayer.addChild(this.createBackdrop());
    }

    if (this.courtLayer && this.courtMesh) {
      this.courtLayer.removeChild(this.courtMesh);
      this.courtMesh.destroy();
      this.courtMesh = this.createCourtMesh();
      this.courtLayer.addChild(this.courtMesh);
    }

    this.updateHoopScale();

    if (this.webcamPiP && this.webcamSprite) {
      this.pipWidth = this.screenWidth * 0.18;
      this.pipHeight = this.pipWidth * (9 / 16);

      this.webcamSprite.width = this.pipWidth;
      this.webcamSprite.height = this.pipHeight;

      if (this.config.mirrorVideo) {
        this.webcamSprite.anchor.set(1, 0);
        this.webcamSprite.scale.x = -Math.abs(this.webcamSprite.scale.x);
      }

      this.webcamPiP.x = this.screenWidth - this.pipWidth - 16;
      this.webcamPiP.y = this.screenHeight - this.pipHeight - 16;
    }

    if (this.ballGraphics && this.gameLayer) {
      const wasVisible = this.ballGraphics.visible;
      const prevRotation = this.ballGraphics.rotation;
      const prevScale = this.ballGraphics.scale.x;

      this.gameLayer.removeChild(this.ballGraphics);
      this.ballGraphics.destroy();

      this.ballGraphics = this.createBallGraphics();
      this.ballGraphics.visible = wasVisible;
      this.ballGraphics.rotation = prevRotation;
      this.ballGraphics.scale.set(prevScale);

      const trajectoryIndex = this.trajectoryGraphics
        ? this.gameLayer.getChildIndex(this.trajectoryGraphics)
        : -1;
      if (trajectoryIndex >= 0) {
        this.gameLayer.addChildAt(
          this.ballGraphics,
          trajectoryIndex + 1,
        );
      } else {
        this.gameLayer.addChild(this.ballGraphics);
      }
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  destroy(): void {
    if (this.app) {
      this.app.ticker.remove(this.update, this);
    }

    for (const p of this.particles) {
      p.graphics.destroy();
    }
    this.particles = [];
    this.activeParticleCount = 0;

    if (this.webcamSprite) {
      const texture = this.webcamSprite.texture;
      this.webcamSprite.destroy();
      texture.destroy(true);
      this.webcamSprite = null;
    }

    this.ballGraphics?.destroy();
    this.ballGraphics = null;

    if (this.playerContainer) {
      this.playerBody?.removeFromParent();
      this.playerContainer.destroy({ children: true });
      this.playerContainer = null;
      this.playerBody = null;
      this.playerShadow = null;
    }

    this.hoopContainer?.destroy({ children: true });
    this.hoopContainer = null;

    if (this.shadowLayer) {
      this.shadowLayer.destroy({ children: true });
      this.shadowLayer = null;
    }

    this.trajectoryGraphics?.destroy();
    this.trajectoryGraphics = null;

    this.shotMeter?.destroy();
    this.shotMeter = null;

    this.scoreAnimation?.destroy();
    this.scoreAnimation = null;

    this.streakCounter?.destroy();
    this.streakCounter = null;

    this.particleContainer?.destroy({ children: true });
    this.particleContainer = null;

    this.gameContainer?.destroy({ children: true });
    this.gameContainer = null;

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private scaledBallRadius(): number {
    return BALL_RADIUS_720P * (this.screenHeight / 720);
  }
}
