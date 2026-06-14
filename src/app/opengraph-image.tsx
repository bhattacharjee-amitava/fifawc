import { ImageResponse } from "next/og";

export const alt =
  "CopaKick — FIFA World Cup 2026 schedule and kickoff times in your local timezone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card. Rendered at build/edge into a static-ish PNG; entirely
// separate from the app UI, so it carries zero risk to the live experience.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0b09",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            color: "#c8f250",
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          11 Jun – 19 Jul 2026 · USA · Canada · Mexico
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#f5f7f0",
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.0,
            }}
          >
            The World Cup,
          </div>
          <div
            style={{
              color: "#c8f250",
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.0,
            }}
          >
            on your clock.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "#9aa395", fontSize: 34 }}>
            Every fixture in your local timezone
          </div>
          <div
            style={{
              color: "#0a0b09",
              background: "#c8f250",
              fontSize: 38,
              fontWeight: 800,
              padding: "14px 32px",
              borderRadius: 16,
            }}
          >
            CopaKick
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
