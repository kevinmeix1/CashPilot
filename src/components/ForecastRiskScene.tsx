import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CashDriverInsight, ForecastScenario } from "../types/domain";

interface ForecastRiskSceneProps {
  baseline: ForecastScenario;
  afterActions: ForecastScenario;
  threshold: number;
  drivers: CashDriverInsight[];
}

interface ScenePoint {
  x: number;
  y: number;
  z: number;
}

const DAY_COUNT = 90;
const SCENARIO_ROWS = 18;
const DAY_SPACING = 0.34;
const SCENARIO_SPACING = 0.44;
const HEIGHT_RANGE = 4.9;

export function ForecastRiskScene({ baseline, afterActions, threshold, drivers }: ForecastRiskSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sceneData = useMemo(() => {
    const baselinePoints = baseline.points.slice(0, DAY_COUNT);
    const afterPoints = afterActions.points.slice(0, DAY_COUNT);
    const balances = [...baselinePoints, ...afterPoints].map((point) => point.closingBalance);
    const minBalance = Math.min(...balances, threshold);
    const maxBalance = Math.max(...balances, threshold);
    const paddedMin = minBalance - Math.max(1400, Math.abs(minBalance) * 0.08);
    const paddedMax = maxBalance + Math.max(1400, Math.abs(maxBalance) * 0.08);
    const span = Math.max(1, paddedMax - paddedMin);
    const xOffset = ((baselinePoints.length || DAY_COUNT) - 1) * DAY_SPACING * 0.5;
    const zOffset = (SCENARIO_ROWS - 1) * SCENARIO_SPACING * 0.5;

    function yFor(balance: number) {
      return ((balance - paddedMin) / span) * HEIGHT_RANGE - HEIGHT_RANGE * 0.5;
    }

    function xFor(index: number) {
      return index * DAY_SPACING - xOffset;
    }

    function zFor(row: number) {
      return row * SCENARIO_SPACING - zOffset;
    }

    return {
      baselinePoints,
      afterPoints,
      minBalance: paddedMin,
      maxBalance: paddedMax,
      thresholdY: yFor(threshold),
      yFor,
      xFor,
      zFor,
      width: ((baselinePoints.length || DAY_COUNT) - 1) * DAY_SPACING,
      depth: (SCENARIO_ROWS - 1) * SCENARIO_SPACING
    };
  }, [afterActions.points, baseline.points, threshold]);

  const biggestRisk = drivers.find((driver) => driver.direction !== "positive");
  const biggestOpportunity = drivers.find((driver) => driver.direction === "positive");
  const breachDate = baseline.summary.firstThresholdBreachDate ?? "No breach";
  const minimumLift = afterActions.summary.minimumCashBalance - baseline.summary.minimumCashBalance;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || sceneData.baselinePoints.length === 0) return;
    const hostElement = host;
    const canvasElement = canvas;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvasElement,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050817, 13, 32);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(-4.8, 6.0, 12.4);
    camera.lookAt(0, 0.15, 0);

    const root = new THREE.Group();
    root.rotation.x = -0.08;
    scene.add(root);

    const ambient = new THREE.AmbientLight(0x7f8cff, 1.45);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0x9cf8ff, 2.2);
    keyLight.position.set(-5, 8, 9);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x6d6cff, 24, 28);
    rimLight.position.set(8, 5, -6);
    scene.add(rimLight);

    const disposable: Array<{ dispose: () => void }> = [];

    const terrain = buildRiskTerrain(sceneData, threshold);
    root.add(terrain.mesh);
    disposable.push(terrain.geometry, terrain.material);

    const thresholdPlane = buildThresholdPlane(sceneData);
    root.add(thresholdPlane.mesh);
    disposable.push(thresholdPlane.geometry, thresholdPlane.material);

    const baselineLine = buildPathLine(sceneData.baselinePoints.map((point, index) => ({
      x: sceneData.xFor(index),
      y: sceneData.yFor(point.closingBalance) + 0.06,
      z: -sceneData.depth * 0.19
    })), 0xff4d6d);
    root.add(baselineLine.line);
    disposable.push(baselineLine.geometry, baselineLine.material);

    const afterLine = buildPathLine(sceneData.afterPoints.map((point, index) => ({
      x: sceneData.xFor(index),
      y: sceneData.yFor(point.closingBalance) + 0.11,
      z: sceneData.depth * 0.19
    })), 0x41d8c5);
    root.add(afterLine.line);
    disposable.push(afterLine.geometry, afterLine.material);

    const actionBridge = buildActionBridge(sceneData);
    root.add(actionBridge.line);
    disposable.push(actionBridge.geometry, actionBridge.material);

    const driverCluster = buildDriverPillars(sceneData, drivers);
    root.add(driverCluster.group);
    disposable.push(...driverCluster.disposable);

    const particleField = buildRiskParticles(sceneData, threshold);
    root.add(particleField.points);
    disposable.push(particleField.geometry, particleField.material);

    const axes = buildGridBase(sceneData);
    root.add(axes.group);
    disposable.push(...axes.disposable);

    const pointer = {
      active: false,
      x: 0,
      rotation: root.rotation.y
    };

    function onPointerDown(event: PointerEvent) {
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.rotation = root.rotation.y;
      canvasElement.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointer.active) return;
      const delta = (event.clientX - pointer.x) / Math.max(1, hostElement.clientWidth);
      root.rotation.y = pointer.rotation + delta * 1.2;
    }

    function onPointerUp(event: PointerEvent) {
      pointer.active = false;
      if (canvasElement.hasPointerCapture(event.pointerId)) canvasElement.releasePointerCapture(event.pointerId);
    }

    canvasElement.addEventListener("pointerdown", onPointerDown);
    canvasElement.addEventListener("pointermove", onPointerMove);
    canvasElement.addEventListener("pointerup", onPointerUp);
    canvasElement.addEventListener("pointercancel", onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, hostElement.clientWidth);
      const height = Math.max(1, hostElement.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(hostElement);
    const initialWidth = Math.max(1, hostElement.clientWidth);
    const initialHeight = Math.max(1, hostElement.clientHeight);
    renderer.setSize(initialWidth, initialHeight, false);
    camera.aspect = initialWidth / initialHeight;
    camera.updateProjectionMatrix();

    const startTime = Date.now();
    renderer.setAnimationLoop(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (!pointer.active) {
        root.rotation.y = Math.sin(elapsed * 0.28) * 0.12;
      }
      terrain.mesh.rotation.z = Math.sin(elapsed * 0.22) * 0.008;
      particleField.points.position.y = Math.sin(elapsed * 1.15) * 0.12;
      particleField.points.rotation.y = elapsed * 0.08;
      driverCluster.group.children.forEach((child, index) => {
        child.scale.y = 1 + Math.sin(elapsed * 1.2 + index) * 0.035;
      });
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", onPointerUp);
      canvasElement.removeEventListener("pointercancel", onPointerUp);
      disposable.forEach((item) => item.dispose());
      renderer.dispose();
    };
  }, [drivers, sceneData, threshold]);

  return (
    <div className="forecastSceneBand">
      <div className="forecastSceneHeader">
        <div>
          <strong>3D cash-risk terrain</strong>
          <span>Monte Carlo surface · threshold plane · action lift paths</span>
        </div>
        <div className="sceneLegend" aria-label="3D visualization legend">
          <span className="risk">Baseline</span>
          <span className="safe">After actions</span>
          <span className="threshold">Safe threshold</span>
        </div>
      </div>

      <div ref={hostRef} className="forecastSceneShell">
        <canvas ref={canvasRef} className="forecastSceneCanvas" aria-label="3D forecast risk visualization" />
        <div className="sceneMetricStack">
          <div>
            <span>Risk window</span>
            <strong>{breachDate}</strong>
          </div>
          <div>
            <span>Action lift</span>
            <strong>{money(minimumLift)}</strong>
          </div>
          <div>
            <span>Risk driver</span>
            <strong>{biggestRisk?.label ?? "No major risk"}</strong>
          </div>
          <div>
            <span>Control lever</span>
            <strong>{biggestOpportunity?.label ?? "No lever selected"}</strong>
          </div>
        </div>
        <div className="sceneHint">Drag to rotate · red surface zones fall below the cash safety threshold</div>
      </div>
    </div>
  );
}

