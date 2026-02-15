import { useEffect, useState } from 'react';

export const SparkleEffect = () => {
    const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

    useEffect(() => {
        const generateSparkles = () => {
            const newSparkles = Array.from({ length: 20 }).map((_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: Math.random() * 4 + 2,
                delay: Math.random() * 2,
            }));
            setSparkles(newSparkles);
        };

        generateSparkles();
        const interval = setInterval(generateSparkles, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {sparkles.map((sparkle) => (
                <div
                    key={sparkle.id}
                    className="absolute rounded-full bg-white animate-pulse"
                    style={{
                        left: `${sparkle.x}%`,
                        top: `${sparkle.y}%`,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        opacity: 0.6,
                        animationDuration: '2s',
                        animationDelay: `${sparkle.delay}s`,
                        boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.size}px rgba(255, 255, 255, 0.8)`,
                    }}
                />
            ))}
        </div>
    );
};
