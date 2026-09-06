import { readdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import matter from "gray-matter";
import { generatePostImage } from "./generate-image.mjs";

const GRAPH_API_VERSION = "v21.0";
const POSTS_DIR = path.resolve("posts");
const IMAGES_DIR = path.resolve("assets/instagram");

const {
  IG_ACCESS_TOKEN,
  IG_BUSINESS_ACCOUNT_ID,
  GITHUB_REPOSITORY, // "owner/repo", provided automatically in GitHub Actions
  GIT_BRANCH = "master",
  DRY_RUN,
} = process.env;

function sh(cmd) {
  return execSync(cmd, { stdio: "pipe" }).toString().trim();
}

async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const raw = await readFile(filePath, "utf8");
    const parsed = matter(raw);
    posts.push({ file, filePath, raw, ...parsed });
  }
  posts.sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
  return posts;
}

function extractSections(body) {
  const withoutTitle = body.replace(/^\s*#\s+.*\n+/, "");
  const withoutFooter = withoutTitle.split(/\n---\n/)[0];
  const parts = withoutFooter.split(/\n##\s+/);
  const intro = parts[0].trim();
  const sections = {};
  for (const part of parts.slice(1)) {
    const [heading, ...rest] = part.split("\n");
    sections[heading.trim()] = rest.join("\n").trim();
  }
  return { intro, sections };
}

function buildCaption(post) {
  const { title, category, tags = [] } = post.data;
  const { intro, sections } = extractSections(post.content);
  const memo = sections["一言メモ"] || "";

  const hashtags = [
    "#" + category,
    ...tags.map((t) => "#" + String(t).replace(/\s+/g, "")),
    "#家電好きな人と繋がりたい",
  ].join(" ");

  let bodyText = [intro, memo].filter(Boolean).join("\n\n");

  const footer = `\n\n${hashtags}`;
  const maxBodyLen = 2200 - title.length - footer.length - 4;
  if (bodyText.length > maxBodyLen) {
    bodyText = bodyText.slice(0, Math.max(0, maxBodyLen - 1)) + "…";
  }

  return `${title}\n\n${bodyText}${footer}`;
}

async function commitAndPush(filePaths, message) {
  sh(`git add ${filePaths.map((p) => `"${p}"`).join(" ")}`);
  const status = sh("git status --porcelain");
  if (!status) return false;
  sh(`git -c user.email="actions@github.com" -c user.name="instagram-bot" commit -q -m "${message}"`);
  sh(`git push origin HEAD:${GIT_BRANCH}`);
  return true;
}

async function createMediaContainer(imageUrl, caption) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/media`;
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: IG_ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok) throw new Error(`media container failed: ${JSON.stringify(json)}`);
  return json.id;
}

async function waitUntilReady(containerId) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${IG_ACCESS_TOKEN}`;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("media container processing error");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("media container not ready in time");
}

async function publishMedia(containerId) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/media_publish`;
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: IG_ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: "POST", body: params });
  const json = await res.json();
  if (!res.ok) throw new Error(`publish failed: ${JSON.stringify(json)}`);
  return json.id;
}

async function main() {
  const posts = await loadPosts();
  const next = posts.find((p) => !p.data.instagram_posted);

  if (!next) {
    console.log("No unposted articles found.");
    return;
  }

  console.log(`Next post: ${next.file}`);

  const imageFileName = next.file.replace(/\.md$/, ".png");
  const imagePath = path.join(IMAGES_DIR, imageFileName);

  const dateValue = next.data.date;
  const dateStr =
    dateValue instanceof Date
      ? dateValue.toISOString().slice(0, 10)
      : String(dateValue);

  await generatePostImage({
    title: next.data.title,
    category: next.data.category,
    date: dateStr,
    outPath: imagePath,
  });
  console.log(`Generated image: ${imagePath}`);

  const caption = buildCaption(next);
  console.log("---- caption ----");
  console.log(caption);
  console.log("------------------");

  if (DRY_RUN === "true") {
    console.log("DRY_RUN=true, skipping commit/push and actual Instagram post.");
    return;
  }

  await commitAndPush([imagePath], `Add Instagram image for ${next.file}`);

  const relImagePath = path
    .relative(process.cwd(), imagePath)
    .split(path.sep)
    .join("/");
  const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GIT_BRANCH}/${relImagePath}`;
  console.log(`Image URL: ${imageUrl}`);

  const containerId = await createMediaContainer(imageUrl, caption);
  await waitUntilReady(containerId);
  const mediaId = await publishMedia(containerId);
  console.log(`Published to Instagram. media id: ${mediaId}`);

  const updated = matter.stringify(next.content, {
    ...next.data,
    instagram_posted: true,
    instagram_media_id: mediaId,
    instagram_posted_at: new Date().toISOString(),
  });
  await writeFile(next.filePath, updated, "utf8");
  await commitAndPush([next.filePath], `Mark ${next.file} as posted to Instagram`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
