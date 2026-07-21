import { ImageResponse } from "next/og";
import { getPwaLogoDataUrl } from "@/lib/pwa-icon";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default async function AppleIcon() {
  const logoSrc = await getPwaLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7CCBE6",
        }}
      >
        <img
          alt="NEXT"
          height={38}
          src={logoSrc}
          style={{ objectFit: "contain" }}
          width={156}
        />
      </div>
    ),
    size,
  );
}
