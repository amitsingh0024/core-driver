/** Keyboard and pointer state for the dive screen. */
export class DiveInput {
  public pointerDown = false;
  public pointerX = 0;
  public pointerY = 0;
  public holdingExtractBtn = false;
  private keysDown = new Set<string>();

  constructor(
    private canvas: HTMLCanvasElement,
    private isActive: () => boolean,
    private isPaused: () => boolean,
    private onPauseKey: () => void
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isActive()) {
        e.preventDefault();
        this.onPauseKey();
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.isActive()) {
        e.preventDefault();
      }
      this.keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => this.clear());

    canvas.addEventListener('pointerdown', (e) => {
      if (this.isPaused()) return;
      this.pointerDown = true;
      this.setPointer(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (this.pointerDown) this.setPointer(e);
    });
    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
      this.holdingExtractBtn = false;
    });
  }

  private setPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;
  }

  public bindExtractButton(btn: HTMLElement): void {
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.holdingExtractBtn = true;
    });
    btn.addEventListener('pointerleave', () => {
      this.holdingExtractBtn = false;
    });
  }

  public clear(): void {
    this.keysDown.clear();
    this.pointerDown = false;
    this.holdingExtractBtn = false;
  }

  /** WASD / ZQSD / arrow keys as a -1..1 vector (+y is down). */
  public moveVector(): { x: number; y: number } {
    const k = this.keysDown;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('KeyQ') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyW') || k.has('KeyZ') || k.has('ArrowUp')) y -= 1;
    return { x, y };
  }

  public holdingExtract(): boolean {
    const k = this.keysDown;
    return this.holdingExtractBtn || k.has('Space') || k.has('KeyE') || k.has('KeyR');
  }
}
