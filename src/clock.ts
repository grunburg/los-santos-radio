/**
 * The broadcast clock: device time, in Unix seconds. The debug panel can shift it to test
 * other moments of the schedule.
 */
let offset = 0

export const now = () => Date.now() / 1000 + offset

export const clockOffset = () => offset

export function setClockOffset(seconds: number) {
  offset = seconds
}
