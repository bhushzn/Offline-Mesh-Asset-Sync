// ============================================================
// FIELDLINK — High-Performance Interactive 3D Tactical Mesh
// Three.js with OrbitControls, Raycasting, Dynamic Links & Telemetry
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { syncManager, SyncPacketEvent } from '../../services/syncManager';
import { PeerNode } from '../../types/tactical';
import { 
  Radio, 
  RefreshCw, 
  RotateCcw, 
  ShieldCheck, 
  Zap, 
  Maximize2, 
  Info,
  X
} from 'lucide-react';
import { tacticalAudio } from '../../utils/audio';

export interface Node3DData {
  id: string;
  name: string;
  shortCode: string;
  role: string;
  type: 'North Node' | 'Delta Patrol' | 'Relay Gateway' | 'Command Hub';
  status: 'online' | 'degraded' | 'offline' | 'discovered';
  position: THREE.Vector3;
  color: number;
  batteryLevel: number;
  rssi: number;
  latencyMs: number;
  connectionType: 'WebRTC' | 'BLE' | 'LocalNetwork' | 'Cloud';
  lastSync: number;
  isTrusted: boolean;
  mesh?: THREE.Mesh;
  glowMesh?: THREE.Mesh;
  haloMesh?: THREE.Mesh;
  labelSprite?: THREE.Sprite;
}

export interface Link3DData {
  id: string;
  sourceId: string;
  targetId: string;
  latencyMs: number;
  transportType: string;
  status: 'active' | 'congested' | 'idle';
  lastActivity: number;
  lineMesh?: THREE.Line;
}

interface MeshTopology3DProps {
  height?: string;
  selectedNodeId?: string;
  onSelectNode?: (node: PeerNode | null) => void;
  interactive?: boolean;
}

