"use client";

import { useRef, useState } from "react";
import { useFittedFrame } from "./useFittedFrame";

/**
 * A look drawn at its own size, with the reference devices to choose from
 * (storybook-components ADR decision 6): the thing a person approves is drawn
 * as it is, not behind a link. A story is served by the admin's own
 * `/storybook`, so its frame can be read and is fitted to the component it
 * holds; a mockup is a sandboxed document whose size is its device's. Choosing
 * a device sets the frame's width to the device's and fits the height; "Fit"
 * returns to the component's own size.
 */

export interface FrameDevice {
  name: string;
  width: number;
  height: number;
}

/** `match` leaves the scheme to the system, as the admin's own screens do. */
type Theme = "match" | "light" | "dark";
const THEMES: Array<[Theme, string]> = [
  ["match", "Match UI"],
  ["light", "Light"],
  ["dark", "Dark"],
];

/** A story's address with the theme global; a mockup's document pinned to the scheme on its root. */
const themedSrc = (src: string, theme: Theme) =>
  theme === "match" ? src : `${src}&globals=theme:${theme}`;
const themedDoc = (doc: string, theme: Theme) =>
  theme === "match" ? doc : doc.replace("<html", `<html data-theme="${theme}"`);

export function LookFrame({
  title,
  src,
  srcDoc,
  devices,
  initialDevice,
  testId,
}: {
  title: string;
  /** A story's address under the admin's own origin; fitted to its component. */
  src?: string;
  /** A mockup's document; drawn at a device's size, sandboxed. */
  srcDoc?: string;
  devices: FrameDevice[];
  /** The device it opens at; `null` is the component's own size (stories only). */
  initialDevice: string | null;
  testId: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<string | null>(initialDevice);
  const [theme, setTheme] = useState<Theme>("match");
  const fits = src !== undefined;
  const chosen = devices.find((d) => d.name === device) ?? null;
  const widest = Math.max(1, ...devices.map((d) => d.width));

  const { fitted, start, refit, forget } = useFittedFrame(ref, fits);

  const choose = (name: string | null) => {
    setDevice(name);
    forget();
    if (fits) setTimeout(refit, 100);
  };

  // The width a story is drawn at: the device's, or — until it is measured —
  // the widest device, so a block component reads its natural width.
  const width = chosen
    ? chosen.width
    : fits
      ? (fitted?.width ?? widest)
      : (devices[0]?.width ?? widest);
  const height = fits
    ? (fitted?.height ?? chosen?.height ?? 120)
    : (chosen?.height ?? devices[0]?.height ?? 600);
  const options: Array<{ name: string | null; label: string }> = [
    ...(fits ? [{ name: null, label: "Fit" }] : []),
    ...devices.map((d) => ({ name: d.name, label: d.name })),
  ];

  return (
    <div className="flex flex-col gap-2" data-testid={`${testId}-box`}>
      <fieldset className="flex flex-wrap items-center gap-2 text-xs">
        <legend className="sr-only">Device</legend>
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            data-testid="frame-device"
            data-device={o.name ?? "fit"}
            aria-pressed={device === o.name}
            onClick={() => choose(o.name)}
            className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[pressed=true]:bg-dusk-wash"
          >
            {o.label}
          </button>
        ))}
        {chosen ? (
          <span className="text-ink-faint">
            {chosen.width} × {fits ? height : chosen.height}
          </span>
        ) : fitted ? (
          <span className="text-ink-faint">
            {fitted.width} × {fitted.height}
          </span>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2 text-xs">
        <legend className="sr-only">Theme</legend>
        {THEMES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-testid="frame-theme"
            data-theme-choice={value}
            aria-pressed={theme === value}
            onClick={() => {
              forget();
              setTheme(value);
            }}
            className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[pressed=true]:bg-dusk-wash"
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div className="max-w-full overflow-auto">
        <iframe
          ref={ref}
          data-testid={testId}
          title={title}
          src={src === undefined ? undefined : themedSrc(src, theme)}
          srcDoc={srcDoc === undefined ? undefined : themedDoc(srcDoc, theme)}
          sandbox={fits ? undefined : ""}
          width={width}
          height={height}
          onLoad={fits ? start : undefined}
          className="block border-0 bg-surface elevated"
        />
      </div>
    </div>
  );
}
