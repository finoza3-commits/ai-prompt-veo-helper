// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// ✅ ฟิกพอร์ตตรง ๆ ไปเลยที่ 3001
const port = process.env.PORT || 3001;

// ตั้งค่า OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(
  bodyParser.json({
    limit: "15mb",
  })
);

// เสิร์ฟไฟล์หน้าเว็บ (index.html, css, js) จากโฟลเดอร์เดียวกับ server.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

/**
 * สร้าง system prompt สำหรับโหมด Veo 3.1
 * บังคับให้ตอบครบ 1–14 ทุกครั้ง
 * ✅ กฎบทพูด:
 *    - ถ้ามี "ประโยคบทพูดหลักของนักแสดง" จากผู้ใช้ → ให้ใช้ข้อความนั้นในข้อ 12 ตรง ๆ ห้ามแก้
 *    - ถ้าไม่มี → ให้ AI คิดบทพูดเองเหมือนเดิม
 */
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

กติกาสำคัญ:
- ห้ามลบหัวข้อใด ๆ ออกไป
- ห้ามเพิ่มหัวข้อใหม่ที่นอกเหนือจาก 1–14
- ทุกข้อจะต้องมีเนื้อหาครบ (ห้ามเว้นว่าง) ถึงแม้ผู้ใช้จะไม่ได้ให้ข้อมูลครบ
- ต้องสรุปและจัดรายละเอียดจาก Prompt ที่ผู้ใช้ให้มา รวมถึง:
  - รายละเอียดสินค้า
  - นักแสดง
  - ฉาก / สถานที่
  - ลำดับเหตุการณ์
  - โทนบทพูด
  - "ประโยคบทพูดหลักของนักแสดง" (ถ้ามี) ที่ผู้ใช้ระบุแยกเอาไว้

เงื่อนไขเรื่อง "บทพูดของนักแสดง" (ข้อ 12) ที่ต้องทำตามแบบเคร่งครัด:
1) ถ้าในข้อมูลจากผู้ใช้มีส่วนที่ระบุชัดเจนว่า
   "ประโยคบทพูดหลักของนักแสดง (ผู้ใช้ต้องการให้พูดหรือใช้เป็นแกนหลักของบทพูด):"
   และตามด้วยข้อความบทพูดหนึ่งหรือหลายประโยค
   - ให้คุณถือว่าข้อความนั้นคือ "สคริปต์บทพูดที่ผู้ใช้ล็อกไว้แล้ว"
   - ให้คัดลอกข้อความนั้นไปใส่ในหัวข้อที่ 12 ตรง ๆ
   - ห้ามแก้คำ ห้ามลบคำ ห้ามเติมคำ ไม่เปลี่ยนสำนวน ไม่เปลี่ยนคำลงท้าย
   - ห้ามเพิ่มประโยคอื่นประกบก่อนหรือหลัง ใช้เฉพาะข้อความที่ผู้ใช้ให้มาเท่านั้น
   - สรุป: ข้อ 12 ต้องเป็นข้อความบทพูดที่ผู้ใช้พิมพ์มาแบบคำต่อคำ (verbatim)

2) ถ้า "ไม่มี" ข้อมูลส่วนนี้อยู่ใน Prompt จากผู้ใช้
   - ให้คุณคิดบทพูดของนักแสดงเองได้เหมือนเดิม
   - ให้เน้นโทนที่เหมาะสมกับสินค้าและฉาก เช่น ตลาดนัด / ออนไลน์ / คาเฟ่ ฯลฯ
   - ความยาว 1–2 ประโยค เน้นขาย ปิดการขาย และจบในเวลาประมาณ 8 วินาที

ข้ออื่น ๆ:
- ข้อ 14 (Iteration / Constraints (เงื่อนไข)) ให้ระบุชัดเจนว่า:
  - ให้นักแสดงพูดเองเท่านั้น 100%
  - ต้นคลิปไม่มีบทพูดใด ๆ เลย
  - ห้ามมีโลโก้แบรนด์หรือสินค้าใด ๆ ปรากฏในวิดีโอ
  - ห้ามมีโลโก้สินค้าใด ๆ
  - ห้ามมีข้อความบนหน้าจอ
  - ห้ามมี UI หรือกราฟิกใด ๆ
  - ห้ามมี subtitle ใด ๆ
  - ความยาววิดีโอ ~8 วินาที
  - อัตราส่วนแนวตั้ง 9:16
  - ความละเอียด 4K
  - **ห้ามมีข้อความบนหน้าจอ, ไม่มี UI, ไม่มีกราฟิก, ไม่มี subtitle ใด ๆ**

โทนการเขียนโดยรวม:
- อ่านง่ายเหมือนเขียนบรีฟให้ทีมตัดต่อ/ทีมทำวิดีโอเข้าใจทันที
- ใช้ภาษากระชับ แต่มีรายละเอียดพอสมควร
- ต้องตอบเป็นบล็อก 1–14 ตามลำดับเท่านั้น
`;
}

/**
 * โหมดอื่น ๆ (ไม่บังคับ 1–14)
 */
function buildGenericSystemPrompt() {
  return `
