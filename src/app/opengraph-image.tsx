import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { SOCIAL_IMAGE_ALT } from "@/lib/metadata";

export const alt = SOCIAL_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const aerialData = await readFile(
    join(process.cwd(), "public", "photos", "dracevac-dof.jpg"),
    "base64",
  );
  const aerialSource = `data:image/jpeg;base64,${aerialData}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#002c22",
          backgroundImage: `linear-gradient(rgba(0, 44, 34, 0.58), rgba(0, 44, 34, 0.58)), url(${aerialSource})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            padding: "72px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            Naš kvart
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              color: "#ecfdf5",
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "0.03em",
              lineHeight: 1.2,
            }}
          >
            Dračevac · Bilice
          </div>
        </div>
      </div>
    ),
    size,
  );
}
