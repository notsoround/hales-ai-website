import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleField = () => {
    const count = 2000;
    const mesh = useRef<THREE.InstancedMesh>(null);

    const { particles, colors } = useMemo(() => {
        const temp = [];
        const colorArray = new Float32Array(count * 3);
        const palette = [
            new THREE.Color('#00e6e6'), // Cyan
            new THREE.Color('#00ccff'), // Light Blue
            new THREE.Color('#ffffff'), // White
            new THREE.Color('#4d4dff'), // Blue
        ];

        for (let i = 0; i < count; i++) {
            const time = Math.random() * 100;
            const factor = Math.random() * 100 + 20;
            const speed = (Math.random() * 0.002) + 0.0005; // Much slower speed
            const x = Math.random() * 100 - 50;
            const y = Math.random() * 100 - 50;
            const z = Math.random() * 100 - 50;

            temp.push({ time, factor, speed, x, y, z });

            // Assign random color from palette
            const color = palette[Math.floor(Math.random() * palette.length)];
            color.toArray(colorArray, i * 3);
        }
        return { particles: temp, colors: colorArray };
    }, [count]);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        if (!mesh.current) return;

        particles.forEach((particle, i) => {
            let { time, factor, speed, x, y, z } = particle;

            // Update time
            particle.time += speed;

            const t = particle.time;

            // Lissajous-like movement for organic flow
            // Reduced movement amplitude
            const s = Math.sin(t);
            const c = Math.cos(t);

            dummy.position.set(
                x + Math.cos((t / 10) * factor) * 0.5 + (Math.sin(t * 1) * factor) / 20,
                y + Math.sin((t / 10) * factor) * 0.5 + (Math.cos(t * 2) * factor) / 20,
                z + Math.cos((t / 10) * factor) * 0.5 + (Math.sin(t * 3) * factor) / 20
            );

            // Mouse interaction
            // Subtle sway based on mouse position
            dummy.position.x += (state.pointer.x * window.innerWidth) / 100; // Reduced sensitivity
            dummy.position.y += (state.pointer.y * window.innerHeight) / 100;

            // Continuous rotation for "sparkle" effect (catching light)
            dummy.rotation.set(s * 2, c * 2, t);

            // Breathing scale for twinkle
            const scale = (Math.sin(t * 3) + 1.5) * 0.8;
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });

        mesh.current.instanceMatrix.needsUpdate = true;

        // Very slow overall rotation
        mesh.current.rotation.y += 0.0002;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <dodecahedronGeometry args={[0.05, 0]}>
                <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
            </dodecahedronGeometry>
            <meshPhongMaterial
                vertexColors
                shininess={100}
                transparent
                opacity={0.8}
            />
        </instancedMesh>
    );
};

export const Hero3D = () => {
    return (
        <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
                {/* Lighting setup for sparkle */}
                <ambientLight intensity={0.2} color="#001524" />
                <pointLight position={[10, 10, 10]} color="#ffffff" intensity={2} distance={50} />
                <pointLight position={[-10, -10, -10]} color="#00e6e6" intensity={1} />
                <directionalLight position={[0, 5, 5]} intensity={1} color="#ffffff" />

                <fog attach="fog" args={['#020410', 10, 50]} />

                <ParticleField />
            </Canvas>
        </div>
    );
};
