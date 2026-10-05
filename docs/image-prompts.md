# Prompt ทำรูปให้ KaoNgan

ระบบถูกออกแบบให้ **วางไฟล์รูปแล้วใช้ได้เลย ไม่ต้องแก้โค้ด** — ถ้าไม่วาง ระบบจะใช้แมวและพื้นหลังที่วาดไว้ในตัว (SVG) ตามเดิม
ใช้กับ AI สร้างรูปตัวไหนก็ได้ (Midjourney, DALL·E / ChatGPT, Gemini, Firefly, Leonardo, Stable Diffusion ฯลฯ) prompt เป็นภาษาอังกฤษเพราะให้ผลดีกว่า

| อยากได้ | วางไฟล์ที่ไหน | ขนาด | ผลลัพธ์ |
|---|---|---|---|
| มาสคอตแมว 4 ท่า | `public/img/mascot/sleepy.webp` `happy.webp` `bye.webp` `oops.webp` (+ `chill.webp` ไม่บังคับ) | 512×512 พื้นโปร่งใส | แทนแมวในหน้าล็อกอิน หน้าหลัก ป๊อปอัปสแกนสำเร็จ หน้าว่างต่าง ๆ |
| ไอคอนแอป | `public/icons/icon-source.png` แล้วรัน `npm run icons` | 1024×1024 เต็มกรอบ ไม่โปร่งใส | ไอคอนติดตั้งบนมือถือ + โลโก้มุมซ้ายบน + favicon |
| พื้นหลังใหม่ | `public/bg/ชื่อไฟล์.webp` (+ ชื่อไทยใน `public/bg/backgrounds.json`) | ดูด้านล่าง | โผล่ในหน้า “ฉัน → เลือกพื้นหลัง” ทันที |

ชื่อไฟล์ใช้ได้เฉพาะ `a-z 0-9 _ -` · ไฟล์ `.png` `.jpg` `.webp` `.avif` ก็ใช้ได้ (มาสคอตใช้ `.webp` `.png` หรือ `.svg`)

---

## 1) มาสคอตแมว (ต้องทำให้ครบ 4 ท่า ถึงจะแทนตัวเดิม)

**ขั้นตอนที่ได้ตัวละครหน้าเดิมทุกท่า**
1. สร้างท่า `happy` ก่อน เลือกอันที่ชอบที่สุด
2. ท่าอื่นให้แนบรูป `happy` เป็นรูปอ้างอิง แล้วเติมประโยค *“same exact character as the reference image, keep the identical design, colors and proportions”*
3. ลบพื้นหลังให้โปร่งใส (remove.bg / Photopea / ChatGPT “remove background”) → ย่อเป็น 512×512 → บันทึกเป็น `.webp` (squoosh.app)
4. ตั้งชื่อตามท่า วางใน `public/img/mascot/` → รีเฟรชหน้าเว็บ (ไม่ต้องรีสตาร์ตเซิร์ฟเวอร์)

**Prompt ตัวละครหลัก (ใช้ร่วมกันทุกท่า)**

```
A cute chubby white kawaii kitten mascot sitting upright, round head, small pink bow on its right ear,
soft lavender tabby stripes on the forehead, big shiny black eyes with two white highlights,
rosy pink blush on the cheeks, tiny pink triangle nose, short whiskers, pink inner ears,
small round body with a pale pink belly patch, little white paws, long curled tail.
Sticker-style illustration, clean dark plum outline (#4a3548), flat pastel colors with soft cel shading,
chibi proportions, friendly and adorable. Full body visible with some margin around it,
centered, isolated on a plain solid white background, square 1:1, high resolution,
no text, no watermark, no logo, no background scenery.
```

**ต่อท้ายตามท่า**

| ไฟล์ | ใช้ตอนไหน | เติมท้าย prompt |
|---|---|---|
| `sleepy` | ยังไม่ได้เข้างาน (ช่วงเช้า) | `Pose: sleepy and yawning, eyes gently closed, holding a small steaming coffee mug, tiny floating "zZ" above the head, relaxed morning mood.` |
| `happy` | กำลังทำงาน / ตอนเข้างานตรงเวลา | `Pose: very happy, wide open sparkling eyes, big open smile, giving a small thumbs up, tiny yellow sparkles around, wearing a small employee ID badge on a lanyard.` |
| `bye` | เลิกงานแล้ว | `Pose: cheerfully waving goodbye with one raised paw, eyes closed in happy upside-down U shapes, wearing a tiny backpack, evening going-home mood.` |
| `oops` | สแกนผิด / มีข้อผิดพลาด | `Pose: confused and slightly worried, eyes wide with small pupils, ears drooping, a single blue sweat drop on the forehead, a small question mark floating beside, paws raised in a shrug.` |
| `chill` *(ไม่บังคับ)* | วันที่ลา | `Pose: relaxing on vacation, wearing cute round sunglasses and a tiny straw hat, holding a coconut drink with a straw, a small palm leaf beside, smug happy smile.` |

> ถ้า AI ทำพื้นหลังโปร่งใสไม่ได้ ให้สั่ง *“plain solid #FFFFFF background”* แล้วค่อยลบพื้นหลังทีหลัง ห้ามให้มีเงาตกพื้นเพราะลบยาก

---

## 2) ไอคอนแอป