คุณคือผู้ช่วยเขียน Prompt ภาษาไทยสำหรับคอนเทนต์วิดีโอ / โฆษณาออนไลน์
ตอบเป็นภาษาไทย อ่านลื่น เป็นธรรมชาติ
ถ้าโหมดเป็น TikTok ให้ออกมาเป็นสคริปต์สั้น ๆ
แต่ถ้าเป็นโหมดปรับปรุง ย่อ ขยาย ก็โฟกัสตามที่ผู้ใช้ระบุ
`;
}

app.post("/api/transform", async (req, res) => {
  try {
    const { prompt, mode, imageData } = req.body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res
        .status(400)
        .json({ error: "Missing prompt (กรุณาส่ง prompt มาด้วย)" });
    }

    const cleanPrompt = prompt.trim();

    // เลือก system prompt ตามโหมด
    let systemPrompt = "";
    let userInstruction = "";

    if (
      mode === "veo31_shirt" ||
      mode === "veo31_underwear" ||
      mode === "veo31_socks"
    ) {
      // 3 โหมดหลักที่ต้องการ 1–14
      let productLabel = "สินค้าเสื้อผ้า";
      if (mode === "veo31_shirt") productLabel = "เสื้อ / เสื้อยืด / เสื้อโปโล / ฮู้ด";
      if (mode === "veo31_underwear") productLabel = "กางเกงในผู้ชาย";
      if (mode === "veo31_socks") productLabel = "ถุงเท้า";

      systemPrompt = buildVeoSystemPrompt(productLabel);

      userInstruction = `
นี่คือรายละเอียดจากผู้ใช้ + ตัวช่วย preset (เกี่ยวกับสินค้า: ${productLabel}):

${cleanPrompt}

ถ้ามีส่วนที่พูดถึงรูปภาพหรือคำว่า "ตามรูป" ให้สมมติว่ามีรูปสินค้าจริงแนบมา และช่วยปรับ Scene / Subject ให้สอดคล้องกับสินค้าในรูปนั้นด้วย
ถ้าข้อมูลไม่ครบ ให้คุณ "จินตนาการเติม" ให้เนียน เหมาะกับสินค้า และโทนตลาดนัด / ออนไลน์ขายของ
      `.trim();
    } else {
      // โหมดอื่น: tiktok, expand, short, improve
      systemPrompt = buildGenericSystemPrompt();

      if (mode === "tiktok") {
        userInstruction = `
โหมด: TikTok / ตลาดนัด
งานของคุณ: 
- เปลี่ยนข้อความต่อไปนี้ให้กลายเป็น "สคริปต์โฆษณา TikTok สั้น ๆ" ความยาวประมาณ 8–12 วินาที
- ให้มีบทพูดของคนขายพูดกับกล้องตรง ๆ
- ถ้าในข้อความมีประโยคขายอยู่แล้ว ให้ใช้เป็นแกนหลักได้

ข้อความจากผู้ใช้:
${cleanPrompt}
        `.trim();
      } else if (mode === "expand") {
        userInstruction = `
โหมด: ขยายรายละเอียด
งานของคุณ:
- ขยายเนื้อหาต่อไปนี้ให้ละเอียดขึ้น
- แต่ยังคงสไตล์เดิมของผู้ใช้

ข้อความจากผู้ใช้:
${cleanPrompt}
        `.trim();
      } else if (mode === "short") {
        userInstruction = `
โหมด: ย่อให้กระชับ
งานของคุณ:
- ย่อข้อความต่อไปนี้ให้สั้นลง แต่คงใจความสำคัญให้ครบ
- ยังใช้ภาษาไทยแบบเป็นกันเอง อ่านลื่น

ข้อความจากผู้ใช้:
${cleanPrompt}
        `.trim();
      } else if (mode === "improve") {
        userInstruction = `
โหมด: ปรับให้มืออาชีพ อ่านลื่น
งานของคุณ:
- ปรับข้อความต่อไปนี้ให้อ่านลื่นขึ้น ดูมืออาชีพขึ้นเล็กน้อย
- แต่ยังรักษาโทนเดิมและคำพูดสไตล์แม่ค้าตลาดนัด / คนขายของออนไลน์

ข้อความจากผู้ใช้:
${cleanPrompt}
        `.trim();
      } else {
        // เผื่อ mode แปลก ๆ
        userInstruction = cleanPrompt;
      }
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInstruction },
      ],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content || "";

    return res.json({ result: text });
  } catch (err) {
    console.error("API Error:", err);
    return res
      .status(500)
      .json({ error: "มีปัญหาในฝั่ง server: " + (err.message || "UNKNOWN") });
  }
});

// เริ่มรัน server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
