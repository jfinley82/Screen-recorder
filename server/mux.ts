import Mux from "@mux/mux-node";

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export const { video } = mux;

/**
 * Create a Mux asset from an S3 URL.
 * Returns the asset ID and the first playback ID.
 */
export async function createMuxAssetFromS3(
  s3Url: string,
  opts: { title?: string } = {}
): Promise<{ assetId: string; playbackId: string }> {
  const asset = await video.assets.create({
    input: [{ url: s3Url }],
    playback_policy: ["public"],
    mp4_support: "capped-1080p",
    generated_subtitles: [
      {
        language_code: "en",
        name: "English (auto-generated)",
      },
    ],
    meta: opts.title ? { title: opts.title } : undefined,
  });

  const playbackId =
    asset.playback_ids?.find((p) => p.policy === "public")?.id ?? "";

  return { assetId: asset.id, playbackId };
}

/**
 * Get the current status of a Mux asset.
 */
export async function getMuxAsset(assetId: string) {
  return video.assets.retrieve(assetId);
}

/**
 * Get transcript (captions) for a Mux asset.
 */
export async function getMuxTranscript(assetId: string) {
  const tracks = await video.assets.retrieveInputInfo(assetId);
  return tracks;
}
