export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private texts: FloatingText[] = [];

  public clear(): void {
    this.particles.length = 0;
    this.texts.length = 0;
  }

  public spawnRockSparks(x: number, y: number, color: string, count = 4): void {
    if (this.particles.length > 350) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 95;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        size: 2 + Math.random() * 2.5,
        color,
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        gravity: 220,
      });
    }
  }

  public spawnBlockBurst(x: number, y: number, baseColor: string, oreColor?: string, count = 11): void {
    if (this.particles.length > 400) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 130;
      const useOre = oreColor && i % 2 === 0;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: useOre ? 3.5 + Math.random() * 2.5 : 3 + Math.random() * 3,
        color: useOre ? oreColor : baseColor,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        gravity: 280,
      });
    }
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
    subtext?: string
  ): void {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({
      x,
      y,
      vy: -48,
      text,
      subtext,
      color,
      life: 1.05,
      maxLife: 1.05,
      scale,
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.96;
    }
  }

  public render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX - p.size * 0.5), Math.round(p.y - camY - p.size * 0.5), p.size, p.size);
    }

    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = Math.max(0, Math.min(1, (t.life / t.maxLife) * 1.4));
      ctx.globalAlpha = alpha;
      const sx = Math.round(t.x - camX);
      const sy = Math.round(t.y - camY);
      const fontSize = Math.round(13 * t.scale);
      ctx.font = `800 ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      ctx.strokeStyle = '#07090e';
      ctx.lineWidth = 3.5;
      ctx.strokeText(t.text, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);

      if (t.subtext) {
        ctx.font = `700 ${Math.round(10 * t.scale)}px "Inter", "Segoe UI", system-ui, sans-serif`;
        ctx.strokeText(t.subtext, sx, sy + 13);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.subtext, sx, sy + 13);
      }
    }
    ctx.globalAlpha = 1;
  }
}
