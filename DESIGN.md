# Design System — Ayat Visualization

## Product Context
- **What this is:** A 3D visualization of the connections between Quranic Ayat.
- **Who it's for:** Muslims looking to explore the Quran's structure and connections.
- **Space/industry:** Islamic applications, data visualization.
- **Project type:** Web app / interactive visualization.

## Aesthetic Direction
- **Direction:** The Infinite Ink (Sea & Words) infused with Islamic Artifacts.
- **Decoration level:** Expressive (subtle textures, glowing nodes, fluid lines, geometric patterns).
- **Mood:** Deeply poetic, calming, premium, breathtaking, and awe-inspiring.
- **Reference sites:** Apple Store (for UI minimalism).

## Typography
- **Display/Hero:** Scheherazade New — Used for the Ayats themselves. Elegant, traditional, and highly legible. It carries the weight and beauty of the text.
- **UI/Labels:** Noto Sans Arabic — Used for interface elements, labels, and metadata. Clean, modern, and pairs well with the Latin UI font.
- **Body/Latin UI:** Inter — The interface recedes so the content can shine. Navigation, search, and controls use a clean sans-serif to maintain the "Apple-esque" minimalism.

## Color
- **Approach:** Restrained / Expressive (Deep Ocean blues with Golden Ink accents).
- **Primary (Deep Ocean):** `#050A15` — The deep, infinite sea background.
- **Surface Blue:** `#0A1224` — Used for UI panels, sidebars, and cards.
- **Golden Ink:** `#D4AF37` — Used for Ayat nodes, connections, and primary accents.
- **Text Primary:** `#F0F4F8` — High contrast text for readability.
- **Text Muted:** `#94A3B8` — Secondary text and metadata.
- **Dark mode:** The entire application is natively dark mode to support the "Infinite Ink" theme.

## Spacing
- **Base unit:** 8px
- **Density:** Spacious (to allow the 3D graph to breathe).
- **Scale:** xs(4px) sm(8px) md(16px) lg(32px) xl(64px)

## Layout
- **Approach:** Creative-editorial / Hybrid (Minimalist UI shell framing a full-bleed 3D canvas).
- **Border radius:** sm(4px) md(8px) lg(16px) full(9999px)

## Motion
- **Approach:** Fluid.
- **Details:** The 3D graph interactions should feel smooth and liquid-like. Nodes should pulse subtly, and connections should flow like ink threads.

## Poetic Visualization Mechanics (The Ink, The Sea, & The Artifacts)
- **The Environment (The Sea):** The background is not just a flat color, but a deep, volumetric ocean. It should have subtle, slow-moving volumetric light rays (like sunlight piercing deep water) and faint, floating particles resembling gold dust or suspended ink.
- **Surah Clusters (The Swirls & Artifacts):** Surahs are not just groups of nodes; they are breathtaking, slow-moving clusters or "currents" within the sea. Each Surah cluster is anchored by a subtle, glowing 3D Islamic geometric pattern (like an astrolabe or a Mishkah) that slowly rotates, acting as the gravitational center for the Ayat.
- **Ayat Nodes (The Drops):** Individual Ayat are depicted as radiant, 3D drops of golden ink. They are not flat spheres; they have a liquid, refractive quality. When focused or active, they ripple and diffuse golden light into the surrounding "water," emphasizing the idea of infinite, living words.
- **Connections (The Threads of Ink):** The links between Ayat are elegant, flowing threads of liquid gold that gracefully curve (Bezier curves) and dissolve into the sea. They should look like ink diffusing in water, representing the deep, fluid connections between meanings.
- **Interactions:** Hovering over a node causes the "ink" to glow brighter and the connections to pulse with light, like a heartbeat.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-16 | Initial design system created | Created by /design-consultation based on user's desire for an Apple-esque, premium Islamic aesthetic ("The Infinite Ink"). |
| 2026-05-16 | Enhanced Poetic Mechanics | Added explicit requirements for volumetric sea environments, Islamic geometric artifacts anchoring Surahs, and liquid/refractive qualities for the ink drops to ensure a breathtaking 3D experience. |
