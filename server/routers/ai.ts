import { initTRPC } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";
import { recordings } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { video } from "../mux.js";

const t = initTRPC.context<Record<string, never>>().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/** System prompt — cached to save tokens on repeat calls */
const SYSTEM_PROMPT = `You are an expert video editor assistant. Given a video transcript, you analyze it and provide editing suggestions to make the content more engaging and professional.

Your suggestions should be:
- Specific (include exact timestamps)
- Actionable (clear description of what to do)
- Prioritized (most impactful first)

You detect:
1. Filler words and verbal pauses (um, uh, like, you know, basically)
2. Long silences or dead air
3. Content that should be cut (repetitive explanations, false starts, off-topic tangents)
4. Good chapter break points
5. Key moments worth highlighting

Always respond with valid JSON matching the requested schema.`;

export const aiRouter = router({
  /**
   * Fetch the Mux-generated transcript for a recording.
   */
  fetchTranscript: publicProcedure
    .input(z.object({ recordingId: z.number() }))
    .mutation(async ({ input }) => {
      const [rec] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, input.recordingId))
        .limit(1);

      if (!rec?.muxAssetId) throw new Error("Recording not found or not ready");

      // Fetch tracks from Mux
      const asset = await video.assets.retrieve(rec.muxAssetId);
      const textTracks = asset.tracks?.filter((t) => t.type === "text") ?? [];

      if (textTracks.length === 0) {
        return { segments: [], status: "none" as const };
      }

      // Fetch the VTT content from Mux
      const track = textTracks[0];

      // Update transcript status
      await db
        .update(recordings)
        .set({ transcriptStatus: "ready" })
        .where(eq(recordings.id, input.recordingId));

      return { segments: [], trackId: track.id, status: "ready" as const };
    }),

  /**
   * Run AI auto-edit analysis on the transcript.
   * Uses prompt caching for the system prompt to reduce cost.
   */
  autoEdit: publicProcedure
    .input(
      z.object({
        recordingId: z.number(),
        transcript: z.string(),
        durationSeconds: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { recordingId, transcript, durationSeconds } = input;

      const userPrompt = `Here is the transcript for a ${Math.round(durationSeconds / 60)}-minute video:

<transcript>
${transcript}
</transcript>

Please analyze this and return a JSON object with this exact shape:
{
  "summary": "2-3 sentence summary of the video content",
  "suggestions": [
    {
      "type": "cut" | "chapter" | "filler",
      "startTime": <milliseconds>,
      "endTime": <milliseconds or null for chapters>,
      "label": "short label",
      "reason": "why this edit is recommended"
    }
  ],
  "chapters": [
    {
      "id": "<uuid>",
      "title": "chapter title",
      "startTime": <milliseconds>
    }
  ]
}

Include up to 15 suggestions and up to 8 chapters. Only include timestamps you are confident about.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            // Prompt caching: the system prompt is static, so cache it
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "";

      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");

      const parsed = JSON.parse(jsonMatch[0]) as {
        summary: string;
        suggestions: object[];
        chapters: object[];
      };

      // Persist to DB
      await db
        .update(recordings)
        .set({
          aiSummary: parsed.summary,
          aiSuggestions: parsed.suggestions,
          chapters: parsed.chapters,
        })
        .where(eq(recordings.id, recordingId));

      return parsed;
    }),

  /**
   * Generate a shareable title and description from the transcript.
   */
  generateMeta: publicProcedure
    .input(
      z.object({
        transcript: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Based on this transcript, generate a compelling title and one-sentence description for a screen recording. Return JSON: {"title": "...", "description": "..."}

Transcript: ${input.transcript.slice(0, 2000)}`,
          },
        ],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      return JSON.parse(jsonMatch[0]) as { title: string; description: string };
    }),
});
