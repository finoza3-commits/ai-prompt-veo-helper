// --- Deno Deploy Version --- //
// ใช้ ES Modules + ไม่มี require()

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import OpenAI from "https://esm.sh/openai";
import path from "https://esm.sh/path-browserify";

// โหลด ENV key จาก Deno Deploy
const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// ===========================
//   SYSTEM PROMPT แบบเดิม
// ===========================
function buildVeoSystemPrompt(productLabel) {
  return `
คุณคือผู้เชี่ยวชาญด้านการเขียน Prompt สำหรับสร้างวิดีโอด้วยโมเดล Veo 3.1
หน้าที่ของคุณคือ "จัดโครง Prompt ให้เป็นหัวข้อ 1–14 แบบเดิมให้ครบทุกข้อ" สำหรับสินค้า: ${productLabel}

ให้ตอบ "เป็นภาษาไทยทั้งหมด" ยกเว้นชื่อหัวข้อภาษาอังกฤษในวงเล็บที่กำหนดไว้แล้ว
และต้อง "แสดงหัวข้อครบทั้ง 14 ข้อ" ตามรูปแบบต่อไปนี้เท่านั้น:

1. Scene (ฉาก):
2. Subject (สินค้า):
3. Talent / On-screen Speaker (ผู้แสดง):
4. Shot / Camera Motion (มุมกล้อง/การเคลื่อนไหว):
5. Action (การกระทำ):
6. Composition (การจัดองค์ประกอบ):
7. Ambiance / Lighting (บรรยากาศ/แสง):
8. Style / Aesthetic (สไตล์วิดีโอ):
9. Visual Cues / Scene Changes (สัญญาณเปลี่ยนฉาก):
10. Sound Design (การออกแบบเสียง):
11. Voice-over Thai saying (เสียงบรรยาย):
12. On-screen Dialogue Thai saying (บทพูดของนักแสดง):
13. Emotional Tone (โทนอารมณ์):
14. Iteration / Constraints (เงื่อนไข):

(เนื้อหากติกาเหมือนเดิมทั้งหมด…)
`;
}

function buildGenericSystemPrompt() {
  return `
คุณคือผู้ช่วยเขียน Prompt ภาษาไทยสำหรับคอนเทนต์วิดีโอ / โฆษณาออนไลน์
ตอบเป็นภาษาไทย อ่านลื่น เป็นธรรมชาติ
`;
}

// ===========================
//         API ROUTER
// ===========================
async function handleApiTransform(req, url) {
  try {
    const body = await req.json();
    const { prompt, mode } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return json({ error: "Missing prompt (กรุณาส่ง prompt มาด้วย)" }, 400);
    }

    const cleanPrompt = prompt.trim();

    // -------- เลือก System Prompt --------
    let systemPrompt = "";
    let userInstruction = "";

    if (
      mode === "veo31_shirt" ||
      mode === "veo31_underwear" ||
      mode === "veo31_socks"
    ) {
      let productLabel = "สินค้าเสื้อผ้า";
      if (mode === "veo31_shirt")
        productLabel = "เสื้อ / เสื้อยืด / เสื้อโปโล / ฮู้ด";
      if (mode === "veo31_underwear") productLabel = "กางเกงในผู้ชาย";
      if (mode === "veo31_socks") productLabel = "ถุงเท้า";

      systemPrompt = buildVeoSystemPrompt(productLabel);

      userInstruction = `
นี่คือรายละเอียดจากผู้ใช้:

${cleanPrompt}

ถ้ามีคำว่า "ตามรูป" ให้สมมติว่ามีรูปจริง และปรับฉากให้ตรงตามนั้น
      `.trim();
    } else {
      systemPrompt = buildGenericSystemPrompt();
      userInstruction = cleanPrompt;
    }

    // -------- เรียก OpenAI --------
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInstruction },
      ],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return json({ result: text }, 200);

  } catch (err) {
    return json({ error: "Server Error: " + err.message }, 500);
  }
}

// ---------------------------
// Helper JSON response
// ---------------------------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ===========================
//     MAIN DENO SERVER
// ===========================
serve(async (req) => {
  const url = new URL(req.url);

  // ----- API ROUTES -----
  if (req.method === "POST" && url.pathname === "/api/transform") {
    return handleApiTransform(req, url);
  }

  // ----- Static Files (index.html / css / js) -----
  return serveDir(req, {
    fsRoot: "",
    urlRoot: "",
  });
});
