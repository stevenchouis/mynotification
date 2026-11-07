// components/LottieQuickIcon.tsx
// 首頁功能 Grid 的 Lottie 動畫圖示（目前只有「會員條碼」用，動畫檔 assets/lottie/member-code-scan.json
// 是手寫的簡單向量動畫：條碼 + 一條掃描光線，一個循環＝由上往下再掃回最上面）。
// 兩種播放方式：
// - continuous：不停循環（會員條碼用，光線到頂/到底就自動反向，像掃描器一樣一直來回掃）
// - 預設：比照 AnimatedQuickIcon，每隔 CYCLE_MS 播一次
// 系統開啟「減少動態效果」時不播放，停在第 0 格。
// 顏色用 colorFilters 依圖層名稱（keypath）在執行期覆寫，動畫檔裡寫死的顏色只是預設值。
// lottie-react-native 是原生模組：新增/升級這個套件後必須重新 eas build Dev Client。
import LottieView, { AnimationObject } from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

const CYCLE_MS = 4000;

interface Props {
  source: AnimationObject;
  size: number;
  colorFilters?: { keypath: string; color: string }[];
  // true：不停循環播放；false：每 CYCLE_MS 播一次
  continuous?: boolean;
  delayMs?: number;
  active?: boolean;
}

export default function LottieQuickIcon({
  source, size, colorFilters, continuous = false, delayMs = 0, active = true,
}: Props) {
  const ref = useRef<LottieView>(null);
  const reduceMotion = useReducedMotion();
  const shouldPlay = active && !reduceMotion;

  useEffect(() => {
    ref.current?.reset();
    if (!shouldPlay) return;

    if (continuous) {
      // loop={continuous}，play() 一次之後就會自己一直循環
      const timeout = setTimeout(() => ref.current?.play(), delayMs);
      return () => clearTimeout(timeout);
    }

    const play = () => {
      ref.current?.reset();
      ref.current?.play();
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      play();
      interval = setInterval(play, CYCLE_MS);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [shouldPlay, continuous, delayMs]);

  return (
    <LottieView
      ref={ref}
      source={source}
      loop={continuous}
      autoPlay={false}
      colorFilters={colorFilters}
      style={{ width: size, height: size }}
    />
  );
}
