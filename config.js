// config.js

// --- Game Configuration & Constants ---
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const GROUND_Y_OFFSET = 50;
export const PLAYER_START_X = 100;
export const PLAYER_START_Y_OFFSET = 100;
export const JETPACK_FORCE_MULTIPLIER = 0.85;
export const MAX_FUEL = 150;
export const FUEL_RECHARGE_RATE = 0.4;
export const FUEL_CONSUMPTION_RATE = 1.0;
export const INITIAL_GAME_SPEED = 4;
export const MAX_GAME_SPEED = 20;
export const GAME_SPEED_INCREMENT = 0.0008;

export const POWERUP_DURATION = 8000;
export const WEAPON_SYSTEM_DURATION = 12000;
export const SPREAD_SHOT_DURATION = 10000;
export const RAPID_FIRE_DURATION = 7000;
export const SCORE_MULTIPLIER_DURATION = 10000;
export const COIN_MAGNET_DURATION = 10000;
export const SPEED_BURST_DURATION = 6000;

export const OBSTACLE_START_INTERVAL = 1400;
export const OBSTACLE_MIN_INTERVAL = 600;
export const OBSTACLE_INTERVAL_DECREMENT_FACTOR = 0.99;

export const POWERUP_REGULAR_INTERVAL = 3200;
export const POWERUP_REGULAR_MIN_INTERVAL = 1800;
export const POWERUP_BOSS_INTERVAL = 6000;
export const POWERUP_BOSS_MIN_INTERVAL = 3000;
export const POWERUP_INTERVAL_DECREMENT_FACTOR = 0.975;

export const ENEMY_START_INTERVAL = 4000;
export const ENEMY_MIN_INTERVAL = 2000;
export const ENEMY_INTERVAL_DECREMENT_FACTOR = 0.985;

export const BOSS_SPAWN_INTERVAL_MS = 60000;

// --- Scoreboard Constants ---
export const MAX_HIGH_SCORES = 5;
export const LOCAL_STORAGE_PLAYER_NAME_KEY = 'jetpackJumperPlayerName';

// --- Power-up Types Enum ---
export const POWERUP_TYPE = {
  COIN: "coin",
  FUEL_CELL: "fuel_cell",
  SHIELD: "shield",
  COIN_MAGNET: "coin_magnet",
  SPEED_BURST: "speed_burst",
  WEAPON_SYSTEM: "weapon_system",
  SPREAD_SHOT: "spread_shot",
  RAPID_FIRE: "rapid_fire",
  SCORE_MULTIPLIER: "score_multiplier",
};

// --- Colors ---
export let C_PLAYER,
  C_PLAYER_PROJECTILE,
  C_ENEMY_DRONE,
  C_ENEMY_INTERCEPTOR,
  C_ENEMY_TURRET,
  C_ENEMY_PROJECTILE;
export let C_OBSTACLE,
  C_GROUND_DETAIL,
  C_POWERUP_COIN,
  C_POWERUP_FUEL,
  C_POWERUP_SHIELD,
  C_POWERUP_WEAPON,
  C_POWERUP_SPREAD,
  C_POWERUP_RAPID,
  C_POWERUP_MULTIPLIER,
  C_POWERUP_MAGNET,
  C_POWERUP_SPEED;
export let C_BOSS_TANK,
  C_BOSS_SHIP,
  C_BOSS_FINAL,
  C_PARTICLE_JET,
  C_PARTICLE_EXPLOSION,
  C_PARTICLE_IMPACT,
  C_PARTICLE_EMBER;
export let C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG, C_SKY_TOP, C_SKY_BOTTOM;
export let C_DISTANT_PLANET1, C_DISTANT_PLANET2, C_NEBULA;
export let C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK;
export let C_PILLAR_DARK, C_PILLAR_LIGHT;
export let C_SKIN_TONE, C_MUSTACHE_COLOR;
export let C_BLOOD_RED;
export let C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE;
export let C_VICTORY_MAIN_TEXT, C_VICTORY_SUBTEXT; // New victory screen colors