function buildRiskTerrain(sceneData: SceneData, threshold: number) {
  const columns = sceneData.baselinePoints.length;
  const rows = SCENARIO_ROWS;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();

  for (let row = 0; row < rows; row += 1) {
    const rowT = row / Math.max(1, rows - 1);
    const reliabilityOffset = (rowT - 0.48) * 1900;
    for (let column = 0; column < columns; column += 1) {
      const point = sceneData.baselinePoints[column];
      const wave = Math.sin(column * 0.32 + row * 0.86) * 420 + Math.cos(column * 0.13 + row * 1.2) * 260;
      const stress = point.closingBalance < threshold ? -900 * (1 - rowT) : 0;
      const simulatedBalance = point.closingBalance + reliabilityOffset + wave + stress;
      const y = sceneData.yFor(simulatedBalance);
      positions.push(sceneData.xFor(column), y, sceneData.zFor(row));

      const distanceFromThreshold = simulatedBalance - threshold;
      if (distanceFromThreshold < 0) {
        color.setHSL(0.96, 0.86, 0.56);
      } else if (distanceFromThreshold < 2600) {
        color.setHSL(0.11, 0.9, 0.58);
      } else {
        color.setHSL(0.49, 0.72, 0.53);
      }
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.18,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.68,
    vertexColors: true
  });

  return { geometry, material, mesh: new THREE.Mesh(geometry, material) };
}

