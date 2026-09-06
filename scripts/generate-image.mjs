import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const FONT_URL =
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf";
const FONT_CACHE_DIR = path.resolve("assets/.font-cache");
const FONT_CACHE_PATH = path.join(FONT_CACHE_DIR, "NotoSansCJKjp-Bold.otf");

const CATEGORY_COLORS = {
  家電: "#2563eb",
  家具: "#b45309",
};

async function getFont() {
  if (!existsSync(FONT_CACHE_PATH)) {
    await mkdir(FONT_CACHE_DIR, { recursive: true });
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`Font download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(FONT_CACHE_PATH, buf);
  }
  return readFile(FONT_CACHE_PATH);
}

export async function generatePostImage({ title, category, date, outPath }) {
  const fontData = await getFont();
  const accent = CATEGORY_COLORS[category] || "#374151";

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#fafaf9",
          fontFamily: "NotoSansJP",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "16px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      backgroundColor: accent,
                      color: "#ffffff",
                      fontSize: "32px",
                      fontWeight: 700,
                      padding: "10px 28px",
                      borderRadius: "999px",
                    },
                    children: category,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      fontSize: "28px",
                      color: "#57534e",
                    },
                    children: date,
                  },
                },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: "56px",
                fontWeight: 700,
                color: "#1c1917",
                lineHeight: 1.4,
              },
              children: title,
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: "28px",
                color: "#78716c",
              },
              children: "最新家電・家具ブログ",
            },
          },
        ],
      },
    },
    {
      width: 1080,
      height: 1080,
      fonts: [
        {
          name: "NotoSansJP",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  const png = resvg.render().asPng();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  return outPath;
}
