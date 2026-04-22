import { ImageResponse } from "next/og";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { id: "small", size: { width: 192, height: 192 }, contentType },
    { id: "large", size: { width: 512, height: 512 }, contentType },
    { id: "maskable", size: { width: 512, height: 512 }, contentType },
  ];
}

export default function Icon({ id }: { id: string }) {
  const size = id === "small" ? 192 : 512;
  const isMaskable = id === "maskable";
  // Maskable icons need a 20% safe zone padding so the letter doesn't clip
  // when Android applies adaptive masks (circles, rounded squares, etc).
  const padding = isMaskable ? size * 0.1 : 0;
  const fontSize = (size - padding * 2) * 0.62;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: size - padding * 2,
            height: size - padding * 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fafafa",
            fontSize,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          E
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