export const MeshTopology3D: React.FC<MeshTopology3DProps> = ({
  height = '480px',
  selectedNodeId: controlledSelectedId,
  onSelectNode,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node3DData | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link3DData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3DData | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activePacketsCount, setActivePacketsCount] = useState(0);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [meshMetrics, setMeshMetrics] = useState({
    nodeCount: 5,
    linkCount: 7,
    avgLatency: '14ms',
    networkHealth: '100% Operational',
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesMapRef = useRef<Map<string, Node3DData>>(new Map());
  const linksMapRef = useRef<Map<string, Link3DData>>(new Map());
  const nodesGroupRef = useRef<THREE.Group | null>(null);
  const linksGroupRef = useRef<THREE.Group | null>(null);
  const packetMeshesRef = useRef<Array<{
    mesh: THREE.Mesh;
    start: THREE.Vector3;
    end: THREE.Vector3;
    progress: number;
    speed: number;
    color: number;
  }>>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const defaultCameraPos = useRef(new THREE.Vector3(0, 8.0, 12.0));
  const defaultTarget = useRef(new THREE.Vector3(0, -0.4, 0));

  // Create crisp Sprite text billboard for clean node labels
  const createLabelSprite = (text: string, subtext: string, colorHex: string): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Rounded background plate
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 3.5;
      
      const r = 16;
      const x = 8, y = 8, w = 368, h = 112;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Text line 1: Call-sign
      ctx.font = 'bold 36px "JetBrains Mono", monospace, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(text, 192, 52);

      // Text line 2: Role / Subtitle
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.fillStyle = colorHex;
      ctx.fillText(subtext, 192, 90);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.9, 0.62, 1);
    return sprite;
  };

  // Synchronize controlled selected node
  useEffect(() => {
    if (controlledSelectedId && nodesMapRef.current.has(controlledSelectedId)) {
      const node = nodesMapRef.current.get(controlledSelectedId);
      if (node && node !== selectedNode) {
        setSelectedNode(node);
      }
    }
  }, [controlledSelectedId]);

  // Update link visual highlighting when a node is selected or hovered
  const updateLinkVisuals = useCallback((activeNodeId: string | null) => {
    linksMapRef.current.forEach((link) => {
      if (!link.lineMesh) return;
      const lineMat = link.lineMesh.material as THREE.LineBasicMaterial;
      if (!activeNodeId) {
        lineMat.color.setHex(0x38bdf8);
        lineMat.opacity = 0.35;
        lineMat.linewidth = 1;
      } else if (link.sourceId === activeNodeId || link.targetId === activeNodeId) {
        lineMat.color.setHex(0x06b6d4);
        lineMat.opacity = 0.95;
        lineMat.linewidth = 2.5;
      } else {
        lineMat.color.setHex(0x1e293b);
        lineMat.opacity = 0.15;
        lineMat.linewidth = 1;
      }
    });
  }, []);

  useEffect(() => {
    const activeId = selectedNode?.id || hoveredNode?.id || null;
    updateLinkVisuals(activeId);
  }, [selectedNode, hoveredNode, updateLinkVisuals]);

  // Spawn visual 3D packet along link
  const spawn3DPacket = useCallback((fromId: string, toId: string, color = 0x06b6d4, speed = 0.03) => {
    if (!sceneRef.current) return;
    const fromNode = nodesMapRef.current.get(fromId) || nodesMapRef.current.get('device-a17');
    const toNode = nodesMapRef.current.get(toId) || nodesMapRef.current.get('device-b04');
    if (!fromNode || !toNode) return;

    const pktGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const pktMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });
    const pktMesh = new THREE.Mesh(pktGeo, pktMat);
    pktMesh.position.copy(fromNode.position);
    sceneRef.current.add(pktMesh);

    packetMeshesRef.current.push({
      mesh: pktMesh,
      start: fromNode.position.clone(),
      end: toNode.position.clone(),
      progress: 0,
      speed,
      color,
    });
  }, []);

  // Main Three.js Scene Setup & Lifecycle
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const heightPx = containerRef.current.clientHeight || 480;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep Navy Slate viewport background
    scene.fog = new THREE.FogExp2(0x0f172a, 0.035);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000);
    camera.position.copy(defaultCameraPos.current);
    camera.lookAt(defaultTarget.current);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    
    const container = containerRef.current;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = 4;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2 + 0.15; // Don't flip below ground
    controls.target.copy(defaultTarget.current);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(5, 12, 8);
    scene.add(dirLight);

    const pointLightCyan = new THREE.PointLight(0x06b6d4, 3, 22);
    pointLightCyan.position.set(0, 4, 0);
    scene.add(pointLightCyan);

    const pointLightAmber = new THREE.PointLight(0xf59e0b, 2, 20);
    pointLightAmber.position.set(-4, -2, 3);
    scene.add(pointLightAmber);

    // 6. Tactical Radar Grid Ground Plane
    const gridHelper = new THREE.GridHelper(20, 24, 0x334155, 0x1e293b);
    gridHelper.position.y = -2.5;
    scene.add(gridHelper);

    // Concentric Radar Rings on Floor
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: 0x06b6d4, 
      transparent: true, 
      opacity: 0.18, 
      side: THREE.DoubleSide 
    });
    for (let r = 2.5; r <= 9.5; r += 2.5) {
      const ringGeo = new THREE.RingGeometry(r - 0.04, r, 64);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -2.48;
      scene.add(ringMesh);
    }

    // Starfield / Floating Tactical Data Particles
    const particleCount = 220;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 24;
      particlePositions[i + 1] = (Math.random() - 0.5) * 12;
      particlePositions[i + 2] = (Math.random() - 0.5) * 24;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.07, transparent: true, opacity: 0.5 });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. Tactical Nodes Definition
    const tacticalNodes: Node3DData[] = [
      {
        id: 'device-a17',
        name: 'A-17 / NORTH NODE (LOCAL)',
        shortCode: 'A-17',
        role: 'Field Lead',
        type: 'North Node',
        status: 'online',
        position: new THREE.Vector3(0, 0.4, 0),
        color: 0x10b981, // Emerald Green
        batteryLevel: 94,
        rssi: -42,
        latencyMs: 12,
        connectionType: 'WebRTC',
        lastSync: Date.now() - 1000 * 20,
        isTrusted: true,
      },
      {
        id: 'device-b04',
        name: 'B-04 / DELTA PATROL',
        shortCode: 'B-04',
        role: 'Scout Lead',
        type: 'Delta Patrol',
        status: 'online',
        position: new THREE.Vector3(-3.2, 0.2, 1.6),
        color: 0x06b6d4, // Cyan
        batteryLevel: 82,
        rssi: -58,
        latencyMs: 18,
        connectionType: 'WebRTC',
        lastSync: Date.now() - 1000 * 45,
        isTrusted: true,
      },
      {
        id: 'device-c12',
        name: 'C-12 / RECON DRONE',
        shortCode: 'C-12',
        role: 'Airborne Relay',
        type: 'Relay Gateway',
        status: 'online',
        position: new THREE.Vector3(3.2, 1.4, -1.8),
        color: 0x8b5cf6, // Purple
        batteryLevel: 68,
        rssi: -62,
        latencyMs: 24,
        connectionType: 'WebRTC',
        lastSync: Date.now() - 1000 * 30,
        isTrusted: true,
      },
      {
        id: 'device-r01',
        name: 'R-01 / COMMAND RELAY',
        shortCode: 'R-01',
        role: 'HQ Gateway',
        type: 'Command Hub',
        status: 'online',
        position: new THREE.Vector3(0.4, 0.6, -3.2),
        color: 0xf97316, // Orange
        batteryLevel: 99,
        rssi: -48,
        latencyMs: 14,
        connectionType: 'LocalNetwork',
        lastSync: Date.now() - 1000 * 15,
        isTrusted: true,
      },
      {
        id: 'device-m08',
        name: 'M-08 / MEDICAL OUTPOST',
        shortCode: 'M-08',
        role: 'Field Triage',
        type: 'Delta Patrol',
        status: 'discovered',
        position: new THREE.Vector3(2.6, -0.4, 2.2),
        color: 0xf59e0b, // Amber
        batteryLevel: 75,
        rssi: -71,
        latencyMs: 38,
        connectionType: 'BLE',
        lastSync: Date.now() - 1000 * 90,
        isTrusted: true,
      }
    ];

    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);
    nodesGroupRef.current = nodesGroup;

    tacticalNodes.forEach((node) => {
      // Core sphere
      const sphereGeo = new THREE.SphereGeometry(0.42, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.7,
        roughness: 0.15,
        metalness: 0.85,
      });
      const nodeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      nodeMesh.position.copy(node.position);
      nodeMesh.userData = { id: node.id, nodeData: node, isNode: true };
      nodesGroup.add(nodeMesh);

      // Pulsing outer halo
      const haloGeo = new THREE.SphereGeometry(0.65, 20, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(node.position);
      nodesGroup.add(haloMesh);

      // Floating billboard label
      const colorHex = `#${node.color.toString(16).padStart(6, '0')}`;
      const labelSprite = createLabelSprite(node.shortCode, node.role, colorHex);
      labelSprite.position.set(node.position.x, node.position.y + 0.72, node.position.z);
      nodesGroup.add(labelSprite);

      // Vertical beacon line to floor
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        node.position,
        new THREE.Vector3(node.position.x, -2.48, node.position.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: node.color,
        dashSize: 0.2,
        gapSize: 0.12,
        transparent: true,
        opacity: 0.35,
      });
      const dropLine = new THREE.Line(lineGeo, lineMat);
      dropLine.computeLineDistances();
      scene.add(dropLine);

      node.mesh = nodeMesh;
      node.haloMesh = haloMesh;
      node.labelSprite = labelSprite;
      nodesMapRef.current.set(node.id, node);
    });

    // 8. Tactical Mesh Links
    const linkPairs: [string, string, number, string][] = [
      ['device-a17', 'device-b04', 16, 'WebRTC P2P'],
      ['device-a17', 'device-c12', 22, 'WebRTC P2P'],
      ['device-a17', 'device-r01', 12, 'LAN Backbone'],
      ['device-a17', 'device-m08', 35, 'BLE Mesh'],
      ['device-b04', 'device-c12', 26, 'WebRTC Relay'],
      ['device-b04', 'device-m08', 42, 'BLE / Direct'],
      ['device-r01', 'device-c12', 18, 'WebRTC Relay'],
    ];

    const linksGroup = new THREE.Group();
    scene.add(linksGroup);
    linksGroupRef.current = linksGroup;

    linkPairs.forEach(([fromId, toId, lat, transport]) => {
      const fromNode = nodesMapRef.current.get(fromId);
      const toNode = nodesMapRef.current.get(toId);
      if (fromNode && toNode) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([fromNode.position, toNode.position]);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        const linkId = `${fromId}<->${toId}`;
        lineMesh.userData = { linkId, isLink: true, fromId, toId };
        linksGroup.add(lineMesh);

        linksMapRef.current.set(linkId, {
          id: linkId,
          sourceId: fromId,
          targetId: toId,
          latencyMs: lat,
          transportType: transport,
          status: 'active',
          lastActivity: Date.now() - 1000 * Math.floor(Math.random() * 30),
          lineMesh,
        });
      }
    });

    // 9. Raycasting for Mouse Hover and Clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getRaycastHit = (event: MouseEvent) => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(nodesGroup.children, true);
      return intersects;
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (!interactive) return;
      const intersects = getRaycastHit(event);
      if (intersects && intersects.length > 0) {
        const hit = intersects.find((i) => (i.object.userData as any)?.isNode);
        if (hit) {
          const nodeData = (hit.object.userData as any)?.nodeData as Node3DData;
          if (nodeData) {
            setHoveredNode(nodeData);
            if (containerRef.current) containerRef.current.style.cursor = 'pointer';
            return;
          }
        }
      }
      setHoveredNode(null);
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!interactive) return;
      // If clicking with left mouse, check for node hit
      if (event.button !== 0) return;
      
      const intersects = getRaycastHit(event);
      if (intersects && intersects.length > 0) {
        const hit = intersects.find((i) => (i.object.userData as any)?.isNode);
        if (hit) {
          const nodeData = (hit.object.userData as any)?.nodeData as Node3DData;
          if (nodeData) {
            tacticalAudio.playClick();
            setSelectedNode(nodeData);
            setSelectedLink(null);

            if (onSelectNode) {
              const peerStatus: PeerNode['status'] = 
                nodeData.status === 'online' ? 'online' : 
                nodeData.status === 'discovered' ? 'discovered' : 'disconnected';

              const peer: PeerNode = {
                deviceId: nodeData.id,
                deviceName: nodeData.name,
                role: nodeData.role,
                nodeType: nodeData.type,
                rssi: nodeData.rssi,
                status: peerStatus,
                lastSyncAt: nodeData.lastSync,
                latencyMs: nodeData.latencyMs,
                connectionType: nodeData.connectionType,
                isTrusted: nodeData.isTrusted,
                batteryLevel: nodeData.batteryLevel,
              };
              onSelectNode(peer);
            }
          }
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerdown', handlePointerDown);

    // 10. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Controls update for damping
      controls.update();

      // Auto-orbit around center target
      if (autoRotate) {
        scene.rotation.y = elapsedTime * 0.06;
      }

      // Pulse halos & rotate sprites to billboard camera
      nodesMapRef.current.forEach((node) => {
        if (node.haloMesh) {
          const isSel = selectedNode?.id === node.id;
          const isHov = hoveredNode?.id === node.id;
          const baseScale = isSel ? 1.3 : isHov ? 1.15 : 1.0;
          const pulse = 1 + Math.sin(elapsedTime * 3.5 + node.position.x) * (isSel ? 0.2 : 0.1);
          const s = baseScale * pulse;
          node.haloMesh.scale.set(s, s, s);

          const haloMat = node.haloMesh.material as THREE.MeshBasicMaterial;
          haloMat.opacity = isSel ? 0.7 : isHov ? 0.5 : 0.25;
        }

        if (node.labelSprite) {
          // Adjust label scale dynamically with camera distance to avoid visual clutter
          const dist = camera.position.distanceTo(node.position);
          const factor = Math.min(Math.max(dist / 12, 0.7), 1.6);
          node.labelSprite.scale.set(2.4 * factor, 0.8 * factor, 1);
        }
      });

      // Animate sync packets
      const remainingPackets: typeof packetMeshesRef.current = [];
      packetMeshesRef.current.forEach((pkt) => {
        pkt.progress += pkt.speed;
        if (pkt.progress <= 1) {
          pkt.mesh.position.lerpVectors(pkt.start, pkt.end, pkt.progress);
          // Scale packet in flight
          const s = 1 + Math.sin(pkt.progress * Math.PI) * 0.4;
          pkt.mesh.scale.set(s, s, s);
          remainingPackets.push(pkt);
        } else {
          scene.remove(pkt.mesh);
          pkt.mesh.geometry.dispose();
          if (Array.isArray(pkt.mesh.material)) {
            pkt.mesh.material.forEach((m) => m.dispose());
          } else {
            pkt.mesh.material.dispose();
          }
        }
      });
      packetMeshesRef.current = remainingPackets;
      setActivePacketsCount(remainingPackets.length);

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight || 480;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 12. Real Sync Packet Event Subscription
    const unsubPacket = syncManager.subscribePacketEvents((evt: SyncPacketEvent) => {
      spawn3DPacket(evt.fromDeviceId, evt.toDeviceId, 0x10b981, 0.035);
    });

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      unsubPacket();

      if (container && container.contains(domElement)) {
        container.removeChild(domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate, interactive, onSelectNode, spawn3DPacket]);

  // Reset Camera View Smoothly
  const handleResetCamera = () => {
    tacticalAudio.playClick();
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.copy(defaultCameraPos.current);
      controlsRef.current.target.copy(defaultTarget.current);
      controlsRef.current.update();
    }
    if (sceneRef.current) {
      sceneRef.current.rotation.y = 0;
    }
  };

  // Interactive Multi-Hop Mesh Ping
  const handlePingMesh = () => {
    tacticalAudio.playClick();
    setPingStatus('Routing test packets across all links...');
    
    const nodeIds = Array.from(nodesMapRef.current.keys());
    let delay = 0;

    // Dispatch multi-hop sequence
    const hops: [string, string][] = [
      ['device-a17', 'device-b04'],
      ['device-a17', 'device-c12'],
      ['device-a17', 'device-r01'],
      ['device-b04', 'device-m08'],
      ['device-c12', 'device-r01'],
      ['device-m08', 'device-a17'],
    ];

    hops.forEach(([from, to]) => {
      setTimeout(() => {
        spawn3DPacket(from, to, 0xf97316, 0.04);
      }, delay);
      delay += 250;
    });

    syncManager.syncAllPeers();

    setTimeout(() => {
      setPingStatus('✓ All 5 Nodes Responsive · Average Latency 14ms');
      tacticalAudio.playSyncSuccess();
      setTimeout(() => setPingStatus(null), 4000);
    }, delay + 800);
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-lg select-none">
      {/* Top Header Unified Control & Telemetry Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Telemetry Pill */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/70 text-xs font-mono text-slate-200 shadow-md">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30"></span>
            <span className="tracking-wider uppercase text-[11px]">3D Mesh</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-300 font-medium hidden sm:inline">{meshMetrics.nodeCount} Nodes</span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="text-cyan-300 font-medium hidden md:inline">{meshMetrics.linkCount} P2P</span>
          <span className="text-slate-600 hidden lg:inline">|</span>
          <span className="text-emerald-300 font-medium hidden lg:inline">{meshMetrics.avgLatency}</span>
          
          {activePacketsCount > 0 && (
            <span className="bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700 text-[10px] font-semibold animate-pulse flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              {activePacketsCount} Pkts
            </span>
          )}
        </div>

        {/* Right Tactical Controls */}
        <div className="pointer-events-auto flex items-center space-x-1.5">
          {/* Reset Camera Button */}
          <button
            onClick={handleResetCamera}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition flex items-center space-x-1 shadow-sm"
            title="Reset Camera Orientation"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => {
              tacticalAudio.playClick();
              setAutoRotate(!autoRotate);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center space-x-1 border shadow-sm ${
              autoRotate
                ? 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
            }`}
            title="Toggle Auto Orbit Rotation"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
            <span className="hidden sm:inline">{autoRotate ? 'Orbiting' : 'Paused'}</span>
          </button>

          {/* Ping Mesh Action */}
          <button
            onClick={handlePingMesh}
            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-orange-900/40"
            title="Ping all mesh nodes with test packet sweep"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Ping Mesh</span>
          </button>
        </div>
      </div>

      {/* Ping Status Banner */}
      {pingStatus && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-slate-900/95 border border-cyan-500/50 text-cyan-300 px-4 py-1.5 rounded-full text-xs font-mono font-bold shadow-xl animate-in fade-in zoom-in-95">
          {pingStatus}
        </div>
      )}

      {/* Hover Floating Tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="absolute top-16 right-4 z-10 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-slate-100 p-3 rounded-xl text-xs font-mono shadow-xl space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `#${hoveredNode.color.toString(16).padStart(6, '0')}` }}></span>
            <span className="font-bold text-slate-100">{hoveredNode.shortCode}</span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
              {hoveredNode.type}
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">{hoveredNode.name}</div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <span>RSSI: {hoveredNode.rssi} dBm</span>
            <span>Latency: {hoveredNode.latencyMs}ms</span>
          </div>
        </div>
      )}

      {/* 3D Canvas Viewport */}
      <div 
        ref={containerRef} 
        style={{ height }} 
        className="w-full cursor-grab active:cursor-grabbing"
      />

      {/* Selected Node Rich Inspector Panel */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 text-xs font-mono text-slate-200 shadow-2xl animate-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Node Info & Indicators */}
            <div className="flex items-start space-x-3.5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950 font-mono text-sm shadow-md flex-shrink-0"
                style={{ backgroundColor: `#${selectedNode.color.toString(16).padStart(6, '0')}` }}
              >
                {selectedNode.shortCode}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="font-bold text-slate-100 text-sm">{selectedNode.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                    {selectedNode.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {selectedNode.type}
                  </span>
                  {selectedNode.isTrusted && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-blue-400" /> Trusted Node
                    </span>
                  )}
                </div>

                <div className="text-slate-400 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Role: <strong className="text-slate-200">{selectedNode.role}</strong></span>
                  <span>Transport: <strong className="text-cyan-300">{selectedNode.connectionType}</strong></span>
                  <span>Battery: <strong className="text-emerald-400">{selectedNode.batteryLevel}%</strong></span>
                  <span>Signal: <strong className="text-slate-200">{selectedNode.rssi} dBm</strong></span>
                  <span>Latency: <strong className="text-slate-200">{selectedNode.latencyMs} ms</strong></span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 self-end md:self-center">
              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  spawn3DPacket('device-a17', selectedNode.id, 0x06b6d4, 0.035);
                  syncManager.syncWithPeer(selectedNode.id);
                  tacticalAudio.playSyncSuccess();
                }}
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition flex items-center space-x-1.5 shadow-sm touch-target-min"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Node</span>
              </button>

              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  spawn3DPacket('device-a17', selectedNode.id, 0xf97316, 0.05);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition flex items-center space-x-1 touch-target-min"
              >
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span>Ping Node</span>
              </button>

              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setSelectedNode(null);
                  if (onSelectNode) onSelectNode(null);
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                title="Close Inspector"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Guidance Hint */}
      {!selectedNode && (
        <div className="absolute bottom-2.5 left-3.5 z-10 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Left-drag to Orbit · Right-drag to Pan · Wheel/Pinch to Zoom · Click Node sphere to inspect telemetry</span>
        </div>
      )}
    </div>
  );
};