function buildThresholdPlane(sceneData: SceneData) {
  const geometry = new THREE.PlaneGeometry(sceneData.width + 1.6, sceneData.depth + 1.2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff4d6d,
    depthWrite: false,
    opacity: 0.16,
    side: THREE.DoubleSide,
    transparent: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = sceneData.thresholdY;
  return { geometry, material, mesh };
}

function buildPathLine(points: ScenePoint[], color: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
  const geometry = new THREE.TubeGeometry(curve, 120, 0.035, 8, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.65,
    metalness: 0.1,
    roughness: 0.32
  });
  const line = new THREE.Mesh(geometry, material);
  return { geometry, material, line };
}

function buildActionBridge(sceneData: SceneData) {
  const positions: number[] = [];
  const step = Math.max(4, Math.floor(sceneData.baselinePoints.length / 14));
  for (let index = 0; index < sceneData.baselinePoints.length; index += step) {
    const before = sceneData.baselinePoints[index];
    const after = sceneData.afterPoints[index] ?? before;
    positions.push(
      sceneData.xFor(index),
      sceneData.yFor(before.closingBalance) + 0.1,
      -sceneData.depth * 0.19,
      sceneData.xFor(index),
      sceneData.yFor(after.closingBalance) + 0.1,
      sceneData.depth * 0.19
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x8e8cff,
    opacity: 0.42,
    transparent: true
  });
  return { geometry, material, line: new THREE.LineSegments(geometry, material) };
}

function buildDriverPillars(sceneData: SceneData, drivers: CashDriverInsight[]) {
  const group = new THREE.Group();
  const disposable: Array<{ dispose: () => void }> = [];
  const maxImpact = Math.max(1, ...drivers.map((driver) => driver.impactAmount));
  const startX = -Math.min(sceneData.width * 0.48, 7.2);

  drivers.slice(0, 6).forEach((driver, index) => {
    const height = 0.38 + (driver.impactAmount / maxImpact) * 2.1;
    const color = driver.direction === "positive" ? 0x41d8c5 : driver.direction === "risk" ? 0xff4d6d : 0xf5b64c;
    const geometry = new THREE.CylinderGeometry(0.11, 0.2, height, 18, 1);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.28,
      metalness: 0.22,
      roughness: 0.35
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(startX + index * 0.72, sceneData.thresholdY + height / 2, sceneData.depth * 0.66);
    group.add(pillar);
    disposable.push(geometry, material);
  });

  return { group, disposable };
}

function buildRiskParticles(sceneData: SceneData, threshold: number) {
  const riskyDays = sceneData.baselinePoints
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.closingBalance < threshold + 1400);
  const sourceDays = riskyDays.length > 0 ? riskyDays : sceneData.baselinePoints.map((point, index) => ({ point, index }));
  const count = 170;
  const positions: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const day = sourceDays[i % sourceDays.length];
    const x = sceneData.xFor(day.index) + Math.sin(i * 2.31) * 0.18;
    const z = -sceneData.depth * 0.48 + ((i * 37) % 100) / 100 * sceneData.depth * 0.96;
    const y = sceneData.yFor(day.point.closingBalance) + 0.18 + ((i * 19) % 100) / 100 * 1.2;
    positions.push(x, y, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xff6b7a,
    depthWrite: false,
    opacity: 0.58,
    size: 0.055,
    transparent: true
  });
  return { geometry, material, points: new THREE.Points(geometry, material) };
}

function buildGridBase(sceneData: SceneData) {
  const group = new THREE.Group();
  const disposable: Array<{ dispose: () => void }> = [];
  const material = new THREE.LineBasicMaterial({
    color: 0x33406b,
    opacity: 0.38,
    transparent: true
  });
  disposable.push(material);

  const positions: number[] = [];
  const baseY = -HEIGHT_RANGE * 0.5 - 0.2;
  for (let day = 0; day < sceneData.baselinePoints.length; day += 10) {
    positions.push(sceneData.xFor(day), baseY, -sceneData.depth * 0.56, sceneData.xFor(day), baseY, sceneData.depth * 0.56);
  }
  for (let row = 0; row < SCENARIO_ROWS; row += 3) {
    positions.push(-sceneData.width * 0.54, baseY, sceneData.zFor(row), sceneData.width * 0.54, baseY, sceneData.zFor(row));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  disposable.push(geometry);
  group.add(new THREE.LineSegments(geometry, material));
  return { group, disposable };
}

type SceneData = {
  baselinePoints: ForecastScenario["points"];
  afterPoints: ForecastScenario["points"];
  minBalance: number;
  maxBalance: number;
  thresholdY: number;
  yFor: (balance: number) => number;
  xFor: (index: number) => number;
  zFor: (row: number) => number;
  width: number;
  depth: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}
