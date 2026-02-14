import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './styles.css';
import PasswordProtection from '../../components/PasswordProtection';
import BackButton from '../../components/BackButton';

const EliteOpsPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles: { x: number; y: number; radius: number; color: string; velocity: { x: number; y: number } }[] = [];
    const particleCount = 100;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, 255, 0.5)`,
        velocity: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2
        }
      });
    }

    const animate = () => {
      requestAnimationFrame(animate);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;

        if (particle.x < 0 || particle.x > canvas.width) particle.velocity.x *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.velocity.y *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);

  const contacts = [
    {
      name: 'Matt Hales',
      title: 'Founder & Wonder Twin Número Uno',
      emoji: '🦸‍♂️ 🇰🇪 🇺🇸',
      phone: '+1-786-708-2214'
    },
    {
      name: 'Sahil Suman',
      title: 'Super Genius from India',
      emoji: '🇮🇳💡',
      phone: '+91-8936850777'
    },
    {
      name: 'Aaron Alan',
      title: 'Chief Ai Officer at PB',
      emoji: '🇺🇸🔥',
      phone: '+1-801-698-8307'
    },
    {
      name: 'Gatot Sugiharto',
      title: 'Chairman Maximus, Mining of Millions',
      emoji: '⛏️💰 🇮🇩',
      phone: '+62-813-1813-5059'
    },
    {
      name: 'Jean-Thierry Songomali',
      title: 'Stealthy AI Enthusiast: Warrior by Day, Ninja AI Commando by Night',
      emoji: '🥷🤖 🇫🇷',
      phone: '+33-753-520-326'
    },
    {
      name: 'Joe Elder',
      title: 'World-Class Expert in Behavioral Adjustments... by Any Means Necessary',
      emoji: '🧠⚡ 🇺🇸',
      phone: '+1-801-615-1236'
    },
    {
      name: 'Nate Hales',
      title: 'Wonder Twin Número Dos',
      emoji: '🦸‍♂️⚡ 🇺🇸',
      phone: '+1-801-879-5542'
    },
    {
      name: 'Patrick Nelson',
      title: 'A.K.A. "Father Patrick" (No Religious Affiliation), Key Strategist of Covert Ops for the Head of Big Lima',
      emoji: '🎩🕵️‍♂️ 🇺🇸 🚩',
      phone: '+1-801-368-0802'
    },
    {
      name: 'Richard Nelson',
      title: 'Head of the Global Health Initiative & Other Secretive Global Ventures',
      emoji: '🌍🩺 🇺🇸 🚩',
      phone: '+1-435-901-9890'
    },
    {
      name: 'Shubham',
      title: 'Sahil\'s Right-Hand Man',
      emoji: '🤝 🇮🇳',
      phone: '+91-8950095195'
    },
    {
      name: 'Victor Angel Yupanqui Chiarelle',
      title: 'Mining Cartel Connector & Special Agent with Ties to Peru\'s Power Players',
      emoji: '🔥🔍 🇵🇪',
      phone: '+51-954-404-866'
    },
    {
      name: 'Chris Gamble',
      title: 'ChrisThropic of PB',
      emoji: '🇺🇸🔥',
      phone: '+1-530-748-8372'
    }
  ];

  if (!isAuthenticated) {
    return (
      <PasswordProtection
        onSuccess={() => setIsAuthenticated(true)}
        correctPassword="halesai"
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ background: 'linear-gradient(to bottom, #000000, #1a1a2e)' }}
      />
      
      <BackButton />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        <motion.h1 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-5xl font-bold text-center mb-12"
          style={{
            background: 'linear-gradient(to right, #00f2fe, #4facfe, #00f2fe)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 20px rgba(79, 172, 254, 0.5)'
          }}
        >
          Hales.AI Elite Operations Unit
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {contacts.map((contact, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
              className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-6 rounded-lg shadow-lg backdrop-blur-sm card-glow"
              style={{ border: '1px solid rgba(79, 172, 254, 0.3)' }}
            >
              <h2 className="text-xl font-bold mb-2" style={{
                background: 'linear-gradient(to right, #4facfe, #00f2fe)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                {contact.name}
              </h2>
              <p className="text-gray-300 mb-2">{contact.title}</p>
              <p className="text-2xl mb-2">{contact.emoji}</p>
              <p className="text-blue-400">{contact.phone}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="text-center mt-12 text-2xl font-bold"
          style={{
            background: 'linear-gradient(to right, #4facfe, #00f2fe)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Elite, Locked & Loaded. 🚀🔥
        </motion.div>
      </div>
    </div>
  );
};

export default EliteOpsPage;