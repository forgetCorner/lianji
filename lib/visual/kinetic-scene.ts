import { Mesh, Program, Renderer, Triangle, Vec2 } from "ogl";
import { kineticFragmentShader, kineticVertexShader } from "@/lib/visual/kinetic-shaders";

export type KineticMode = "boot" | "today" | "plan" | "ranking" | "profile" | "workout" | "rest";
export type KineticIntensity = "idle" | "active" | "success" | "error";

const modeValues: Record<KineticMode, number> = {
  boot: 0,
  today: 1,
  plan: 2,
  ranking: 3,
  profile: 4,
  workout: 5,
  rest: 6,
};

const intensityValues: Record<KineticIntensity, number> = {
  idle: 0.15,
  active: 0.48,
  success: 1,
  error: 0.86,
};

type SceneOptions = {
  canvas: HTMLCanvasElement;
  mode: KineticMode;
  intensity: KineticIntensity;
  progress?: number;
};

export class KineticScene {
  private readonly renderer: Renderer;
  private readonly program: Program;
  private readonly geometry: Triangle;
  private readonly mesh: Mesh;
  private readonly pointer = new Vec2(0, 0);
  private readonly pointerTarget = new Vec2(0, 0);
  private animationFrame = 0;
  private startedAt = performance.now();
  private modeCurrent: number;
  private modeTarget: number;
  private intensityCurrent: number;
  private intensityTarget: number;
  private progressCurrent: number;
  private progressTarget: number;
  private pulseCurrent = 1;
  private running = true;
  private quality = 1;
  private sampleStartedAt = performance.now();
  private sampledFrames = 0;

  constructor(private readonly options: SceneOptions) {
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
    this.quality = isMobile ? 0.42 : 1;
    this.modeCurrent = this.modeTarget = modeValues[options.mode];
    this.intensityCurrent = this.intensityTarget = intensityValues[options.intensity];
    this.progressCurrent = this.progressTarget = options.progress ?? 0;

    this.renderer = new Renderer({
      canvas: options.canvas,
      dpr,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    const gl = this.renderer.gl;
    gl.clearColor(0.025, 0.038, 0.03, 1);

    this.geometry = new Triangle(gl);
    this.program = new Program(gl, {
      vertex: kineticVertexShader,
      fragment: kineticFragmentShader,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
      uniforms: {
        uTime: { value: 0 },
        uMode: { value: this.modeCurrent },
        uIntensity: { value: this.intensityCurrent },
        uProgress: { value: this.progressCurrent },
        uPulse: { value: this.pulseCurrent },
        uAspect: { value: 1 },
        uQuality: { value: this.quality },
        uPointer: { value: this.pointer },
      },
    });
    if (!gl.getProgramParameter(this.program.program, gl.LINK_STATUS)) {
      throw new Error("动能背景着色器初始化失败");
    }
    this.mesh = new Mesh(gl, { geometry: this.geometry, program: this.program });
    this.resize();
    this.render = this.render.bind(this);
    this.animationFrame = requestAnimationFrame(this.render);
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.renderer.setSize(width, height);
    this.program.uniforms.uAspect.value = width / height;
  }

  setPointer(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  setMode(mode: KineticMode, intensity: KineticIntensity, progress = this.progressTarget) {
    this.modeTarget = modeValues[mode];
    this.intensityTarget = intensityValues[intensity];
    this.progressTarget = Math.min(1, Math.max(0, progress));
  }

  pulse() {
    this.pulseCurrent = 0;
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now() - this.program.uniforms.uTime.value * 1000;
    this.animationFrame = requestAnimationFrame(this.render);
  }

  destroy() {
    this.pause();
    this.geometry.remove();
    this.program.remove();
  }

  private render(now: number) {
    if (!this.running) return;
    const smoothing = 0.045;
    this.modeCurrent += (this.modeTarget - this.modeCurrent) * smoothing;
    this.intensityCurrent += (this.intensityTarget - this.intensityCurrent) * 0.07;
    this.progressCurrent += (this.progressTarget - this.progressCurrent) * 0.08;
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.055;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.055;
    this.pulseCurrent = Math.min(1, this.pulseCurrent + 0.012);

    this.program.uniforms.uTime.value = (now - this.startedAt) / 1000;
    this.program.uniforms.uMode.value = this.modeCurrent;
    this.program.uniforms.uIntensity.value = this.intensityCurrent;
    this.program.uniforms.uProgress.value = this.progressCurrent;
    this.program.uniforms.uPulse.value = this.pulseCurrent;
    this.program.uniforms.uQuality.value = this.quality;

    this.renderer.render({ scene: this.mesh, clear: true });
    this.sampledFrames += 1;
    const sampleDuration = now - this.sampleStartedAt;
    if (sampleDuration > 2400) {
      const fps = this.sampledFrames / (sampleDuration / 1000);
      if (fps < 50 && this.quality > 0.45) this.quality = Math.max(0.45, this.quality - 0.28);
      this.sampleStartedAt = now;
      this.sampledFrames = 0;
    }
    this.animationFrame = requestAnimationFrame(this.render);
  }
}
