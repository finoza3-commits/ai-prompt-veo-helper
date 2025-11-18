// =====================================================================
//  Deno Deploy version — Express → Deno แต่ทุกการทำงานเหมือนเดิม 100%
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import OpenAI from "npm:openai";

// โหลด ENV
const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// ===========================
//  ฟังก์ชัน System Prompt เดิม
// ===========================
function buildVeoSystemPrompt(productLabel) {
  return `
คุณคือผู้เชี่ยวชาญด้านการเขียน Prompt สำหรับสร้างวิดีโอด้วยโมเดล Veo 3.1
หน้าที่ของคุณคือ "จัดโครง Prompt ให้เป็นหัวข้อ 1–14 แบบเดิมให้ครบทุกข้อ" สำหรับสินค้า: ${productLabel}

ให้ตอบ "เป็นภาษาไทยทั้งหมด"
และต้องแสดงหัวข้อครบทุกข้อแบบนี้:

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

กติกาสำคัญ:
- ห้ามลบหัวข้อ
- ห้ามเพิ่มหัวข้อ
- ทุกข้อห้ามเว้นว่าง
- ถ้าผู้ใช้ระบุ “บทพูดหลัก” → ให้ใส่ตรงข้อ 12 แบบคำต่อคำ ห้ามแก้
- ถ้าไม่มี → AI คิดเอง
- ข้อ 14 ต้องระบุ 4K, 9:16, ไม่มี UI/กราฟิก/ข้อความบนจอ ฯลฯ แบบเดิมทั้งหมด
`;
}

function buildGenericSystemPrompt() {
  return `
คุณคือผู้ช่วยเขียน Prompt ภาษาไทยสำหรับคอนเทนต์วิดีโอ / โฆษณาออนไลน์
ตอบเป็นภาษาไทย อ่านลื่น และรักษาสไตล์ของผู้ใช้
`;
}

// ===========================
//  API Logic เหมือนเดิม 100%
// ===========================
async function handleApiTransform(req) {
  try {
    const body = await req.json();
    const { prompt, mode } = body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return json({ error: "Missing prompt" }, 400);
    }

    const cleanPrompt = prompt.trim();
    let systemPrompt = "";
    let userInstruction = "";

    // ---- โหมด Veo (1–14) ----
    if (
      mode === "veo31_shirt" ||
      mode === "veo31_underwear" ||
      mode === "veo31_socks"
    ) {
      let productLabel = "สินค้าเสื้อผ้า";
      if (mode === "veo31_shirt") productLabel = "เสื้อ / เสื้อยืด / เสื้อโปโล / ฮู้ด";
      if (mode === "veo31_underwear") productLabel = "กางเกงในผู้ชาย";
      if (mode === "veo31_socks") productLabel = "ถุงเท้า";

      systemPrompt = buildVeoSystemPrompt(productLabel);

      userInstruction = `
รายละเอียดจากผู้ใช้เกี่ยวกับสินค้า ${productLabel}:

${cleanPrompt}

ถ้าพูดถึงรูป ให้สมมติว่ามีรูปจริง และปรับฉากให้ตรงสินค้า
`.trim();
    }

    // ---- โหมดทั่วไป ----
    else {
      systemPrompt = buildGenericSystemPrompt();

      if (mode === "tiktok") {
        userInstruction = `
โหมด TikTok / ตลาดนัด:
- สร้างสคริปต์ 8–12 วิ
- คนขายพูดกับกล้อง

ข้อความ:
${cleanPrompt}
`.trim();
      } else if (mode === "expand") {
        userInstruction = `ขยายเนื้อหาให้ละเอียดขึ้น:\n${cleanPrompt}`;
      } else if (mode === "short") {
        userInstruction = `ย่อข้อความให้กระชับ:\n${cleanPrompt}`;
      } else if (mode === "improve") {
        userInstruction = `ปรับข้อความให้ลื่นและมืออาชีพ:\n${cleanPrompt}`;
      } else {
        userInstruction = cleanPrompt;
      }
    }

    // ---- เรียก OpenAI ----
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

// ===========================
//  Helper JSON
// ===========================
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ===========================
//     MAIN SERVER 24 ชม.
// ===========================
serve(async (req) => {
  const url = new URL(req.url);

  // API
  if (req.method === "POST" && url.pathname === "/api/transform") {
    return handleApiTransform(req);
  }

  // Static files เช่น index.html / script.js
  return serveDir(req, { fsRoot: "", urlRoot: "" });
});
