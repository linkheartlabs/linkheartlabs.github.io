import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="theme-cinematic relative min-h-screen w-full overflow-hidden text-foreground font-body">
      {/* Cinematic Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Navigation Bar */}
      <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between px-8 py-6">
        <div 
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          LinkHeart<sup className="text-xs">®</sup>
        </div>
        
        <div className="hidden items-center gap-8 md:flex">
          <button className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80">
            Trang chủ
          </button>
          <button className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Companion
          </button>
          <button className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Về chúng tôi
          </button>
          <button className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Nhật ký
          </button>
          <button className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Liên hệ
          </button>
        </div>

        <button 
          onClick={onGetStarted}
          className="liquid-glass rounded-full px-6 py-2.5 text-sm font-medium text-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Bắt đầu hành trình
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-32 pb-40 text-center">
        <div className="max-w-7xl animate-fade-rise">
          <h1 
            className="text-5xl font-normal leading-[0.95] tracking-[-2.46px] sm:text-7xl md:text-8xl"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Nơi kết nối <em className="not-italic text-muted-foreground">trái tim</em> <br />
            qua từng <em className="not-italic text-muted-foreground">khoảnh khắc lặng yên.</em>
          </h1>
        </div>

        <div className="mt-8 max-w-2xl animate-fade-rise-delay">
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Chúng tôi kiến tạo sự quan tâm cho những người thân yêu, những tâm hồn cần sự đồng điệu và những kết nối bền chặt. 
            Trong thế giới vội vã, ta xây dựng không gian cho sự thấu hiểu và yêu thương lan tỏa.
          </p>
        </div>

        <div className="mt-12 animate-fade-rise-delay-2">
          <button 
            onClick={onGetStarted}
            className="liquid-glass group flex items-center gap-3 rounded-full px-14 py-5 text-base font-medium text-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Bắt đầu hành trình
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </main>

      {/* Subtle Overlay to ensure legibility if video is too bright (though specifications said no overlays, the video itself seems cinematic) */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" />
    </div>
  );
};

export default LandingPage;
