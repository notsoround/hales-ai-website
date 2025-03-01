import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function GridBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000d1a, 1);
    containerRef.current.appendChild(renderer.domElement);

    // Create grid
    const size = 20;
    const divisions = 20;
    const gridHelper = new THREE.GridHelper(size, divisions, 0x0066cc, 0x004080);
    scene.add(gridHelper);

    // Add points at grid intersections
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x38b6ff });
    
    for (let i = -size/2; i <= size/2; i++) {
      for (let j = -size/2; j <= size/2; j++) {
        const point = new THREE.Mesh(geometry, material);
        point.position.set(i, 0, j);
        scene.add(point);
      }
    }

    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);

    // Animation
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Animate grid points
      scene.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.position.y = Math.sin(time + child.position.x + child.position.z) * 0.5;
        }
      });

      // Rotate grid slowly
      scene.rotation.y += 0.001;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="fixed top-0 left-0 w-full h-full -z-10" />;
}