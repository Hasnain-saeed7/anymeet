import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = process.env.SUPABASE_S3_BUCKET;

/**
 * Downloads a file from the recordings bucket and returns it as a Buffer -
 * the raw bytes Node needs to attach it to an outgoing API request (to Groq).
 */
export async function downloadRecording(storageKey) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storageKey);

  if (error) {
    throw new Error(`Could not download recording: ${error.message}`);
  }

  // `data` here is a Blob (browser-style API, even though we're in Node) -
  // convert it into a Buffer, which is what Node/Groq's SDK expects.
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}