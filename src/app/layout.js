import { Orbitron, Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Header from "@/components/Header";
import Murmuration from "@/components/Murmuration";
import GlobalLoader from "@/components/GlobalLoader";

const orbitron = Orbitron({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: "--font-mono",
});

const nevera = localFont({
  src: "./fonts/Nevera-Regular.otf",
  variable: "--font-nevera"
});

export const metadata = {
  title: "VGR | Digital Craftsman",
  description: "Portfolio of VGR, a visionary digital craftsman and creative developer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${spaceMono.variable} ${nevera.variable}`}>
      <body>
        <div id="portrait-blocker">
          <div className="icon">📱</div>
          <h2>Rotate Device</h2>
          <p>This immersive experience requires a landscape orientation. Please rotate your phone.</p>
        </div>
        <div id="main-content-wrapper">
          <SmoothScroll>
            <GlobalLoader>
              <Murmuration />
              <Header />
              {children}
            </GlobalLoader>
          </SmoothScroll>
        </div>
      </body>
    </html>
  );
}

