# The Sonic Reader 🎧

**The Sonic Reader** is a mobile-first "auditory sanctuary" designed for focused PDF consumption. It transforms static documents into interactive, narrated experiences with synchronized text-to-speech and visual tracking.

## ✨ Features

* **PDF Text Extraction**: Uses `pdf.js` to process documents entirely on the client side (no server uploads required).
* **Auditory Sanctuary**: High-fidelity reader view with auto-scrolling and word-level highlighting.
* **Smart Controls**:
    * **Click-to-Play**: Tap any word to start reading from that exact position.
    * **Dynamic Seeking**: Rewind and Fast-Forward (10s jumps or continuous seek on hold).
* **Multilingual Support**: Filter system voices between English and other languages with a dedicated toggle.
* **Individual Persistence**: Automatically saves reading progress and settings (voice, speed) per document using `localStorage`.
* **Offline-Ready**: Bundled PDF workers ensure the app works without external CDN dependencies.

## 🛠️ Tech Stack

* **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Animations**: [Framer Motion](https://www.framer.com/motion/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **PDF Engine**: [pdf.js](https://mozilla.github.io/pdf.js/)
* **Audio**: Web Speech API

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/sonic-reader.git](https://github.com/your-username/sonic-reader.git)
   cd sonic-reader
