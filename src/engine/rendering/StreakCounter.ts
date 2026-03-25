import { Container, Graphics, Text, TextStyle } from 'pixi.js';

// ============================================
// Constants
// ============================================

const FIRE_THRESHOLD = 3;
const FIRE_COLORS = [0xff4400, 0xff8800, 0xffcc00]; // Orange to yellow gradient
const PARTICLE_COUNT = 8;
const PARTICLE_LIFETIME = 500; // ms

// ============================================
// Types
// ============================================

interface FireParticle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// ============================================
// StreakCounter Class
// ============================================

export default class StreakCounter {
  private container: Container;
  private streakText: Text;
  private fireContainer: Container;
  private particles: FireParticle[];
  private currentStreak: number = 0;
  private isOnFire: boolean = false;
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 50; // ms between particle spawns

  constructor() {
    // Create main container
    this.container = new Container();

    // Create fire particle container (behind text)
    this.fireContainer = new Container();
    this.container.addChild(this.fireContainer);

    // Create streak text
    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    });
    this.streakText = new Text({ text: '0', style: textStyle });
    this.streakText.anchor.set(0.5, 0.5);
    this.container.addChild(this.streakText);

    // Pre-create particle graphics
    this.particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const graphics = new Graphics();
      this.fireContainer.addChild(graphics);
      this.particles.push({
        graphics,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: PARTICLE_LIFETIME,
      });
    }
  }

  /**
   * Get the main container for adding to scene
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Update streak value and manage fire effect
   */
  setStreak(streak: number): void {
    const wasOnFire = this.isOnFire;
    const streakIncreased = streak > this.currentStreak;

    // Update streak number
    this.currentStreak = streak;
    this.streakText.text = streak >= FIRE_THRESHOLD ? `🔥 ${streak}` : `${streak}`;

    // Determine if should be on fire
    this.isOnFire = streak >= FIRE_THRESHOLD;

    // Start fire effect if transitioning to fire
    if (this.isOnFire && !wasOnFire) {
      this.startFireEffect();
    }

    // Stop fire effect if transitioning away
    if (!this.isOnFire && wasOnFire) {
      this.stopFireEffect();
    }

    // Spawn burst of particles if streak increased while on fire
    if (streakIncreased && this.isOnFire) {
      this.spawnBurst();
    }
  }

  /**
   * Update particle positions and lifetimes
   */
  update(deltaTime: number): void {
    if (!this.isOnFire) {
      return;
    }

    this.lastSpawnTime += deltaTime;

    // Update existing particles
    for (const particle of this.particles) {
      if (particle.life > 0) {
        // Move particle
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;

        // Decay life
        particle.life -= deltaTime * 1000;

        // Update alpha based on remaining life
        const lifeRatio = Math.max(0, particle.life / particle.maxLife);
        particle.graphics.alpha = lifeRatio;

        // Update position
        particle.graphics.position.set(particle.x, particle.y);
      }
    }

    // Continuously spawn new particles if on fire
    if (this.lastSpawnTime >= this.spawnInterval) {
      this.spawnParticle();
      this.lastSpawnTime = 0;
    }
  }

  /**
   * Set position of the streak counter
   */
  setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Destroy all particle graphics
    for (const particle of this.particles) {
      particle.graphics.destroy();
    }

    // Destroy containers and text
    this.streakText.destroy();
    this.fireContainer.destroy();
    this.container.destroy();
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Start the fire effect
   */
  private startFireEffect(): void {
    this.lastSpawnTime = 0;
    // Make fire container visible
    this.fireContainer.visible = true;
  }

  /**
   * Stop the fire effect
   */
  private stopFireEffect(): void {
    // Reset all particles
    for (const particle of this.particles) {
      particle.life = 0;
      particle.graphics.clear();
      particle.graphics.visible = false;
    }
    this.fireContainer.visible = false;
  }

  /**
   * Spawn a burst of particles (when streak increases)
   */
  private spawnBurst(): void {
    const burstCount = Math.min(4, PARTICLE_COUNT);
    for (let i = 0; i < burstCount; i++) {
      this.spawnParticle();
    }
  }

  /**
   * Spawn a single particle
   */
  private spawnParticle(): void {
    // Find a dead particle to reuse
    let particle = this.particles.find((p) => p.life <= 0);
    if (!particle) {
      // If all particles are alive, reuse the oldest one
      particle = this.particles[0];
    }

    // Reset particle
    particle.x = 0; // Spawn at center (relative to container)
    particle.y = 0;
    particle.vx = Math.random() * 40 - 20; // -20 to 20
    particle.vy = Math.random() * -40 - 80; // -80 to -120
    particle.life = PARTICLE_LIFETIME;
    particle.maxLife = PARTICLE_LIFETIME;

    // Draw particle
    const radius = Math.random() * 1.5 + 3; // 3-4.5
    const color = FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)];

    particle.graphics.clear();
    particle.graphics.circle(0, 0, radius);
    particle.graphics.fill({ color });
    particle.graphics.visible = true;
    particle.graphics.alpha = 1;
  }
}
