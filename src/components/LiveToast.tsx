"use client";

import { useState, useEffect } from "react";

const WINNERS = [
  { name: "Thomas from Auckland", image: "/avatars/winner-01.jpg" },
  { name: "Sarah from Wellington", image: "/avatars/winner-02.jpg" },
  { name: "Michael from Christchurch", image: "/avatars/winner-03.jpg" },
  { name: "Anna from Hamilton", image: "/avatars/winner-04.jpg" },
  { name: "David from Tauranga", image: "/avatars/winner-05.jpg" },
  { name: "Julia from Dunedin", image: "/avatars/winner-06.jpg" },
  { name: "Lukas from Napier", image: "/avatars/winner-07.jpg" },
  { name: "Laura from Rotorua", image: "/avatars/winner-08.jpg" },
  { name: "Stefan from New Plymouth", image: "/avatars/winner-09.jpg" },
  { name: "Lisa from Whangarei", image: "/avatars/winner-10.jpg" },
  { name: "Markus from Palmerston North", image: "/avatars/winner-11.jpg" },
  { name: "Elena from Nelson", image: "/avatars/winner-12.jpg" },
  { name: "Florian from Invercargill", image: "/avatars/winner-13.jpg" },
  { name: "Marie from Queenstown", image: "/avatars/winner-14.jpg" },
  { name: "Alexander from Gisborne", image: "/avatars/winner-15.jpg" },
  { name: "Sophie from Hastings", image: "/avatars/winner-16.jpg" },
  { name: "Christian from Taupo", image: "/avatars/winner-17.jpg" },
  { name: "Katarina from Blenheim", image: "/avatars/winner-18.jpg" },
  { name: "Martin from Timaru", image: "/avatars/winner-19.jpg" },
  { name: "Nina from Whanganui", image: "/avatars/winner-20.jpg" },
  { name: "Andreas from Porirua", image: "/avatars/winner-21.jpg" },
  { name: "Isabella from Lower Hutt", image: "/avatars/winner-22.jpg" },
  { name: "Philipp from Upper Hutt", image: "/avatars/winner-23.jpg" },
  { name: "Victoria from Cambridge", image: "/avatars/winner-24.jpg" },
  { name: "Daniel from Kerikeri", image: "/avatars/winner-25.jpg" },
  { name: "Mia from Wanaka", image: "/avatars/winner-26.jpg" },
  { name: "Simon from Pukekohe", image: "/avatars/winner-27.jpg" },
  { name: "Emma from Ashburton", image: "/avatars/winner-28.jpg" },
  { name: "Johannes from Greymouth", image: "/avatars/winner-29.jpg" },
  { name: "Hannah from Paraparaumu", image: "/avatars/winner-30.jpg" }
];

const TIMES = [
  "Just now",
  "1 min ago",
  "2 min ago",
  "3 min ago",
  "4 min ago",
  "5 min ago"
];

export default function LiveToast() {
  const [currentWinner, setCurrentWinner] = useState<{ name: string; time: string; amount: string; image: string } | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const generateRandomAmount = () => {
      // 500 ile 6000 arası, 100'ün katları şeklinde rastgele bir miktar
      const min = 5;
      const max = 60;
      const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
      return "NZ$" + (randomValue * 100).toLocaleString("en-NZ");
    };

    const showRandomWinner = () => {
      const randomWinner = WINNERS[Math.floor(Math.random() * WINNERS.length)];
      const randomTime = TIMES[Math.floor(Math.random() * TIMES.length)];
      const randomAmount = generateRandomAmount();

      setCurrentWinner({ name: randomWinner.name, time: randomTime, amount: randomAmount, image: randomWinner.image });

      
      // Bildirim ekranda 1.5 saniye kalır
      setTimeout(() => setCurrentWinner(null), 1500);
      
      // Bir sonraki bildirim tam 4 saniyede bir gelir
      timeoutId = setTimeout(showRandomWinner, 4000);
    };

    // İlk bildirimi 1 saniye sonra göster
    timeoutId = setTimeout(showRandomWinner, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="!fixed top-[85px] sm:top-[90px] left-0 w-full pointer-events-none z-[10002] flex justify-center sm:justify-start px-4 sm:px-6">
      <div 
        className={`pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-[340px] w-full ${
          currentWinner ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"
        }`}
      >
        <div className="glass-card rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-2xl border-l-4 border-l-[#003b8f] bg-white/95 backdrop-blur-xl">
          <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden shadow-inner border border-gray-100">
            {currentWinner?.image ? (
              <img src={currentWinner.image} alt={currentWinner.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#d8e8fb] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#003b8f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 drop-shadow-sm">{currentWinner?.name}</p>
            <p className="text-xs text-gray-700 font-medium mt-0.5">
              Just received <span className="font-bold text-[#003b8f]">{currentWinner?.amount}</span> • {currentWinner?.time}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
