import React from 'react';
import './styles.css';
import BackButton from '../../components/BackButton';

const AboutUs = () => {
  return (
    <div className="about-us-container">
      <BackButton />
      
      <h1 className="text-4xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient">
        About Us
      </h1>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-br from-[#0a1a2b]/50 to-[#0a0f16]/50 border border-[#00e6e6]/10 rounded-2xl p-8 backdrop-blur-sm">
          <p className="text-lg mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
            Hales AI is at the forefront of AI innovation, specializing in advanced AI telephony, workflow automation, and digital cloning technology. Our mission is to transform businesses through cutting-edge artificial intelligence solutions.
          </p>
          <p className="text-lg mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
            Founded with a vision to make AI technology accessible and practical for businesses of all sizes, we combine state-of-the-art technology with intuitive design to create solutions that drive real business value.
          </p>
          <p className="text-lg bg-clip-text text-transparent bg-gradient-to-r from-[#00e6e6] via-[#00ccff] via-[#4d4dff] to-[#1a1aff] animate-gradient-slow">
            Our team of experts brings together years of experience in AI development, voice technology, and business automation to deliver innovative solutions that help our clients stay ahead in today's rapidly evolving digital landscape.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;