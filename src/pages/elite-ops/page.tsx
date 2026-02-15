import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../../components/BackButton';
import { X, Shield, Zap, Target, Cpu } from 'lucide-react';

// Avatars
const avatars = [
  '/elite_ops_avatar_1_1765060494527.png', // Blue (Male)
  '/elite_ops_avatar_male_1_1765060781587.png', // Purple (Male)
  '/elite_ops_avatar_3_1765060521085.png', // Orange (Male)
];

const contacts = [
  {
    name: 'Matt Hales',
    title: 'Founder & Wonder Twin Número Uno',
    emoji: '🦸‍♂️ 🇰🇪 🇺🇸',
    phone: '+1-786-708-2214',
    bio: "The origin point. Compiles reality from pure thought. 50% code, 50% caffeine, 100% unstoppable.",
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Sahil Suman',
    title: 'Super Genius from India',
    emoji: '🇮🇳💡',
    phone: '+91-8936850777',
    bio: "His brain operates on quantum frequencies. Can debug code before it's even written. A living compiler.",
    color: 'from-purple-500 to-pink-500'
  },
  {
    name: 'Aaron Alan',
    title: 'Chief Ai Officer at PB',
    emoji: '🇺🇸🔥',
    phone: '+1-801-698-8307',
    bio: "Translates silicon dreams into human reality. The bridge between the matrix and the meeting room.",
    color: 'from-orange-500 to-amber-500'
  },
  {
    name: 'Gatot Sugiharto',
    title: 'Chairman Maximus, Mining of Millions',
    emoji: '⛏️💰 🇮🇩',
    phone: '+62-813-1813-5059',
    bio: "Commands the digital mines with an iron pickaxe. If it's valuable, he's already found it and tokenized it.",
    color: 'from-emerald-500 to-green-500'
  },
  {
    name: 'Jean-Thierry Songomali',
    title: 'Stealthy AI Enthusiast',
    emoji: '🥷🤖 🇫🇷',
    phone: '+33-753-520-326',
    bio: "Warrior by Day, Ninja AI Commando by Night. You won't see him, but your server efficiency will double overnight.",
    color: 'from-blue-600 to-indigo-600'
  },
  {
    name: 'Joe Elder',
    title: 'Behavioral Adjustments Expert',
    emoji: '🧠⚡ 🇺🇸',
    phone: '+1-801-615-1236',
    bio: "Can debug human behavior with a single look. Realigns neural pathways and CSS classes with equal precision.",
    color: 'from-purple-600 to-violet-600'
  },
  {
    name: 'Nate Hales',
    title: 'Wonder Twin Número Dos',
    emoji: '🦸‍♂️⚡ 🇺🇸',
    phone: '+1-801-879-5542',
    bio: "The other processor core. Synchronized for max throughput. Runs on high voltage and good vibes.",
    color: 'from-amber-500 to-yellow-500'
  },
  {
    name: 'Patrick Nelson',
    title: 'Key Strategist',
    emoji: '🎩🕵️‍♂️ 🇺🇸 🚩',
    phone: '+1-801-368-0802',
    bio: "Strategist of Covert Ops. Operates in the shadows of the backend. His plans are complex, his code is clean.",
    color: 'from-emerald-600 to-teal-600'
  },
  {
    name: 'Richard Nelson',
    title: 'Head of Global Health',
    emoji: '🌍🩺 🇺🇸 🚩',
    phone: '+1-435-901-9890',
    bio: "Healing the world's codebase one patch at a time. The medic on the digital battlefield.",
    color: 'from-cyan-500 to-sky-500'
  },
  {
    name: 'Shubham',
    title: "Sahil's Right-Hand Man",
    emoji: '🤝 🇮🇳',
    phone: '+91-8950095195',
    bio: "The execution engine. If Sahil thinks it, Shubham builds it. Zero latency, maximum output.",
    color: 'from-pink-500 to-rose-500'
  },
  {
    name: 'Victor Angel',
    title: 'Mining Cartel Connector',
    emoji: '🔥🔍 🇵🇪',
    phone: '+51-954-404-866',
    bio: "Negotiates with protocols and people alike. The node that connects all networks in Peru's power grid.",
    color: 'from-orange-600 to-red-600'
  },
  {
    name: 'Chris Gamble',
    title: 'ChrisThropic of PB',
    emoji: '🇺🇸🔥',
    phone: '+1-530-748-8372',
    bio: "Betting it all on AI. The high roller of the digital frontier. Always wins the coin toss.",
    color: 'from-green-500 to-lime-500'
  }
];

