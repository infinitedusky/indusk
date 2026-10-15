import type { ButtonHTMLAttributes } from "react";

export interface DeviceChoiceProps {
  /** The reference devices, by name. */
  devices: readonly string[];
  /** The one the look is open at. */
  value: string;
  onChange?: (device: string) => void;
  /** What a segment says to a test, by device: its `data-*` attributes. */
  optionProps?: (
    device: string,
  ) => ButtonHTMLAttributes<HTMLButtonElement> &
    Record<`data-${string}`, string>;
  className?: string;
}

/**
 * Which reference device a look is open at: one segment per device, the open
 * one inked. The names come from the app's `devices.json`, never from here.
 */
export function DeviceChoice({
  devices,
  value,
  onChange,
  optionProps,
  className = "",
}: DeviceChoiceProps) {
  return (
    <div
      data-component="device-choice"
      className={`inline-flex rounded-lg border border-line bg-surface p-hair ${className}`}
    >
      {devices.map((device) => (
        <button
          key={device}
          type="button"
          aria-pressed={device === value}
          onClick={() => onChange?.(device)}
          {...optionProps?.(device)}
          className={`rounded-md px-3 py-1 text-sm leading-3 ${
            device === value ? "bg-ink text-surface" : "text-ink-soft"
          }`}
        >
          {device}
        </button>
      ))}
    </div>
  );
}
