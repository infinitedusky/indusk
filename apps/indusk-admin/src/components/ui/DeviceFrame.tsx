import type { HTMLAttributes, ReactNode } from "react";

export interface DeviceFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** What the frame holds: a look at a device, `dashboard.default at phone · 390 × 844`. */
  children: ReactNode;
}

/**
 * The frame a look opens in at a reference device: the ground, a line round
 * it, and what it holds centred. The Looks page puts the look's own document
 * in it at the device's size.
 */
export function DeviceFrame({
  children,
  className = "",
  ...rest
}: DeviceFrameProps) {
  return (
    <div
      data-component="device-frame"
      className={`grid h-input place-items-center rounded-lg border border-line bg-ground text-sm leading-3 text-ink-faint ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
