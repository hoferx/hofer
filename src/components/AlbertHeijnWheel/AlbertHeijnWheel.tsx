"use client";

import type { ActiveWheelLayout, WheelSceneKey } from "@/app/wheel/wheel-layout";

type Props = {
  layout: ActiveWheelLayout;
  rotation: number;
  spinning: boolean;
  disabled: boolean;
  onSpin: () => void;
  onSpinEnd: () => void;
};

const WHEEL_ASSETS: Record<
  WheelSceneKey,
  {
    backgroundSrc: string;
    shadowSrc: string;
    wheelSrc: string;
    labelsSrc: string;
    frameSrc: string;
    centerHubSrc: string;
    pointerSrc: string;
    buttonSrc: string;

    wheelLeft: string;
    wheelTop: string;
    wheelWidth: string;
    wheelHeight: string;
    wheelTransformOrigin: string;

    buttonLeft: string;
    buttonTop: string;
    buttonWidth: string;
    buttonHeight: string;
  }
> = {
  desktop: {
    backgroundSrc: "/wheel-assets/hofer/background-desktop.png",
    shadowSrc: "/wheel-assets/hofer/wheel-shadow.png",
    wheelSrc: "/wheel-assets/hofer/wheel-face.png",
    labelsSrc: "/wheel-assets/hofer/prize-labels.png",
    frameSrc: "/wheel-assets/hofer/wheel-frame.png",
    centerHubSrc: "/wheel-assets/hofer/center-hub.png",
    pointerSrc: "/wheel-assets/hofer/pointer.png",
    buttonSrc: "/wheel-assets/hofer/spin-button.png",

    wheelLeft: "27.1531%",
    wheelTop: "5.9511%",
    wheelWidth: "45.4545%",
    wheelHeight: "80.7651%",
    wheelTransformOrigin: "50% 50%",

    buttonLeft: "33.1938%",
    buttonTop: "83.9532%",
    buttonWidth: "33.6722%",
    buttonHeight: "14.5589%",
  },
  mobile: {
    backgroundSrc: "/wheel-assets/hofer/background-mobile.png",
    shadowSrc: "/wheel-assets/hofer/wheel-shadow.png",
    wheelSrc: "/wheel-assets/hofer/wheel-face.png",
    labelsSrc: "/wheel-assets/hofer/prize-labels.png",
    frameSrc: "/wheel-assets/hofer/wheel-frame.png",
    centerHubSrc: "/wheel-assets/hofer/center-hub.png",
    pointerSrc: "/wheel-assets/hofer/pointer.png",
    buttonSrc: "/wheel-assets/hofer/spin-button.png",

    wheelLeft: "7.86397%",
    wheelTop: "20.39474%",
    wheelWidth: "84.16578%",
    wheelHeight: "47.36842%",
    wheelTransformOrigin: "50% 50%",

    buttonLeft: "20.82997%",
    buttonTop: "78.70813%",
    buttonWidth: "58.34219%",
    buttonHeight: "8.25359%",
  },
};

export function AlbertHeijnWheel({ layout, rotation, spinning, disabled, onSpin, onSpinEnd }: Props) {
  const scene = layout.scene;
  const assets = WHEEL_ASSETS[layout.sceneKey];

  const wheelBox = {
    left: assets.wheelLeft,
    top: assets.wheelTop,
    width: assets.wheelWidth,
    height: assets.wheelHeight,
  };

  return (
    <div className="absolute inset-0">
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <div
          className="relative overflow-hidden"
          style={{
            width: layout.stageStyle.width,
            height: layout.stageStyle.height,
            aspectRatio: scene.aspectRatio,
          }}
        >
          {/* 1. BACKGROUND */}
          <img
            src={assets.backgroundSrc}
            alt={layout.sceneKey === "desktop" ? "Hintergrund des Gewinnrads (Desktop)" : "Hintergrund des Gewinnrads (Mobil)"}
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none object-fill"
            draggable={false}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />

          {/* 2. WHEEL SHADOW */}
          <img
            src={assets.shadowSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute z-[2] select-none object-fill"
            loading="eager"
            decoding="async"
            style={wheelBox}
          />

          {/* 3. ROTATING WHEEL (face + labels) */}
          <div
            className="pointer-events-none absolute z-[3] will-change-transform"
            style={{
              ...wheelBox,
              transformOrigin: assets.wheelTransformOrigin,
              transform: `translateZ(0) rotate(${rotation}deg)`,
              transition: spinning ? "transform 5000ms cubic-bezier(.12,.8,.18,1)" : "none",
            }}
            onTransitionEnd={onSpinEnd}
          >
            <img
              src={assets.wheelSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-fill"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <img
              src={assets.labelsSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-fill"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>

          {/* 4. STATIC FRAME */}
          <img
            src={assets.frameSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute z-[4] select-none object-fill"
            loading="eager"
            decoding="async"
            style={wheelBox}
          />

          {/* 5. STATIC CENTER HUB */}
          <img
            src={assets.centerHubSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute z-[5] select-none object-fill"
            loading="eager"
            decoding="async"
            style={wheelBox}
          />

          {/* 6. STATIC POINTER */}
          <img
            src={assets.pointerSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute z-[6] select-none object-fill"
            loading="eager"
            decoding="async"
            style={wheelBox}
          />

          {/* 7. BUTTON HIGHLIGHT GLOW */}
          <div
            className={`pointer-events-none absolute z-[7] transition-all duration-300 ${spinning ? "bg-white/10 shadow-[0_0_36px_rgba(255,255,255,0.28)]" : "bg-transparent"}`}
            style={{
              left: assets.buttonLeft,
              top: assets.buttonTop,
              width: assets.buttonWidth,
              height: assets.buttonHeight,
              borderRadius: "100px",
            }}
          />

          {/* 8. STATIC BUTTON ART */}
          <img
            src={assets.buttonSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`pointer-events-none absolute z-[8] select-none transition-transform duration-200 object-fill ${disabled ? "opacity-90" : "opacity-100"}`}
            loading="eager"
            decoding="async"
            style={{
              left: assets.buttonLeft,
              top: assets.buttonTop,
              width: assets.buttonWidth,
              height: assets.buttonHeight,
            }}
          />

          {/* CLICKABLE HIT AREA */}
          <button
            type="button"
            onClick={onSpin}
            disabled={disabled}
            aria-label="Gewinnrad drehen"
            className="absolute z-[9] bg-transparent focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:cursor-not-allowed"
            style={{
              left: assets.buttonLeft,
              top: assets.buttonTop,
              width: assets.buttonWidth,
              height: assets.buttonHeight,
              touchAction: "manipulation",
              borderRadius: "100px",
            }}
          >
            <span className="sr-only">{spinning ? "Dreht sich" : "Jetzt drehen"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
