// FIELDLINK Interactive 3D Mesh Network Visualizer (Three.js)
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { p2pMesh } from '../../services/p2pMeshService';
import { syncManager, SyncPacketEvent } from '../../services/syncManager';
import { PeerNode } from '../../types/tactical';
import { Radio, RefreshCw, ZoomIn, ZoomOut, RotateCcw, Shield, Activity, Wifi } from 'lucide-react';

interface Node3DData {
  id: string;
  name: string;
  role: string;
  type: string;
  status: string;
  position: THREE.Vector3;
  mesh?: THREE.Mesh;
  glowMesh?: THREE.Mesh;
  haloMesh?: THREE.Mesh;
  color: number;
}

interface MeshTopology3DProps {
  height?: string;
  selectedNodeId?: string;
  onSelectNode?: (node: PeerNode | null) => void;
  interactive?: boolean;
}

export const MeshTopology3D: React.FC<MeshTopology3DProps> = ({
  height = '420px',
  selectedNodeId,
  onSelectNode,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node3DData | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activePacketsCount, setActivePacketsCount] = useState(0);
  const [meshStatus, setMeshStatus] = useState({ nodes: 5, links: 7, avgLatency: '18ms' });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodesMapRef = useRef<Map<string, Node3DData>>(new Map());
  const packetMeshesRef = useRef<Array<{ mesh: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; progress: number; speed: number }>>([]);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const heightPx = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d0f);
    scene.fog = new THREE.FogExp2(0x0a0d0f, 0.035);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000);
    camera.position.set(0, 7, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x06b6d4, 3, 20);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const orangeLight = new THREE.PointLight(0xff5533, 2, 20);
    orangeLight.position.set(4, -3, 2);
    scene.add(orangeLight);

    // 5. Grid Ground Plane (Tactical Radar Floor)
    const gridHelper = new THREE.GridHelper(18, 24, 0x232c35, 0x161c22);
    gridHelper.position.y = -2.5;
    scene.add(gridHelper);

    // Concentric Radar Rings on floor
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    for (let r = 2; r <= 8; r += 2) {
      const ringGeo = new THREE.RingGeometry(r - 0.03, r, 64);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -2.48;
      scene.add(ringMesh);
    }

    // Starfield / Tactical particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 20;
      particlePositions[i + 1] = (Math.random() - 0.5) * 10;
      particlePositions[i + 2] = (Math.random() - 0.5) * 20;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x6b7d8e, size: 0.08, transparent: true, opacity: 0.6 });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 6. Define 3D Tactical Nodes
    const tacticalNodes: Node3DData[] = [
      {
        id: 'device-a17',
        name: 'A-17 / NORTH NODE (LOCAL)',
        role: 'Field Lead (Local)',
        type: 'North Node',
        status: 'online',
        position: new THREE.Vector3(0, 0.5, 0),
        color: 0x10b981, // Calming Mint Emerald
      },
      {
        id: 'device-b04',
        name: 'B-04 / DELTA PATROL',
        role: 'Scout Lead',
        type: 'Delta Patrol',
        status: 'online',
        position: new THREE.Vector3(-3.2, 0.8, -1.2),
        color: 0x06b6d4, // Cyber Cyan
      },
      {
        id: 'device-c12',
        name: 'C-12 / RECON DRONE',
        role: 'Airborne Relay',
        type: 'Relay Gateway',
        status: 'online',
        position: new THREE.Vector3(3.4, 2.2, -1.8),
        color: 0x8b5cf6, // Purple
      },
      {
        id: 'device-r01',
        name: 'R-01 / COMMAND RELAY',
        role: 'HQ Gateway',
        type: 'Command Hub',
        status: 'online',
        position: new THREE.Vector3(1.2, -0.6, 3.2),
        color: 0xff5533, // Tactical Orange
      },
      {
        id: 'device-m08',
        name: 'M-08 / MEDICAL OUTPOST',
        role: 'Field Triage',
        type: 'Delta Patrol',
        status: 'discovered',
        position: new THREE.Vector3(-2.2, -1.2, 2.4),
        color: 0xf59e0b, // Warm Amber
      }
    ];

    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    tacticalNodes.forEach((node) => {
      // Core sphere
      const sphereGeo = new THREE.SphereGeometry(0.38, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
      });
      const nodeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      nodeMesh.position.copy(node.position);
      nodeMesh.userData = { id: node.id, nodeData: node };
      nodesGroup.add(nodeMesh);

      // Pulsing outer glow halo
      const haloGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.25,
        wireframe: true,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(node.position);
      nodesGroup.add(haloMesh);

      // Vertical beacon line to floor
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        node.position,
        new THREE.Vector3(node.position.x, -2.48, node.position.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: node.color,
        dashSize: 0.2,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.4,
      });
      const dropLine = new THREE.Line(lineGeo, lineMat);
      dropLine.computeLineDistances();
      scene.add(dropLine);

      node.mesh = nodeMesh;
      node.haloMesh = haloMesh;
      nodesMapRef.current.set(node.id, node);
    });

    // 7. Tactical Mesh Links (Connecting edges)
    const links: [string, string][] = [
      ['device-a17', 'device-b04'],
      ['device-a17', 'device-c12'],
      ['device-a17', 'device-r01'],
      ['device-a17', 'device-m08'],
      ['device-b04', 'device-c12'],
      ['device-b04', 'device-m08'],
      ['device-r01', 'device-c12'],
    ];

    const linksGroup = new THREE.Group();
    scene.add(linksGroup);

    links.forEach(([fromId, toId]) => {
      const fromNode = nodesMapRef.current.get(fromId);
      const toNode = nodesMapRef.current.get(toId);
      if (fromNode && toNode) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([fromNode.position, toNode.position]);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x313e4b,
          transparent: true,
          opacity: 0.7,
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        linksGroup.add(lineMesh);
      }
    });

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      if (!interactive || !containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(nodesGroup.children);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const nodeData = (hit.userData as any)?.nodeData as Node3DData;
        if (nodeData) {
          setSelectedNode(nodeData);
          if (onSelectNode) {
            const peer = p2pMesh.getDiscoveredPeers().find((p) => p.deviceId === nodeData.id) || {
              deviceId: nodeData.id,
              deviceName: nodeData.name,
              role: nodeData.role,
              nodeType: nodeData.type,
              rssi: -55,
              status: nodeData.status as any,
              lastSyncAt: Date.now(),
              latencyMs: 16,
              connectionType: 'WebRTC',
            };
            onSelectNode(peer);
          }
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);

    // 8. Animation loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Rotate starfield & nodes group gently
      if (autoRotate) {
        scene.rotation.y = elapsedTime * 0.08;
      }

      // Pulse halos
      nodesMapRef.current.forEach((node) => {
        if (node.haloMesh) {
          const scale = 1 + Math.sin(elapsedTime * 3 + node.position.x) * 0.15;
          node.haloMesh.scale.set(scale, scale, scale);
        }
      });

      // Animate sync packets in flight
      const remainingPackets: typeof packetMeshesRef.current = [];
      packetMeshesRef.current.forEach((pkt) => {
        pkt.progress += pkt.speed;
        if (pkt.progress <= 1) {
          pkt.mesh.position.lerpVectors(pkt.start, pkt.end, pkt.progress);
          remainingPackets.push(pkt);
        } else {
          scene.remove(pkt.mesh);
          pkt.mesh.geometry.dispose();
        }
      });
      packetMeshesRef.current = remainingPackets;
      setActivePacketsCount(remainingPackets.length);

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 10. Subscribe to real sync packet events
    const unsubPacket = syncManager.subscribePacketEvents((evt) => {
      spawn3DPacket(evt.fromDeviceId, evt.toDeviceId);
    });

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      unsubPacket();
      renderer.dispose();
    };
  }, []);

  // Spawn visual 3D packet between two nodes
  const spawn3DPacket = (fromId: string, toId: string) => {
    if (!sceneRef.current) return;
    const fromNode = nodesMapRef.current.get(fromId) || nodesMapRef.current.get('device-a17');
    const toNode = nodesMapRef.current.get(toId) || nodesMapRef.current.get('device-b04');
    if (!fromNode || !toNode) return;

    const pktGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const pktMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const pktMesh = new THREE.Mesh(pktGeo, pktMat);
    pktMesh.position.copy(fromNode.position);
    sceneRef.current.add(pktMesh);

    packetMeshesRef.current.push({
      mesh: pktMesh,
      start: fromNode.position.clone(),
      end: toNode.position.clone(),
      progress: 0,
      speed: 0.025,
    });
  };

  const triggerTestSyncBroadcast = () => {
    // Fire test animation packets across all nodes
    const nodeIds = Array.from(nodesMapRef.current.keys());
    for (let i = 0; i < nodeIds.length - 1; i++) {
      spawn3DPacket(nodeIds[i], nodeIds[i + 1]);
    }
    syncManager.syncAllPeers();
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-[#232c35] bg-[#0a0d0f]">
      {/* Top Overlay Stats */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-2 bg-[#11161a]/85 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#232c35] text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold uppercase tracking-wider">3D Tactical Mesh</span>
        </div>
        <span className="text-slate-500">|</span>
        <span className="text-slate-300">{meshStatus.nodes} Nodes</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-300">{meshStatus.links} P2P Links</span>
        <span className="text-slate-500">|</span>
        <span className="text-cyan-400">{meshStatus.avgLatency} Latency</span>
        {activePacketsCount > 0 && (
          <span className="bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 text-[10px] animate-pulse">
            {activePacketsCount} Packets Syncing
          </span>
        )}
      </div>

      {/* Control Buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-1.5">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2.5 py-1.5 text-xs rounded border transition flex items-center space-x-1 font-mono ${
            autoRotate
              ? 'bg-[#161c22] text-slate-200 border-[#232c35] hover:bg-[#1e252d]'
              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
          }`}
          title="Toggle Auto Rotation"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
          <span className="hidden sm:inline">{autoRotate ? 'Rotating' : 'Paused'}</span>
        </button>
        <button
          onClick={triggerTestSyncBroadcast}
          className="px-2.5 py-1.5 text-xs rounded border border-[#ff5533]/50 bg-[#ff5533]/15 text-[#ff5533] hover:bg-[#ff5533]/25 transition flex items-center space-x-1 font-mono font-medium shadow-tactical-glow"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Ping Mesh</span>
        </button>
      </div>

      {/* 3D Canvas Container */}
      <div ref={containerRef} style={{ height }} className="w-full cursor-grab active:cursor-grabbing" />

      {/* Bottom Node Inspector Drawer (if node clicked) */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-[#11161a]/95 backdrop-blur-md border border-[#232c35] rounded-md p-3 text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${selectedNode.color.toString(16).padStart(6, '0')}` }} />
            <div>
              <div className="font-bold text-slate-100 flex items-center space-x-2">
                <span>{selectedNode.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#161c22] border border-[#232c35] text-slate-400">
                  {selectedNode.type}
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">Role: {selectedNode.role} · ID: {selectedNode.id}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                spawn3DPacket('device-a17', selectedNode.id);
                syncManager.syncWithPeer(selectedNode.id);
              }}
              className="px-3 py-1 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700 hover:bg-cyan-800/60 transition flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync Node</span>
            </button>
            <button
              onClick={() => setSelectedNode(null)}
              className="px-2 py-1 text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      {!selectedNode && (
        <div className="absolute bottom-2 left-3 z-10 text-[11px] font-mono text-slate-500">
          Tip: Click any node sphere in 3D space to inspect telemetry or trigger P2P delta sync.
        </div>
      )}
    </div>
  );
};
