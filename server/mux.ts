import Mux from "@mux/mux-node";

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export const { video } = mux;

/**
 * Create a Mux Direct Upload URL.
 * The browser uploads the video file directly to this URL — no S3 needed.
 */
export async function createMuxDirectUpload(): Promise<{
  uploadId: string;
  uploadUrl: string;
}> {
  const upload = await video.uploads.create({
    cors_origin: "*",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new_asset_settings: {
      playback_policy: ["public"],
      mp4_support: "capped-1080p",
      // generated_subtitles is valid at runtime but missing from SDK types
      generated_subtitles: [
        { language_code: "en", name: "English (auto-generated)" },
      ],
    } as any,
  });

  return { uploadId: upload.id, uploadUrl: upload.url };
}

/**
 * Get the current status of a Mux upload.
 * Once the browser finishes uploading, upload.asset_id will be populated.
 */
export async function getMuxUpload(uploadId: string) {
  return video.uploads.retrieve(uploadId);
}

/**
 * Get the current status of a Mux asset.
 */
export async function getMuxAsset(assetId: string) {
  return video.assets.retrieve(assetId);
}

