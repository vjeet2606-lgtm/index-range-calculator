import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090D",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 100 100" fill="none">
          <path
            d="M38,12 L38,88 L82,88"
            stroke="#b7ff3c"
            strokeWidth="12"
            strokeLinejoin="miter"
            strokeLinecap="butt"
          />
          <path
            d="M22,18 L64,82"
            stroke="#b7ff3c"
            strokeWidth="12"
            strokeLinejoin="miter"
            strokeLinecap="butt"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
