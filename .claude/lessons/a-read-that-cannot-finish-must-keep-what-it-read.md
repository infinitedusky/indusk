# A read that cannot finish must keep what it read — slice it newest first and let coverage grow

The admin read a source's whole window in one request per refresh. A window too slow to answer within the timeout failed every refresh, so a busy server's timeline was never drawn, however many times the page refreshed.

Why it matters: all-or-nothing reads turn "slow" into "never", and the person sees a failure where most of the answer was available.

What to do: read newest first in bounded slices, keep each slice as it lands, grow the covered range by it, and stop starting slices once the refresh's budget is spent; the next refresh continues from there. Say how far back the read reaches while it is incomplete, and count the unread range as "at least". Guarded by `http-promise-timeline-falsify.test.ts` (promise-timeline A19).
