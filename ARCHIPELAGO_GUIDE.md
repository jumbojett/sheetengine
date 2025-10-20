# Sky Archipelago World - Quick Start Guide

## 🎮 What You Can Do

### Player Movement
1. **Click anywhere on the terrain** to set a destination
2. A **golden circle** appears at the target location
3. Your character **walks and animates** toward it
4. Automatically faces the destination

### NPC Interaction
1. **Hover over NPCs** to see them highlighted in green
2. **Click an NPC** to swap positions with them
3. NPCs continuously patrol the archipelago
4. Each NPC has unique colors for identification

### Observation
- Watch NPCs autonomously move between islands
- Notice the layered elevation creating depth
- See how shadows and colors change with height
- Observe character animation during movement

## 🗺️ Map Overview

```
                 ┌─────────────────┐
                 │  North Platform │
                 │   (Viewing)     │
                 └─────────────────┘
                         △

    ┌──────────────┐     ┌──────────┐     ┌──────────────┐
    │  West Island │     │  Central │     │  East Island │
    │ (Agricult.)  │────▶│   Hub    │◀────│ (Research)   │
    │              │     │ (Tower)  │     │              │
    └──────────────┘     └──────────┘     └──────────────┘
                         │          │
                         │  Houses  │
                         │  Walls   │
                         └──────────┘
                                 ▼

                 ┌─────────────────┐
                 │ South Platform  │
                 │   (Docking)     │
                 └─────────────────┘
```

## 🏗️ Main Structures

### Central Island (Green - #4CAF50)
- **Red Tower**: 5 segments, 100 units tall with window details
- **4 Houses**: Pink, Blue, Green, Yellow with roofs
- **Perimeter Walls**: Brown defensive walls forming square

### West Island (Light Green - #8FBC8F)
- **Green Tower**: 3 segments for agriculture/research
- **House**: Tan/wheat colored

### East Island (Blue - #1E90FF)
- **Blue Tower**: 4 segments for research/observation
- **House**: Tomato red colored

### South Platform (Gold - #DAA520)
- **Docking House**: Tan colored for ship arrivals

### North Platform (Silver - #C0C0C0)
- **Viewing House**: Silver for observation

## 👥 Characters

| Character | Color | Start Location | Role |
|-----------|-------|-----------------|------|
| **Player** | Hot Pink (#FF1493) | Central (-100, -100) | Controlled by you |
| **NPC1** | Cyan (#00CED1) | Central (80, 80) | Patrols central & connections |
| **NPC2** | Lime Green (#32CD32) | West Island (-600, -300) | Patrols west routes |
| **NPC3** | Orange (#FF8C00) | East Island (600, -300) | Patrols east routes |

## 🎯 Waypoints

NPCs patrol between 6 strategic waypoints:
1. Central Hub (0, 0)
2. West Island (-600, -300)
3. East Island (600, -300)
4. South Platform (0, 500)
5. North Platform (0, -500)
6. West approach (-100, -100)

## 💡 Tips & Tricks

### Navigation
- **Large islands**: Take time to traverse - be patient
- **Multiple NPCs**: Each has independent patrol routes
- **Swapping**: Click NPCs to exchange positions for shortcuts

### Visual Cues
- **Green box**: NPC is highlighted, click to interact
- **Golden circle**: Your target location
- **Animated legs**: Character is currently moving
- **Color coding**: Each island has distinct colors

### Performance
- Smooth 30fps animation
- Quick scene calculation (only changed parts re-rendered)
- Handles 100+ sheets efficiently

## 🛠️ Customization Ideas

### Easy Modifications
1. Change colors in `createHouse()`, `createTower()`, `createIsland()`
2. Adjust island positions: modify coordinates in creation calls
3. Add new NPCs: duplicate NPC creation code with new positions
4. Change waypoints: edit the `waypoints` array

### Advanced Modifications
1. Add pathfinding around obstacles
2. Create different terrain types
3. Add day/night cycle with lighting
4. Implement quest system
5. Add collectible items
6. Create different house types

## 🎨 Color Palette

The example uses a harmonious color scheme:

```
Terrain:     #4CAF50 (Green)
             #8FBC8F (Light Green)
             #1E90FF (Blue)
             #DAA520 (Gold)
             #C0C0C0 (Silver)

Characters:  #FF1493 (Hot Pink)
             #00CED1 (Cyan)
             #32CD32 (Lime)
             #FF8C00 (Orange)

Elements:    #CD5C5C (Red Tower)
             #8B7355 (Brown Walls)
             #8B4513 (Wood/Windows)
             #FFD700 (Gold Accents)
```

## 📊 Statistics

- **Islands**: 5 floating landmasses
- **Elevation Levels**: 2 per island (creating depth)
- **Buildings**: 8+ houses and towers
- **Characters**: 4 (1 player + 3 NPCs)
- **Interaction Types**: 2 (terrain click + NPC click)
- **Frame Rate**: 30fps (33ms per frame)
- **Total Sheets**: 100+

## 🚀 What This Demonstrates

✅ Complex 3D environment generation
✅ Multi-level terrain with elevation
✅ Architecture and structure building
✅ Character animation systems
✅ AI and autonomous pathfinding
✅ User input handling (click + hover)
✅ Scene optimization and performance
✅ Dynamic rendering and updates
✅ Visual effects (markers, highlights)
✅ Game mechanics (movement, interaction)

## 🎓 Learning Resources

### For Understanding the Code:
1. Start with `createIslandBase()` - terrain generation
2. Look at `createTower()` and `createHouse()` - architecture
3. Study `createCharacter()` - character system
4. Follow `mainloop()` - game logic
5. Review event handlers - user interaction

### For Modifications:
1. Change colors: Find hex codes and modify them
2. Add structures: Copy and modify existing structure functions
3. Add NPCs: Duplicate NPC creation and add to arrays
4. Change waypoints: Edit `waypoints` array

## 🎉 Enjoy!

Explore the archipelago, interact with characters, and see how SheetEngine can create detailed, interactive 3D worlds!

---

**Pro Tip**: Open the browser console to see any messages and monitor performance. The scene recalculates efficiently, only updating changed sheets between frames.