ต้อง **เต็มกรอบสี่เหลี่ยม ไม่โปร่งใส ไม่ต้องโค้งมุมเอง** (มือถือจะมาโค้ง/ตัดวงกลมให้) และให้ตัวแมวอยู่ใน **กลาง 80%** ของรูป เพื่อไม่ให้ถูกตัด

```
Mobile app icon, square 1:1. A cute kawaii white kitten face with a small pink bow on the ear,
big shiny eyes, pink blush, happy smile, centered and filling about 65% of the canvas.
A small round green check-mark badge with a white ring at the bottom-right corner.
Smooth gradient background from soft pink (#ffb3d6) through hot pink (#ff7ab5) to lavender (#b19cff),
subtle glossy highlight in the top-left. Soft 3D-sticker style with a clean dark plum outline,
modern, playful and clean. Full-bleed square background, no rounded corners, no text, no letters,
no border, no watermark. 1024x1024.
```

ได้รูปแล้ว: บันทึกเป็น `public/icons/icon-source.png` → รัน `npm run icons` → ระบบสร้างไอคอน 192 / 512 / maskable ให้เอง (เปลี่ยนทั้งโลโก้ในแอปและ favicon)

---

## 3) พื้นหลัง

มี 2 แบบ เลือกแบบที่ตรงกับรูปที่ได้:

### แบบ A — ลายซ้ำไร้รอยต่อ (แนะนำ ใช้ได้ทุกขนาดจอ ไม่โดนตัดขอบ)
ขอ **seamless tileable pattern** ขนาด 1024×1024 → ย่อเหลือ 512×512 `.webp`

```
Seamless tileable pattern, kawaii pastel illustration, {THEME}. Evenly scattered small cute doodles
with generous empty space between them, soft low-contrast pastel colors on a light {COLOR} background,
flat simple shapes, no outlines darker than the fill colors, nothing touching the edges so it repeats cleanly.
Calm and airy so that text on top stays readable. Square 1:1, no text, no letters, no watermark.
```

แล้วเพิ่มใน `public/bg/backgrounds.json` (ตั้ง `tile` = ขนาดลายเป็นพิกเซลบนจอ ลอง 220–320):

```json
"catfish": { "name": "แมวกับก้างปลา", "mode": "tile", "tile": 260 }
```

### แบบ B — ภาพทิวทัศน์เต็มจอ (cover)
ย่อ/ครอปตามขนาดจอ (มือถือแนวตั้งโดนตัดข้าง คอมโดนตัดบนล่าง) จึงต้องให้ **ตรงกลางโล่ง ของตกแต่งกระจายทั่วภาพ** ไม่กระจุกที่มุม ขนาดแนะนำ 2400×1600 ไม่เกิน ~400 KB

```
Wide soft pastel kawaii landscape illustration, {THEME}. Cute decorations scattered evenly across the whole image,
the center area calm and mostly empty, dreamy gradient sky, gentle depth, low contrast and light so white cards
placed on top stay readable. 3:2 aspect ratio, 2400x1600, no text, no letters, no watermark, no people.
```

```json
"sakuracafe": { "name": "คาเฟ่ซากุระ" }
```

### ไอเดียธีม (แทนที่ `{THEME}` และ `{COLOR}`)

| ธีม | `{THEME}` | `{COLOR}` |
|---|---|---|
| แมวกับก้างปลา | tiny cats, fish bones, yarn balls and paw prints | cream |
| ซากุระ | sakura petals, tiny blossoms and small pink hearts | soft pink |
| สตรอว์เบอร์รีมิลค์ | strawberries, milk cartons, hearts and sparkles | pale pink |
| หมีน้อยกับน้ำผึ้ง | cute bears, honey pots, bees and small flowers | pale yellow |
| ขนมหวาน | donuts, macarons, cupcakes and sprinkles | lavender |
| สายรุ้งกับเมฆ | rainbows, fluffy clouds, stars and tiny suns | baby blue |
| กระต่ายกับแครอท | bunnies, carrots, clovers and little flowers | mint |
| ใต้ทะเล | pastel jellyfish, tiny fish, shells and bubbles | aqua |
| อวกาศน่ารัก | little planets, crescent moons, stars and tiny rockets | deep lavender (ใช้แนวมืดได้ แต่ให้คอนทราสต์ต่ำ) |

---

## เคล็ดลับให้รูปออกมาใช้งานได้จริง

- **อ่านตัวหนังสือได้:** การ์ดในแอปเป็นสีขาวโปร่ง พื้นหลังจึงควรสีอ่อน คอนทราสต์ต่ำ ลายไม่หนาแน่น
- **อย่าให้มีตัวหนังสือ/โลโก้ในรูป:** AI มักสะกดผิดและตัดขอบแล้วดูแปลก
- **ขนาดไฟล์:** พื้นหลังไม่ควรเกิน ~400 KB (แปลงเป็น `.webp` ที่ squoosh.app คุณภาพ 75–80) มือถือจะโหลดเร็ว
- **ลองบนมือถือจริง:** เข้า “ฉัน → เลือกพื้นหลัง” ดูว่าตัวหนังสือบนการ์ดอ่านง่ายไหม
- **ลิขสิทธิ์:** ตรวจเงื่อนไขการใช้งานเชิงพาณิชย์ของ AI ที่ใช้สร้างรูปก่อนนำไปใช้ในธุรกิจ
