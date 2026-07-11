import Groq from "groq-sdk";
import fs from "fs";
import os from "os";
import path from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Sends the recording's audio to Groq's Whisper model and returns the
 * transcribed text. Groq's SDK (like most transcription APIs) wants an
 * actual file on disk, not just raw bytes in memory - so we briefly
 * write the buffer to a temp file, then clean it up afterward.
 */
export async function transcribeAudio(buffer, filename = "recording.mp4") {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
  fs.writeFileSync(tempPath, buffer);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "text",
    });

    return transcription; // plain string of everything that was said
  } finally {
    // Always clean up the temp file, even if the API call above throws.
    fs.unlinkSync(tempPath);
  }
}

/**
 * Takes the raw transcript and asks a Groq LLM to produce a structured
 * summary + action items. We force JSON output so the frontend can
 * render fields directly instead of parsing free-form text.
 */
export async function generateMeetingNotes(transcriptText) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You summarize meeting transcripts. Respond ONLY with valid JSON in this exact shape: " +
          '{"summary": "2-4 sentence overview", "actionItems": ["item 1", "item 2"]}. ' +
          "If there are no clear action items, return an empty array for actionItems.",
      },
      {
        role: "user",
        content: `Transcript:\n\n${transcriptText}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content;
  return JSON.parse(raw); // { summary: "...", actionItems: [...] }
}