const EliteOpsPage = () => {
  const [selectedAgent, setSelectedAgent] = useState<typeof contacts[0] | null>(null);

  return (
    <div className="min-h-screen bg-[#020410] text-white relative overflow-hidden font-sans selection:bg-cyan-500/30">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#020410] to-[#020410]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay" />

      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

      <BackButton />

      <div className="relative z-10 container mx-auto px-4 py-24">
        {/* Header */}
        <div className="text-center mb-24 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="inline-block relative"
          >
            <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
            <h1 className="text-6xl md:text-7xl font-bold font-display tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-cyan-400 to-blue-600 relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
              ELITE OPS
            </h1>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-4" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-cyan-400/60 mt-4 text-lg tracking-[0.5em] font-light uppercase"
          >
            Classified Intelligence Unit
          </motion.p>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {contacts.map((contact, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              onClick={() => setSelectedAgent(contact)}
              className="group relative cursor-pointer"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-100 transition duration-500" />
              <div className="relative h-full bg-[#0a0f1c] border border-white/10 rounded-2xl p-4 overflow-hidden backdrop-blur-sm group-hover:border-cyan-500/50 transition duration-300">

                {/* Image Container */}
                <div className="relative aspect-square rounded-xl overflow-hidden mb-4 border border-white/5 group-hover:border-cyan-500/30 transition duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-br ${contact.color} opacity-0 group-hover:opacity-20 transition duration-500 mix-blend-overlay`} />
                  <img
                    src={avatars[index % avatars.length]}
                    alt={contact.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter saturate-50 group-hover:saturate-100"
                  />

                  {/* Overlay Details */}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition duration-300">
                    <p className="text-cyan-400 text-xs font-mono tracking-wider">CLICK TO DECLASSIFY</p>
                  </div>
                </div>

                {/* Card Content */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition duration-300 truncate">
                      {contact.name}
                    </h3>
                    <span className="text-sm filter grayscale group-hover:grayscale-0 transition duration-300">
                      {contact.emoji.split(' ')[0]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-mono truncate">
                    {contact.title}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-center mt-24"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 font-mono text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            ELITE, LOCKED & LOADED. 🚀🔥
          </div>
        </motion.div>
      </div>

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAgent(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full bg-[#0a0f1c] border border-cyan-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

              <button
                onClick={() => setSelectedAgent(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="grid md:grid-cols-2">
                <div className="relative h-64 md:h-full">
                  <img
                    src={avatars[contacts.indexOf(selectedAgent) % avatars.length]}
                    alt={selectedAgent.name}
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-transparent to-transparent mix-blend-multiply`} />
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <span className="text-cyan-400 font-mono text-sm tracking-wider">AUTHENTICATED</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">{selectedAgent.name}</h2>
                    <p className={`bg-gradient-to-r ${selectedAgent.color} bg-clip-text text-transparent font-bold`}>
                      {selectedAgent.title}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-2 mb-2 text-gray-400 text-sm font-mono">
                        <Cpu className="w-4 h-4" />
                        BIO_DATA
                      </div>
                      <p className="text-gray-300 leading-relaxed italic">
                        "{selectedAgent.bio}"
                      </p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-2 mb-2 text-gray-400 text-sm font-mono">
                        <Target className="w-4 h-4" />
                        CONTACT_UPLINK
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedAgent.emoji.split(' ').slice(1).join(' ')}</span>
                        <p className="text-cyan-300 font-mono">{selectedAgent.phone}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EliteOpsPage;
