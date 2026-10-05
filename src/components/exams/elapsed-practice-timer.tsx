"use client";

import { useEffect, useState } from "react";

export function ElapsedPracticeTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const timer = window.setInterval(update, 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const time = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");

  return (
    <div className="practice-elapsed-timer">
      <span>Thời gian ôn tập</span>
      <output aria-live="off" aria-label={`Đã học ${time}`}>
        {time}
      </output>
    </div>
  );
}
