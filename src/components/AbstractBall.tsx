import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface AbstractBallProps {
  perlinTime?: number;
  perlinMorph?: number;
  perlinDNoise?: number;
  chromaRGBr?: number;
  chromaRGBg?: number;
  chromaRGBb?: number;
  chromaRGBn?: number;
  chromaRGBm?: number;
  sphereWireframe?: boolean;
  spherePoints?: boolean;
  spherePsize?: number;
  cameraSpeedY?: number;
  cameraSpeedX?: number;
  cameraZoom?: number;
  cameraGuide?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  isResponding?: boolean;
}

const AbstractBall: React.FC<AbstractBallProps> = ({
  perlinTime = 15,
  perlinMorph = 20,
  perlinDNoise = 0.5,
  chromaRGBr = 7.5,
  chromaRGBg = 5.0,
  chromaRGBb = 7.0,
  chromaRGBn = 1.0,
  chromaRGBm = 1.0,
  sphereWireframe = false,
  spherePoints = false,
  spherePsize = 1.0,
  cameraSpeedY = 0.5,
  cameraSpeedX = 0.0,
  cameraZoom = 200,
  cameraGuide = false,
  onInteractionStart,
  onInteractionEnd,
  isResponding = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  
  const paramsRef = useRef({
    perlinTime,
    perlinMorph,
    perlinDNoise,
    chromaRGBr,
    chromaRGBg,
    chromaRGBb,
    chromaRGBn,
    chromaRGBm,
    sphereWireframe,
    spherePoints,
    spherePsize,
    cameraSpeedY,
    cameraSpeedX,
    cameraZoom,
  });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const pointRef = useRef<THREE.Points | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const uniformsRef = useRef<any>({
    time: { value: 0.0 },
    RGBr: { value: chromaRGBr / 10 },
    RGBg: { value: chromaRGBg / 10 },
    RGBb: { value: chromaRGBb / 10 },
    RGBn: { value: chromaRGBn / 100 },
    RGBm: { value: chromaRGBm },
    morph: { value: perlinMorph },
    dnoise: { value: perlinDNoise },
    psize: { value: spherePsize }
  });

  // Effect for responding to chat
  useEffect(() => {
    if (isResponding) {
      // Animate the glob when responding
      gsap.to(uniformsRef.current.morph, { 
        duration: 0.5, 
        value: perlinMorph * 1.5,
        yoyo: true,
        repeat: 3,
        ease: "power2.inOut"
      });
      
      // Change colors
      gsap.to(uniformsRef.current.RGBr, { duration: 0.3, value: Math.random() * 10 + 5 });
      gsap.to(uniformsRef.current.RGBg, { duration: 0.3, value: Math.random() * 10 + 5 });
      gsap.to(uniformsRef.current.RGBb, { duration: 0.3, value: Math.random() * 10 + 5 });
    }
  }, [isResponding, perlinMorph]);

  useEffect(() => {
    const width = mountRef.current!.clientWidth;
    const height = mountRef.current!.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(20, width / height, 1, 1000);
    camera.position.set(0, 10, paramsRef.current.cameraZoom);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.pointerEvents = 'none'; // Changed back to 'none' to disable interaction

    mountRef.current!.appendChild(renderer.domElement);

    // Reduced size from 20 to 5
    const geometry = new THREE.IcosahedronGeometry(5, 20);

    const vertexShader = document.getElementById('noiseVertexShader')?.textContent || '';
    const fragmentShader = document.getElementById('fragmentShader')?.textContent || '';

    const material = new THREE.ShaderMaterial({
      uniforms: uniformsRef.current,
      side: THREE.DoubleSide,
      vertexShader,
      fragmentShader,
      wireframe: paramsRef.current.sphereWireframe,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    const point = new THREE.Points(geometry, material);

    // Disable shadows
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.geometry.morphTargetsRelative = true;

    scene.add(mesh);
    scene.add(point);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    materialRef.current = material;
    meshRef.current = mesh;
    pointRef.current = point;

    const animate = () => {
      const p = paramsRef.current;

      uniformsRef.current.time.value += p.perlinTime / 10000;
      uniformsRef.current.morph.value = p.perlinMorph;
      uniformsRef.current.dnoise.value = p.perlinDNoise;
      uniformsRef.current.RGBr.value = p.chromaRGBr / 10;
      uniformsRef.current.RGBg.value = p.chromaRGBg / 10;
      uniformsRef.current.RGBb.value = p.chromaRGBb / 10;
      uniformsRef.current.RGBn.value = p.chromaRGBn / 100;
      uniformsRef.current.RGBm.value = p.chromaRGBm;
      uniformsRef.current.psize.value = p.spherePsize;

      if (meshRef.current && pointRef.current) {
        meshRef.current.rotation.y += p.cameraSpeedY / 100;
        meshRef.current.rotation.z += p.cameraSpeedX / 100;
        pointRef.current.rotation.y = meshRef.current.rotation.y;
        pointRef.current.rotation.z = meshRef.current.rotation.z;

        materialRef.current!.wireframe = p.sphereWireframe;
        meshRef.current.visible = !p.spherePoints;
        pointRef.current.visible = p.spherePoints;
      }

      cameraRef.current!.lookAt(scene.position);
      rendererRef.current!.render(scene, cameraRef.current!);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const w = mountRef.current!.clientWidth;
      const h = mountRef.current!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
    };
  }, [onInteractionStart, onInteractionEnd, perlinMorph]);

  useEffect(() => {
    paramsRef.current = {
      perlinTime,
      perlinMorph,
      perlinDNoise,
      chromaRGBr,
      chromaRGBg,
      chromaRGBb,
      chromaRGBn,
      chromaRGBm,
      sphereWireframe,
      spherePoints,
      spherePsize,
      cameraSpeedY,
      cameraSpeedX,
      cameraZoom
    };

    if (cameraRef.current) {
      gsap.to(cameraRef.current.position, {
        duration: 2,
        z: 300 - cameraZoom
      });
    }
  }, [
    perlinTime,
    perlinMorph,
    perlinDNoise,
    chromaRGBr,
    chromaRGBg,
    chromaRGBb,
    chromaRGBn,
    chromaRGBm,
    sphereWireframe,
    spherePoints,
    spherePsize,
    cameraSpeedY,
    cameraSpeedX,
    cameraZoom
  ]);

  return (
    <div 
      ref={mountRef} 
      style={{ width: '100%', height: '400px' }} 
      className='rounded-2xl mt-2'
    />
  );
};

export default AbstractBall;