// This function needs to be called once p5.js is initialized to define colors
export function defineColors(p5Instance) {
  C_PLAYER = p5Instance.color(75, 83, 32); // Olive Drab for uniform
  C_PLAYER_PROJECTILE = p5Instance.color(180, 160, 50); // Muted yellow/orange for tracer fire

  C_ENEMY_DRONE = p5Instance.color(255, 99, 71); // Tomato Red
  C_ENEMY_INTERCEPTOR = p5Instance.color(255, 69, 0); // OrangeRed
  C_ENEMY_TURRET = p5Instance.color(205, 92, 92); // IndianRed
  C_ENEMY_PROJECTILE = p5Instance.color(150, 60, 40); // Darker orange-red for enemy fire

  C_OBSTACLE = p5Instance.color(150, 160, 170); // Light grey for concrete/rubble
  C_GROUND_DETAIL = p5Instance.color(60, 50, 45); // Dark earthy brown for ground details

  C_POWERUP_COIN = p5Instance.color(184, 134, 11); // Darker gold
  C_POWERUP_FUEL = p5Instance.color(0, 100, 100); // Darker teal for fuel
  C_POWERUP_SHIELD = p5Instance.color(40, 120, 50); // Darker green for shield
  C_POWERUP_WEAPON = p5Instance.color(150, 150, 40); // Muted yellow for weapon
  C_POWERUP_SPREAD = p5Instance.color(150, 70, 0); // Muted orange for spread shot
  C_POWERUP_RAPID = p5Instance.color(255, 140, 0); // Darker orange for rapid fire
  C_POWERUP_MULTIPLIER = p5Instance.color(200, 100, 0); // Muted orange for score multiplier
  C_POWERUP_MAGNET = p5Instance.color(100, 100, 150); // Muted blue-grey for magnet
  C_POWERUP_SPEED = p5Instance.color(180, 120, 0); // Muted yellow-orange for speed

  C_BOSS_TANK = p5Instance.color(75, 83, 32); // Olive Drab like player
  C_BOSS_SHIP = p5Instance.color(60, 70, 75); // Dark grey like interceptor
  C_BOSS_FINAL = p5Instance.color(100, 90, 100); // Muted purple-grey for final boss

  C_PARTICLE_JET = p5Instance.color(180, 80, 0); // Darker orange-red for jet exhaust
  C_PARTICLE_EXPLOSION = [
    p5Instance.color(150, 40, 0), // Muted dark red
    p5Instance.color(120, 80, 0), // Muted dark orange
    p5Instance.color(100, 100, 20), // Muted dark yellow
    p5Instance.color(80, 80, 80), // Dark grey smoke
  ];
  C_PARTICLE_IMPACT = p5Instance.color(100, 100, 100, 180); // Dark grey smoke/dust on impact
  C_PARTICLE_EMBER = p5Instance.color(255, 100, 0, 150); // Glowing embers

  C_TEXT_MAIN = p5Instance.color(220); // Off-white
  C_TEXT_ACCENT = p5Instance.color(180, 160, 50); // Muted yellow/khaki
  C_TEXT_SCORE = p5Instance.color(200, 200, 100); // Light yellow for score
  C_HUD_BG = p5Instance.color(20, 20, 20, 180); // Very dark, semi-transparent HUD background

  C_SKY_OVERCAST = p5Instance.color(60, 70, 80); // Dark, stormy grey
  C_SKY_HORIZON = p5Instance.color(80, 90, 100); // Lighter, hazy grey-blue horizon
  C_BUILDING_DARK = p5Instance.color(35, 35, 35); // Very dark grey for distant buildings
  C_BUILDING_LIGHT = p5Instance.color(55, 50, 45); // Lighter brown-grey for distant buildings
  C_RUBBLE_DARK = p5Instance.color(45, 40, 35); // Dark brown-grey for rubble
  C_RUBBLE_LIGHT = p5Instance.color(65, 60, 55); // Lighter brown-grey for rubble
  C_SMOKE_EFFECT = p5Instance.color(70, 70, 70, 50); // Semi-transparent grey for smoke
  C_FIRE_GLOW_STRONG = p5Instance.color(255, 100, 0, 30); // Strong orange glow for fires
  C_FIRE_GLOW_WEAK = p5Instance.color(200, 150, 0, 20); // Weaker yellow glow for fires

  C_PILLAR_DARK = p5Instance.color(50, 55, 60); // Dark grey for pillars
  C_PILLAR_LIGHT = p5Instance.color(70, 75, 80); // Lighter grey for pillars

  C_SKIN_TONE = p5Instance.color(200, 160, 120); // Skin tone
  C_MUSTACHE_COLOR = p5Instance.color(30, 30, 30); // Mustache color
  C_BLOOD_RED = p5Instance.color(180, 30, 30); // Blood red for game over/damage

  C_BANNER_BG_RED = p5Instance.color(110, 0, 0); // Dark red for banner background
  C_BANNER_SYMBOL_BLACK = p5Instance.color(0); // Black for symbol
  C_BANNER_CIRCLE_WHITE = p5Instance.color(220); // Off-white for circle

  C_VICTORY_MAIN_TEXT = p5Instance.color(0, 200, 0); // Green for victory text
  C_VICTORY_SUBTEXT = p5Instance.color(240, 240, 240); // Off-white for victory subtext
}

// This function is to update the exported color variables after p5Instance.color() has been used.
// It's a bit of a workaround for ES6 module static nature.
export function updateExportedColors() {
    // This function doesn't need to do anything if defineColors directly assigns
    // to the exported let variables. The key is that defineColors is called with a p5 instance.
    // However, to be absolutely explicit that these are now set:
    // (This is more for conceptual clarity; the direct assignment in defineColors is what matters)
    return {
        C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE,
        C_OBSTACLE, C_GROUND_DETAIL, C_POWERUP_COIN, C_POWERUP_FUEL, C_POWERUP_SHIELD, C_POWERUP_WEAPON,
        C_POWERUP_SPREAD, C_POWERUP_RAPID, C_POWERUP_MULTIPLIER, C_POWERUP_MAGNET, C_POWERUP_SPEED,
        C_BOSS_TANK, C_BOSS_SHIP, C_BOSS_FINAL, C_PARTICLE_JET, C_PARTICLE_EXPLOSION, C_PARTICLE_IMPACT, C_PARTICLE_EMBER,
        C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG, C_SKY_TOP, C_SKY_BOTTOM,
        C_DISTANT_PLANET1, C_DISTANT_PLANET2, C_NEBULA,
        C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK,
        C_PILLAR_DARK, C_PILLAR_LIGHT,
        C_SKIN_TONE, C_MUSTACHE_COLOR,
        C_BLOOD_RED,
        C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE,
        C_VICTORY_MAIN_TEXT, C_VICTORY_SUBTEXT
    };
}
