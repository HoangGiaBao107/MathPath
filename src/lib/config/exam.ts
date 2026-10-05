export const EXAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const REAL_EXAM_TIME_LIMIT_SECONDS = 90 * 60;
export const THPTQG_2027_TIMESTAMP = Date.parse("2027-06-11T00:00:00+07:00");

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
};

export function getCountdownParts(now: number, target = THPTQG_2027_TIMESTAMP): CountdownParts {
  const remainingSeconds = Math.max(0, Math.floor((target - now) / 1_000));
  return {
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
    complete: remainingSeconds === 0,
  };
}
