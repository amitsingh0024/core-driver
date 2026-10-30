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
  shape?: 'shard' | 'spark' | 'smoke';
  angle?: number;
  vAngle?: number;
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
    if (this.particles.length > 380) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 110;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 25;
      this.particles.push({
        x,
        y,
        vx,
        vy,
        size: 2.2 + Math.random() * 2.4,
        color,
        life: 0.2 + Math.random() * 0.22,
        maxLife: 0.42,
        gravity: 220,
        shape: 'spark',
        angle: Math.atan2(vy, vx),
      });
    }
  }

  public spawnBlockBurst(x: number, y: number, baseColor: string, oreColor?: string, count = 12): void {
    if (this.particles.length > 440) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 42 + Math.random() * 135;
      const useOre = oreColor && i % 2 === 0;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 38,
        size: useOre ? 3.8 + Math.random() * 2.6 : 3.2 + Math.random() * 3.2,
        color: useOre ? oreColor : baseColor,
        life: 0.38 + Math.random() * 0.36,
        maxLife: 0.74,
        gravity: 290,
        shape: 'shard',
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 15,
      });
    }
  }

  public spawnExhaustSmoke(x: number, y: number, vx: number, vy: number, isLowFuel = false): void {
    if (this.particles.length > 420) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 5,
      y: y + (Math.random() - 0.5) * 5,
      vx: vx + (Math.random() - 0.5) * 18,
      vy: vy + (Math.random() - 0.5) * 14,
      size: isLowFuel ? 4.5 + Math.random() * 3.5 : 3.2 + Math.random() * 2.5,
      color: isLowFuel ? '#37474f' : '#90a4ae',
      life: isLowFuel ? 0.48 : 0.32,
      maxLife: isLowFuel ? 0.48 : 0.32,
      gravity: -28,
      shape: 'smoke',
    });
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
      vy: -52,
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
      if (p.shape === 'shard' && p.vAngle !== undefined) {
        p.angle = (p.angle ?? 0) + p.vAngle * dt;
      } else if (p.shape === 'spark') {
        p.angle = Math.atan2(p.vy, p.vx);
      } else if (p.shape === 'smoke') {
        p.size += dt * 7.5;
        p.vx *= 0.96;
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.95;
    }
  }

  public render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      const sx = p.x - camX;
      const sy = p.y - camY;

      if (p.shape === 'smoke') {
        ctx.globalAlpha = alpha * 0.36;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.angle ?? 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 1.6, -p.size * 0.38, p.size * 3.2, p.size * 0.76);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-p.size * 0.6, -p.size * 0.2, p.size * 1.6, p.size * 0.4);
        ctx.restore();
      } else {
        // Tumbling polygonal rock/crystal shard
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.angle ?? 0);
        ctx.globalAlpha = alpha;
        const r = p.size * 0.62;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = 'rgba(7, 9, 14, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.6);
        ctx.lineTo(r * 0.4, -r);
        ctx.lineTo(r, r * 0.2);
        ctx.lineTo(r * 0.2, r);
        ctx.lineTo(-r * 0.85, r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const lifeRatio = t.life / t.maxLife;
      const age = 1 - lifeRatio;
      const popScale =
        age < 0.14
          ? 0.55 + Math.sin((age / 0.14) * Math.PI * 0.72) * 0.62
          : 1;
      const alpha = Math.max(0, Math.min(1, lifeRatio * 1.45));
      ctx.globalAlpha = alpha;
      const sx = Math.round(t.x - camX);
      const sy = Math.round(t.y - camY);
      const fontSize = Math.max(9, Math.round(13 * t.scale * popScale));
      ctx.font = `800 ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      ctx.strokeStyle = '#07090e';
      ctx.lineWidth = 3.5;
      ctx.strokeText(t.text, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);

      if (t.subtext) {
        ctx.font = `700 ${Math.max(8, Math.round(10 * t.scale * popScale))}px "Inter", "Segoe UI", system-ui, sans-serif`;
        ctx.strokeText(t.subtext, sx, sy + 13);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.subtext, sx, sy + 13);
      }
    }
    ctx.globalAlpha = 1;
  }
}
