// main.js (formerly jetpack_v2.js)

// --- Firebase SDK Imports (now using ES Module syntax) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Import game configuration and utility functions ---
import * as Config from './config.js';
import * as Utils from './utils.js';


// --- Game State Variables ---
let player;
let bgMusic;
let jumpSound;
let playerProjectileSound; // Renamed for clarity
let enemyProjectileSound; // Renamed for clarity
let objectDestroySound;
let playerProjectiles = []; // Fixed: Initialized as empty array
let enemyProjectiles = []; // Fixed: Initialized as empty array
let enemies = []; // Fixed: Initialized as empty array
let obstacles = []; // Fixed: Initialized as empty array
let powerups = []; // Fixed: Initialized as empty array
let particles = []; // Fixed: Initialized as empty array
let boss = null;
let bossApproaching = false;
let pendingBoss = null;

let activePowerups = {};
let score = 0;
let highScores = []; // Fixed: Initialized as empty array
let highScore = 0; // This will now be the highest score loaded from Firestore

let coinsCollectedThisRun = 0;
let scoreMultiplier = 1; // Added for score multiplier power-up

let jetpackFuel = Config.MAX_FUEL;
let gameSpeed = Config.INITIAL_GAME_SPEED;
let baseGameSpeed = Config.INITIAL_GAME_SPEED; // Base speed, affected by speed burst
let playerIsFlying = false;
let playerCanShoot = true; // Added for manual shooting cooldown
let playerShootCooldown = 0;
const PLAYER_SHOOT_COOLDOWN_TIME = 300; // Cooldown for manual shooting

window.currentScreen = "START"; // Manages which screen is displayed
let gamePaused = false;

let lastObstacleTime = 0;
let lastPowerupTime = 0;
let lastEnemySpawnTime = 0;
let enemySpawnInterval = Config.ENEMY_START_INTERVAL;
let obstacleInterval = Config.OBSTACLE_START_INTERVAL;
let powerupInterval = Config.POWERUP_REGULAR_INTERVAL;

let weaponSystemActive = false;
let weaponSystemTimeLeft = 0; // Renamed for clarity
let currentWeaponMode = "STANDARD"; // 'STANDARD', 'SPREAD'
let weaponSystemShootTimer = 0; // Timer for weapon system auto-fire

let distanceTraveled = 0;
let bossCount = 0; // Tracks unique bosses defeated (0, 1, 2)
let bossCycleDefeats = 0; // New: Tracks total bosses defeated (for difficulty scaling in post-win mode)
let timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS; // New: Timer for boss spawning

let gameStartTime = 0; // To track elapsed game time
let gameElapsedTime = 0;

let temporaryWinMessageActive = false; // New: Flag for temporary win message
let temporaryWinMessageTimer = 0; // New: Timer for temporary win message
const TEMPORARY_WIN_MESSAGE_DURATION_MS = 3000; // 3 seconds

let postWinModeActive = false; // New: Flag for continuous play after 3 bosses

// --- Player Name Variable ---
window.playerName = "Player"; // Default player name, exposed to window

// --- Flag for Scoreboard Display ---
let scoreboardDisplayedAfterGameOver = false;

// --- Firebase Variables (Moved to global scope) ---
let db;
let auth;
let userId = "anonymous"; // Default anonymous user ID
let isAuthReady = false; // Flag to ensure Firebase auth is ready before Firestore operations

// --- Firebase Configuration (Moved to global scope) ---
// IMPORTANT: Replace these placeholder values with your actual Firebase project settings.
// You can find these in your Firebase Console under Project settings > Your apps.
const DEFAULT_APP_ID = "my-jetpack-jumper-local"; // A unique identifier for your app/game (can be anything)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkQJHGHZapGD8sKggskwz4kkQRwmr_Kh0",
  authDomain: "jetpack-7ced6.firebaseapp.com",
  projectId: "jetpack-7ced6",
  storageBucket: "jetpack-7ced6.firebaseapp.com",
  appId: "1:34167115128:web:f31520e4bbb37f564e4c8d",
  measurementId: "G-YCEJP443C4"
};

// Determine which config to use: provided by environment or default
// Robustly parse __firebase_config only if it's defined and not an empty string
const appId = typeof __app_id !== 'undefined' ? __app_id : DEFAULT_APP_ID;
const firebaseConfig = (typeof __firebase_config !== 'undefined' && __firebase_config && __firebase_config !== '') ? JSON.parse(__firebase_config) : DEFAULT_FIREBASE_CONFIG;


// --- Power-up Types Enum ---
const POWERUP_TYPE = Config.POWERUP_TYPE;

// --- Colors (imported from Config) ---
let C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE,
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
  C_VICTORY_MAIN_TEXT, C_VICTORY_SUBTEXT;

// Global function for drawing faux banner (moved to Utils)
// function drawFauxBanner(x, y, w, h) { ... }


// Assign preload to the window object for p5.js to find it
window.preload = function() {
  bgMusic = loadSound('assets/background_music.mp3');
  jumpSound = loadSound('assets/jump.mp3');
  playerProjectileSound = loadSound('assets/player_projectile.mp3'); // Renamed for clarity
  enemyProjectileSound = loadSound('assets/projectile.mp3'); // Renamed for clarity
  objectDestroySound = loadSound('assets/object_destroy.mp3');

  bgMusic.setVolume(0.4);
  bgMusic.setLoop(true);
  jumpSound.setVolume(0.7);
  playerProjectileSound.setVolume(0.6);
  enemyProjectileSound.setVolume(0.6);
  objectDestroySound.setVolume(0.9);
  jumpSound.setLoop(false);
  playerProjectileSound.setLoop(false);
  enemyProjectileSound.setLoop(false);
  objectDestroySound.setLoop(false);
}

// --- Background Element Class ---
class BackgroundElement {
    constructor(x, y, w, h, type, speedFactor, color1, color2 = null) {
        this.initialX = x;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.speedFactor = speedFactor;
        this.color1 = color1;
        this.color2 = color2 || color1; // Fixed: Use || for default assignment
        this.noiseOffsetX = random(1000);
        this.noiseOffsetY = random(1000);
        this.bannerSeed = random(100);

        this.wreckRotation = random(-0.15, 0.15);
        this.emberTime = 0;
    }

    update() {
        this.x -= gameSpeed * this.speedFactor * (deltaTime / (1000 / 60));

        if (this.x + this.w < -100) {
            this.x = Config.SCREEN_WIDTH + random(100, 300);
            this.bannerSeed = random(100);
            this.noiseOffsetX = random(1000);
            this.noiseOffsetY = random(1000);

            if (this.type === 'building') {
                this.h = random(Config.SCREEN_HEIGHT * 0.4, Config.SCREEN_HEIGHT * 0.7); // Tighter range
                this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
                this.w = random(80, 160); // Tighter range
            } else if (this.type === 'pillar') {
                this.h = random(Config.SCREEN_HEIGHT * 0.25, Config.SCREEN_HEIGHT * 0.55);
                this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
                this.w = random(25, 55);
            } else if (this.type === 'rubble') {
                this.h = random(15, 45);
                this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
                this.w = random(40, 90);
            } else if (this.type === 'static_wreck') {
                this.w = random(70, 110);
                this.h = random(35, 55);
                this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h + random(0,10);
                this.wreckRotation = random(-0.1, 0.1);
            } else if (this.type === 'banner_pole') {
                this.w = random(40, 60);
                this.h = random(60, 100);
                this.y = random(Config.SCREEN_HEIGHT * 0.1, Config.SCREEN_HEIGHT * 0.3);
            }
        }
    }

    show() {
        noStroke();
        if (this.type === 'building') {
            fill(this.color1);
            rect(this.x, this.y, this.w, this.h);

            fill(this.color1);
            beginShape();
            vertex(this.x, this.y);
            for (let i = 0; i <= 10; i++) {
                let stepX = this.x + (this.w / 10) * i;
                let stepY = this.y - noise(this.noiseOffsetX + i * 0.3) * this.h * 0.18;
                vertex(stepX, stepY);
            }
            vertex(this.x + this.w, this.y);
            vertex(this.x + this.w, this.y + random(5,15));
            vertex(this.x, this.y + random(5,15));
            endShape(CLOSE);

            fill(this.color2);
            for (let i = 0; i < random(2, 6); i++) {
                let spotX = this.x + random(this.w * 0.1, this.w * 0.8);
                let spotY = this.y + random(this.h * 0.1, this.h * 0.8);
                let spotW = random(this.w * 0.15, this.w * 0.35);
                let spotH = random(this.h * 0.1, this.h * 0.25);
                rect(spotX, spotY, spotW, spotH);

                stroke(Config.C_PILLAR_DARK);
                strokeWeight(random(1,2));
                if(random() < 0.6) line(spotX + random(spotW*0.2), spotY + random(spotH*0.2), spotX + spotW - random(spotW*0.2), spotY + spotH - random(spotH*0.2));
                if(random() < 0.4) line(spotX + spotW - random(spotW*0.2), spotY + random(spotH*0.2), spotX + random(spotW*0.2), spotY + spotH - random(spotH*0.2));
                noStroke();
            }

            if (noise(this.noiseOffsetX + 100) < 0.4) {
                let glowX = this.x + this.w / 2;
                let glowY = this.y - random(5,25);
                let flicker = noise(this.noiseOffsetY + frameCount * 0.05);
                fill(Config.C_FIRE_GLOW_STRONG.levels[0], Config.C_FIRE_GLOW_STRONG.levels[1], Config.C_FIRE_GLOW_STRONG.levels[2], 30 + flicker * 80); // Fixed: Access color levels
                ellipse(glowX, glowY, this.w * (0.4 + flicker * 0.25), this.h * (0.15 + flicker * 0.15));
            }

            if (noise(this.bannerSeed) < 0.3) {
                let bannerW = this.w * 0.25;
                let bannerH = this.h * 0.4;
                let bannerX = this.x + this.w * 0.1 + noise(this.bannerSeed + 10) * (this.w * 0.5 - bannerW);
                let bannerY = this.y + this.h * 0.1 + noise(this.bannerSeed + 20) * (this.h * 0.4 - bannerH);

                bannerW = max(20, bannerW);
                bannerH = max(30, bannerH);

                Utils.drawFauxBanner(bannerX, bannerY, bannerW, bannerH); // Use Utils.drawFauxBanner
            }

        } else if (this.type === 'pillar') {
            fill(this.color1);
            rect(this.x, this.y, this.w, this.h, 2);
            fill(this.color2);
            stroke(this.color2);
            strokeWeight(1.5);
            line(this.x + this.w * 0.3, this.y + this.h * 0.2, this.x + this.w * 0.7, this.y + this.h * 0.4);
            line(this.x + this.w * 0.2, this.y + this.h * 0.8, this.x + this.w * 0.8, this.y + this.h * 0.7);
            noStroke();
            for (let i = 0; i < random(1, 3); i++) {
                rect(this.x, this.y + this.h * (0.2 + i * 0.25), this.w, random(3, 6), 1);
            }
        } else if (this.type === 'rubble') {
            fill(this.color1);
            for(let i=0; i< random(2,4); i++){
                beginShape();
                vertex(this.x + random(-5,5), this.y + this.h + random(-3,3));
                vertex(this.x + this.w * 0.2 + random(-5,5), this.y + random(-5,5) + this.h*0.5);
                vertex(this.x + this.w * 0.5 + random(-5,5), this.y + random(-5,5));
                vertex(this.x + this.w * 0.8 + random(-5,5), this.y + random(-5,5) + this.h*0.5);
                vertex(this.x + this.w + random(-5,5), this.y + this.h + random(-3,3));
                endShape(CLOSE);
            }
            fill(this.color2);
             for(let i=0; i<random(1,3); i++){
                rect(this.x + random(this.w*0.1, this.w*0.3), this.y + random(this.h*0.3, this.h*0.5), random(this.w*0.2, this.w*0.5), random(this.h*0.2, this.h*0.4), 1);
            }
            if (noise(this.noiseOffsetX + frameCount * 0.02) < 0.3) {
                fill(Config.C_SMOKE_EFFECT.levels[0], Config.C_SMOKE_EFFECT.levels[1], Config.C_SMOKE_EFFECT.levels[2], 20 + noise(this.noiseOffsetY + frameCount * 0.03) * 30); // Fixed: Access color levels
                ellipse(this.x + this.w/2 + random(-5,5), this.y - random(5,10), random(10,20), random(15,25));
            }
            this.emberTime += deltaTime;
            if (this.emberTime > 100) {
                this.emberTime = 0;
                if (random() < 0.2) {
                    let emberX = this.x + random(this.w);
                    let emberY = this.y + random(this.h * 0.5, this.h);
                    let emberSize = random(2, 5);
                    let emberAlpha = 100 + noise(this.noiseOffsetX + frameCount * 0.1) * 155;
                    fill(Config.C_PARTICLE_EMBER.levels[0], Config.C_PARTICLE_EMBER.levels[1], Config.C_PARTICLE_EMBER.levels[2], emberAlpha); // Fixed: Access color levels
                    ellipse(emberX, emberY, emberSize, emberSize);
                }
            }

        } else if (this.type === 'static_wreck') {
            push();
            translate(this.x + this.w / 2, this.y + this.h / 2);
            rotate(this.wreckRotation);
            let tankColor = random() < 0.5 ? Config.C_ENEMY_DRONE : Config.C_BOSS_TANK;
            fill(tankColor);
            noStroke();

            rect(-this.w / 2, -this.h / 2 + this.h * 0.1, this.w, this.h * 0.7, 2);
            rect(-this.w * 0.25, -this.h / 2 - this.h * 0.2, this.w * 0.5, this.h * 0.4, 1);
            rect(0, -this.h / 2 - this.h * 0.1, this.w * 0.55, this.h * 0.15, 1);

            fill(lerpColor(tankColor, color(0), 0.3));
            rect(-this.w/2, this.h/2 - this.h*0.2, this.w, this.h*0.25, 2);
            for(let i = -this.w/2 + this.w*0.1; i < this.w/2 - this.w*0.1; i += this.w*0.25){
                 ellipse(i, this.h/2 - this.h*0.075, this.w*0.15, this.w*0.15);
            }
            pop();
        } else if (this.type === 'banner_pole') {
            fill(Config.C_PILLAR_DARK);
            rect(this.x - 3, this.y - 10, 6, this.h + 20, 1);
            Utils.drawFauxBanner(this.x, this.y, this.w, this.h); // Use Utils.drawFauxBanner
        }
    }
}


let backgroundElements = []; // Fixed: Initialized as empty array
let smokeParticles = []; // Fixed: Initialized as empty array
let bgOffset1 = 0;

// New global variables for post-win mode
let bossCycleDefeats = 0; // Total bosses defeated across all cycles
let temporaryWinMessageActive = false;
let temporaryWinMessageTimer = 0;
const TEMPORARY_WIN_MESSAGE_DURATION_MS = 3000; // 3 seconds


window.setup = function() {
  console.log("p5.js setup() called!");
  let canvas = createCanvas(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
  canvas.parent('game-container');
  pixelDensity(1);
  Config.defineColors(this); // Pass p5 instance to defineColors
  Config.updateExportedColors(); // Update exported colors
  // Assign global colors from Config
  ({ C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE,
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
    C_VICTORY_MAIN_TEXT, C_VICTORY_SUBTEXT } = Config);

  textFont('Oswald');
  noiseSeed(Date.now());
  resetGame();
  window.currentScreen = "START";

  // Set the CSS variable for max-width of in-game controls
  document.documentElement.style.setProperty('--canvas-max-width', `${Config.SCREEN_WIDTH}px`);

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        console.log("Firebase: User signed in with UID:", userId);
      } else {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
          if (auth.currentUser) {
            userId = auth.currentUser.uid;
            console.log("Firebase: Signed in. UID:", userId);
          } else {
            console.error("Firebase: auth.currentUser is null after sign-in attempts.");
            userId = crypto.randomUUID();
            console.warn("Firebase: Falling back to random UUID for userId:", userId);
          }
        } catch (error) {
          console.error("Firebase: Authentication failed:", error);
          userId = crypto.randomUUID();
          console.warn("Firebase: Falling back to random UUID for userId:", userId);
        }
      }
      isAuthReady = true;
      if (typeof window.loadHighScores === 'function') window.loadHighScores();
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName();

      if (typeof window.showNameInput === 'function') {
          window.showNameInput(true);
      } else {
          console.error("DEBUG: window.showNameInput is not defined!");
      }
    });
  } catch (e) {
      console.error("Firebase initialization error:", e);
      isAuthReady = false;
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName();
       if (typeof window.showNameInput === 'function') window.showNameInput(true);
  }


  if (bgMusic && bgMusic.isLoaded()) {
    bgMusic.loop();
  } else if (bgMusic) {
    bgMusic.onended(() => { if(window.currentScreen === "GAME") bgMusic.loop(); });
  }
}


window.resetGameValues = function() {
  console.log("resetGameValues called!");
  player = new Player();
  playerProjectiles = []; // Fixed: Initialized as empty array
  enemyProjectiles = []; // Fixed: Initialized as empty array
  obstacles = []; // Fixed: Initialized as empty array
  powerups = []; // Fixed: Initialized as empty array
  particles = []; // Fixed: Initialized as empty array
  enemies = []; // Fixed: Initialized as empty array
  boss = null;
  bossApproaching = false;
  pendingBoss = null;

  weaponSystemActive = false;
  currentWeaponMode = "STANDARD";
  weaponSystemShootTimer = 0; // Reset weapon system timer
  activePowerups = {};
  scoreMultiplier = 1;

  jetpackFuel = Config.MAX_FUEL;
  gameSpeed = Config.INITIAL_GAME_SPEED;
  baseGameSpeed = Config.INITIAL_GAME_SPEED;
  score = 0;
  coinsCollectedThisRun = 0;
  distanceTraveled = 0;
  bossCount = 0; // Reset unique boss count
  bossCycleDefeats = 0; // Reset total boss defeats
  postWinModeActive = false; // Reset post-win mode
  temporaryWinMessageActive = false; // Reset temporary win message

  if(player) player.shieldCharges = 0; // Ensure shield charges are reset

  timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS; // Reset boss timer
  obstacleInterval = Config.OBSTACLE_START_INTERVAL;
  powerupInterval = Config.POWERUP_REGULAR_INTERVAL;
  enemySpawnInterval = Config.ENEMY_START_INTERVAL;

  gameStartTime = millis();
  gameElapsedTime = 0;

  scoreboardDisplayedAfterGameOver = false;

  backgroundElements = []; // Fixed: Initialized as empty array
  smokeParticles = []; // Fixed: Initialized as empty array
  bgOffset1 = 0;

  for (let i = 0; i < 6; i++) {
      let bX = random(Config.SCREEN_WIDTH * 0.1, Config.SCREEN_WIDTH * 1.8) + i * (Config.SCREEN_WIDTH / 3.5);
      let bH = random(Config.SCREEN_HEIGHT * 0.4, Config.SCREEN_HEIGHT * 0.7); // Use tighter range
      let bY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - bH;
      let bW = random(80, 160); // Use tighter range
      backgroundElements.push(new BackgroundElement(bX, bY, bW, bH, 'building', 0.15, C_BUILDING_DARK, C_BUILDING_LIGHT));
  }

  for (let i = 0; i < 8; i++) {
      let pX = random(Config.SCREEN_WIDTH * 0.1, Config.SCREEN_WIDTH * 1.5) + i * (Config.SCREEN_WIDTH / 4);
      let pH = random(Config.SCREEN_HEIGHT * 0.25, Config.SCREEN_HEIGHT * 0.55);
      let pY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - pH;
      let pW = random(25, 55);
      backgroundElements.push(new BackgroundElement(pX, pY, pW, pH, 'pillar', 0.3, C_PILLAR_DARK, C_PILLAR_LIGHT));
  }

  for (let i = 0; i < 4; i++) {
      let wX = random(Config.SCREEN_WIDTH * 0.2, Config.SCREEN_WIDTH * 1.8) + i * (Config.SCREEN_WIDTH / 2);
      let wW = random(70, 110);
      let wH = random(35, 55);
      let wY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - wH + random(0,10);
      backgroundElements.push(new BackgroundElement(wX, wY, wW, wH, 'static_wreck', 0.35, C_ENEMY_DRONE));
  }

  for (let i = 0; i < 20; i++) {
      let rX = random(Config.SCREEN_WIDTH * 0.05, Config.SCREEN_WIDTH * 1.2) + i * (Config.SCREEN_WIDTH / 6);
      let rH = random(15, 45);
      let rY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - rH;
      let rW = random(40, 90);
      backgroundElements.push(new BackgroundElement(rX, rY, rW, rH, 'rubble', 0.5, C_RUBBLE_DARK, C_RUBBLE_LIGHT));
  }

  for (let i = 0; i < 2; i++) {
      let bannerX = random(Config.SCREEN_WIDTH * 0.5, Config.SCREEN_WIDTH * 2.0) + i * (Config.SCREEN_WIDTH / 1.5);
      let bannerActualH = random(60,100);
      let bannerClothY = random(Config.SCREEN_HEIGHT*0.15, Config.SCREEN_HEIGHT*0.4);
      let bannerW = random(40, 60);
      backgroundElements.push(new BackgroundElement(bannerX, bannerClothY, bannerW, bannerActualH, 'banner_pole', 0.25, C_PILLAR_DARK));
  }

  for (let i = 0; i < 15; i++) {
    smokeParticles.push(new Particle(
        random(Config.SCREEN_WIDTH), random(Config.SCREEN_HEIGHT * 0.05, Config.SCREEN_HEIGHT * 0.4), // Spawn higher for atmospheric
        C_SMOKE_EFFECT, random(70, 160), random(12000, 20000),
        createVector(random(-0.1, 0.1) * gameSpeed * 0.05, random(-0.08, -0.2)),
        0.995, 'ellipse'
    ));
  }
  backgroundElements.sort((a, b) => a.speedFactor - b.speedFactor);
}

function resetGame() {
  resetGameValues();
}

window.setPlayerFlyingState = function(isFlying) {
    // Only allow flying if there is fuel
    if (isFlying && jetpackFuel > 0) {
        playerIsFlying = true;
    } else {
        playerIsFlying = false;
    }
};

window.triggerJumpSound = function() {
    // Only play jump sound if there is fuel
    if (jumpSound && jumpSound.isLoaded() && jetpackFuel > 0) {
        jumpSound.rate(random(0.9, 1.1));
        jumpSound.play();
    }
};

window.stopPlayerFlying = function() {
    playerIsFlying = false;
};

window.triggerPlayerShoot = function() {
    if (window.currentScreen === "GAME" && playerCanShoot && player) {
        if (currentWeaponMode === "SPREAD") {
            for (let i = -1; i <= 1; i++) {
                playerProjectiles.push(
                    new PlayerProjectile(
                        player.x + player.w,
                        player.y + player.h / 2,
                        i * 0.2
                    )
                );
            }
        } else {
            playerProjectiles.push(
                new PlayerProjectile(player.x + player.w, player.y + player.h / 2)
            );
        }
        // Fixed: Check for specific powerup type
        playerShootCooldown = activePowerups[POWERUP_TYPE.RAPID_FIRE] ? PLAYER_SHOOT_COOLDOWN_TIME * 0.4 : PLAYER_SHOOT_COOLDOWN_TIME;
        playerCanShoot = false;
    }
};


window.loadHighScores = function() {
    if (!isAuthReady || !db) {
        console.log("Firestore not ready, delaying loadHighScores.");
        return;
    }
    console.log("loadHighScores called. Current userId:", userId);

    const highScoresCollectionRef = collection(db, `/artifacts/${appId}/public/data/highScores`);
    const q = query(highScoresCollectionRef, limit(100));

    onSnapshot(q, (snapshot) => {
        console.log("Firestore: onSnapshot triggered for high scores. Number of documents:", snapshot.size);
        const fetchedScores = []; // Fixed: Initialized as empty array
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.score !== undefined && data.name && data.userId) {
                fetchedScores.push(data);
            }
        });

        const uniqueUserHighScores = new Map();
        fetchedScores.forEach(entry => {
            const currentHighest = uniqueUserHighScores.get(entry.userId);
            if (!currentHighest || entry.score > currentHighest.score) { // Fixed: Use || for logical OR
                uniqueUserHighScores.set(entry.userId, entry);
            }
        });

        let filteredScores = Array.from(uniqueUserHighScores.values());
        filteredScores.sort((a, b) => b.score - a.score);
        highScores = filteredScores.slice(0, Config.MAX_HIGH_SCORES); // Use Config.MAX_HIGH_SCORES

        highScore = highScores.length > 0 ? highScores[0].score : 0; // Fixed: Access first element

        console.log("Firestore: High scores updated:", highScores);
        if (typeof window.displayHighScores === 'function') {
            window.displayHighScores();
        }
    }, (error) => {
        console.error("Error fetching high scores from Firestore:", error);
    });
};

window.saveHighScore = async function(newScore) {
    if (!isAuthReady || !db || !userId || userId === "anonymous" || userId.startsWith("anonymous_fallback")) { // Fixed: Use || for logical OR
        console.warn("Firestore not ready or user not properly authenticated, cannot save high score. UserID:", userId);
        return;
    }

    if (typeof newScore !== 'number' || newScore <= 0) { // Fixed: Use || for logical OR
        console.warn("Attempted to save invalid score:", newScore);
        return;
    }

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
        const docRef = await addDoc(collection(db, `/artifacts/${appId}/public/data/highScores`), {
            name: window.playerName,
            score: newScore,
            date: formattedDate,
            userId: userId,
            timestamp: serverTimestamp()
        });
        console.log("Firestore: Document written with ID: ", docRef.id, "Score:", newScore, "Player:", window.playerName, "UID:", userId);
    } catch (e) {
        console.error("Firestore: Error adding document: ", e);
    }
};

window.displayHighScores = function() {
    console.log("displayHighScores called!");
    const highScoresList = document.getElementById('highScoresList');
    if (!highScoresList) {
        console.warn("highScoresList element not found.");
        return;
    }
    highScoresList.innerHTML = '';

    if (highScores.length === 0) {
        highScoresList.innerHTML = '<li>No combat records yet, Soldier!</li>';
        return;
    }

    highScores.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="rank">${index + 1}.</span> <span class="player-name">${entry.name || 'Unknown Pilot'}:</span> <span class="score-value">${entry.score}</span> <span class="score-date">(${(entry.date || 'N/A')})</span>`; // Fixed: Use || for default assignment
        highScoresList.appendChild(listItem);
    });
};

window.loadPlayerName = function() {
    const storedName = localStorage.getItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY); // Use Config.LOCAL_STORAGE_PLAYER_NAME_KEY
    if (storedName) {
        window.playerName = storedName;
    } else {
        window.playerName = "Recruit";
    }
    console.log("Loaded player name:", window.playerName);
};

window.savePlayerName = function(name) {
    if (name && name.trim().length > 0) {
        window.playerName = name.trim();
        localStorage.setItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY, window.playerName); // Use Config.LOCAL_STORAGE_PLAYER_NAME_KEY
        console.log("Player name saved:", window.playerName);
    } else {
        console.log("Attempted to save empty name, keeping current name:", window.playerName);
    }
};

window.deletePlayerName = function() {
    localStorage.removeItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY); // Use Config.LOCAL_STORAGE_PLAYER_NAME_KEY
    window.playerName = "Recruit";
    console.log("Player name deleted. Reset to:", window.playerName);
    const nameInputField = document.getElementById('nameInputField');
    if (nameInputField) nameInputField.value = window.playerName;
};


class Player {
  constructor() {
    this.w = 30; // Smaller player width
    this.h = 40; // Smaller player height
    this.x = Config.PLAYER_START_X;
    this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - Config.PLAYER_START_Y_OFFSET;
    this.vy = 0;
    this.gravity = 0.55;
    this.lift = -10.5 * Config.JETPACK_FORCE_MULTIPLIER;
    this.onGround = false;

    this.headRadiusX = (this.w * 0.8) / 2;
    this.headRadiusY = (this.h * 0.7) / 2;
    this.headOffsetY = -this.h * 0.2;
    this.shieldCharges = 0;
  }

  update() {
    // Only allow flying if there is fuel
    if (playerIsFlying && jetpackFuel > 0) {
        jetpackFuel -= Config.FUEL_CONSUMPTION_RATE * (deltaTime / (1000/60));
        if (jetpackFuel <= 0) {
            jetpackFuel = 0;
            playerIsFlying = false; // Stop flying if fuel runs out
        }
        this.vy = this.lift;
        this.onGround = false;
        if (frameCount % 3 === 0) {
            particles.push(
                new Particle(
                    this.x + this.w * 0.2,
                    this.y + this.h * 0.9,
                    Config.C_PARTICLE_JET,
                    random(6, 12),
                    random(15 * (1000/60), 25 * (1000/60)),
                    createVector(random(-0.5, 0.5), random(1, 3)),
                    0.95
                )
            );
        }
    } else {
      if (this.onGround) {
        jetpackFuel = min(Config.MAX_FUEL, jetpackFuel + Config.FUEL_RECHARGE_RATE * (deltaTime / (1000/60)));
      }
    }

    if (!playerIsFlying || jetpackFuel <= 0) { // Fixed: Use || for logical OR
      this.vy += this.gravity * (deltaTime / (1000/60));
    }

    this.y += this.vy * (deltaTime / (1000/60));

    let groundLevel = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
    if (this.y >= groundLevel) {
      this.y = groundLevel;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.2;
    }
  }

   show() {
    stroke(20, 30, 40);
    strokeWeight(2);

    fill(C_PLAYER);
    rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.8, 3);

    beginShape();
    vertex(this.x + this.w * 0.1, this.y + this.h * 0.2);
    vertex(this.x + this.w * 0.9, this.y + this.h * 0.2);
    vertex(this.x + this.w, this.y + this.h * 0.4);
    vertex(this.x + this.w * 0.5, this.y + this.h * 0.55);
    vertex(this.x, this.y + this.h * 0.4);
    endShape(CLOSE);

    fill(C_SKIN_TONE);
    // Adjusted head position and size based on new player dimensions
    ellipse(this.x + this.w / 2, this.y + this.h * 0.15, this.w * 0.7, this.h * 0.4);

    fill(C_PLAYER.levels[0] - 10, C_PLAYER.levels[1] - 10, C_PLAYER.levels[2] - 10); // Fixed: Access color levels
    // Adjusted helmet position and size
    rect(this.x + this.w * 0.1, this.y, this.w * 0.8, this.h * 0.2, 3);
    beginShape();
    vertex(this.x + this.w * 0.1, this.y + this.h * 0.1);
    vertex(this.x + this.w * 0.9, this.y + this.h * 0.1);
    vertex(this.x + this.w * 0.8, this.y + this.h * 0.25);
    vertex(this.x + this.w * 0.2, this.y + this.h * 0.25);
    endShape(CLOSE);

    fill(C_MUSTACHE_COLOR);
    ellipse(this.x + this.w / 2, this.y + this.h * 0.25, 4, 3);


    fill(40, 45, 50);
    rect(this.x - 12, this.y + this.h * 0.05, 15, this.h * 0.9, 5);
    stroke(C_OBSTACLE);
    strokeWeight(1);
    line(this.x - 12, this.y + this.h * 0.3, this.x + 3, this.y + this.h * 0.3);
    line(this.x - 12, this.y + this.h * 0.7, this.x + 3, this.y + this.h * 0.7);
    fill(60, 70, 80);
    ellipse(this.x - 4, this.y + this.h * 0.2, 10, 10);
    ellipse(this.x - 4, this.y + this.h * 0.8, 10, 10);
    noStroke();


    fill(30, 35, 40);
    rect(this.x + this.w - 5, this.y + this.h * 0.6, 35, 8, 2);
    rect(this.x + this.w + 10, this.y + this.h * 0.6 + 8, 10, 5, 2);
    fill(80, 50, 30);
    rect(this.x + this.w - 10, this.y + this.h * 0.6 - 10, 10, 15, 2);


    noStroke();

    const auraCenterX = this.x + this.w / 2;
    const playerVisualTopY = this.y; // Top of helmet
    const playerVisualBottomY = this.y + this.h; // Bottom of body
    const playerVisualHeight = playerVisualBottomY - playerVisualTopY;
    const auraCenterY = playerVisualTopY + playerVisualHeight / 2;

    const auraDiameterX = this.w * 2.2;
    const auraDiameterY = playerVisualHeight * 1.5;

    if (weaponSystemActive) {
      let weaponColor = currentWeaponMode === "SPREAD" ? C_POWERUP_SPREAD : color(150, 180, 255, 100);
      fill( weaponColor.levels[0], weaponColor.levels[1], weaponColor.levels[2], 60 + sin(frameCount * 0.2) * 20 ); // Fixed: Access color levels
      ellipse( auraCenterX, auraCenterY, auraDiameterX, auraDiameterY );
    }

    if (this.shieldCharges > 0) {
      fill( C_POWERUP_SHIELD.levels[0], C_POWERUP_SHIELD.levels[1], C_POWERUP_SHIELD.levels[2], 80 + sin(frameCount * 0.15) * 40 ); // Fixed: Access color levels
      ellipse( auraCenterX, auraCenterY, auraDiameterX * 1.05, auraDiameterY * 1.05 );
    }
  }

  hits(obj) {
    // Adjusted hitbox to new player dimensions
    const playerHitboxX = this.x;
    const playerHitboxY = this.y;
    const playerHitboxW = this.w;
    const playerHitboxH = this.h;

    return Utils.collideRectRect( // Use Utils.collideRectRect
      playerHitboxX, playerHitboxY, playerHitboxW, playerHitboxH,
      obj.x, obj.y, obj.w, obj.h
    );
  }
}
class PlayerProjectile {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 4;
    this.baseSpeed = 15 + gameSpeed * 1.2;
    this.vx = cos(angle) * this.baseSpeed;
    this.vy = sin(angle) * this.baseSpeed;
    this.color = C_PLAYER_PROJECTILE;
    this.damage = 10;
    this.angle = angle;

    if (playerProjectileSound && playerProjectileSound.isLoaded()) {
      playerProjectileSound.rate(random(0.9, 1.1));
      playerProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60));
    this.y += this.vy * (deltaTime / (1000/60));
  }
  show() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);

    fill(this.color);
    noStroke();
    rect(0, -this.h / 2, this.w, this.h, 1);
    triangle(this.w, -this.h / 2, this.w, this.h / 2, this.w + 5, 0);

    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 100); // Fixed: Access color levels
    rect(-5, -this.h / 2, 5, this.h);

    pop();
  }
  offscreen() {
    return ( this.x > width + this.w || this.x < -this.w || this.y < -this.h || this.y > height + this.h ); // Fixed: Use || for logical OR
  }
  hits(target) {
    return Utils.collideRectRect( this.x, this.y - this.h / 2, this.w, this.h, target.x, target.y, target.w, target.h ); // Use Utils.collideRectRect
  }
}

class EnemyProjectile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.r = 6;
    this.speed = 2.5 + gameSpeed * 0.55;
    this.vx = cos(angle) * this.speed;
    this.vy = sin(angle) * this.speed;
    this.color = C_ENEMY_PROJECTILE;
    this.rotation = random(TWO_PI);

    if (enemyProjectileSound && enemyProjectileSound.isLoaded()) {
      enemyProjectileSound.rate(random(0.9, 1.1));
      enemyProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60));
    this.y += this.vy * (deltaTime / (1000/60));
    this.rotation += 0.1 * (deltaTime / (1000/60));
  }
  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    fill(this.color);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) );
    strokeWeight(1.5);
    rect(-this.r, -this.r, this.r * 2, this.r * 2, 2);
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 150); // Fixed: Access color levels
    triangle(-this.r, -this.r, this.r, -this.r, 0, -this.r * 1.5);
    pop();
  }
  offscreen() {
    return ( this.x < -this.r || this.x > width + this.r || this.y < -this.r || this.y > height + this.r ); // Fixed: Use || for logical OR
  }
  hits(playerRect) {
    return Utils.collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 ); // Use Utils.collideRectCircle
  }
  hitsObstacle(obstacle) {
    return Utils.collideRectCircle( obstacle.x, obstacle.y, obstacle.w, obstacle.h, this.x, this.y, this.r * 2 ); // Use Utils.collideRectCircle
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isDestroyed = false;
    this.droneAngle = random(TWO_PI);
    this.hasFiredInitialShot = false; // New: Flag to ensure initial shot

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") { // Fixed: Use || for logical OR
      this.w = 50;
      this.h = 40;
      this.maxHealth = this.type === "INTERCEPTOR"? 3 : 4;
      this.color = this.type === "INTERCEPTOR"? C_ENEMY_INTERCEPTOR : C_ENEMY_DRONE;
      this.shootAccuracy = 0.18;
      this.baseShootCooldown = this.type === "INTERCEPTOR"? 2200 : 2800;
      this.movementSpeedFactor = 1.0;
    } else { // TURRET
      this.w = 45;
      this.h = 45;
      this.maxHealth = 6;
      this.color = C_ENEMY_TURRET;
      this.shootAccuracy = 0.1;
      this.baseShootCooldown = 1800;
      this.movementSpeedFactor = 0.6;
    }
    this.health = this.maxHealth;
    this.shootCooldown = random( this.baseShootCooldown * 0.5, this.baseShootCooldown * 1.5 );
  }

  update() {
    if (this.isDestroyed) return;
    this.x -= gameSpeed * this.movementSpeedFactor * (deltaTime / (1000/60));

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") { // Fixed: Use || for logical OR
      let ySpeed = this.type === "INTERCEPTOR"? 0.08 : 0.05;
      let yAmplitude = this.type === "INTERCEPTOR"? 1.3 : 1.0;
      this.y += sin(this.droneAngle + frameCount * ySpeed) * yAmplitude * (deltaTime / (1000/60));
      this.y = constrain( this.y, this.h, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h * 2 );
    }

    // New: All enemies shoot at least once when on screen
    if (!this.hasFiredInitialShot && this.x < width && this.x + this.w > 0 && player) {
        let angleToPlayer = atan2( (player.y + player.h / 2) - (this.y + this.h / 2), (player.x + player.w / 2) - (this.x + this.w / 2) );
        let randomOffset = random(-this.shootAccuracy, this.shootAccuracy);
        enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2, this.y + this.h / 2, angleToPlayer + randomOffset ) );
        this.hasFiredInitialShot = true;
        this.shootCooldown = this.baseShootCooldown / (gameSpeed / Config.INITIAL_GAME_SPEED); // Reset cooldown after initial shot
        this.shootCooldown = max(this.baseShootCooldown / 3, this.shootCooldown);
    }

    this.shootCooldown -= deltaTime;
    if (this.shootCooldown <= 0 && this.x < width - 20 && this.x > 20 && player) {
      let angleToPlayer = atan2( (player.y + player.h / 2) - (this.y + this.h / 2), (player.x + player.w / 2) - (this.x + this.w / 2) );
      let randomOffset = random(-this.shootAccuracy, this.shootAccuracy);
      enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2, this.y + this.h / 2, angleToPlayer + randomOffset ) );
      this.shootCooldown = this.baseShootCooldown / (gameSpeed / Config.INITIAL_GAME_SPEED);
      this.shootCooldown = max(this.baseShootCooldown / 3, this.shootCooldown);
    }
  }
  show() {
    if (this.isDestroyed) return;
    strokeWeight(2);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) );
    fill(this.color);

    if (this.type === "DRONE") {
      rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.6, 2);
      rect(this.x + this.w * 0.2, this.y, this.w * 0.6, 5);
      rect(this.x + this.w * 0.2, this.y + this.h - 5, this.w * 0.6, 5);
      triangle(this.x + this.w, this.y + this.h * 0.2, this.x + this.w, this.y + this.h * 0.8, this.x + this.w + 10, this.y + this.h * 0.5);
    } else if (this.type === "INTERCEPTOR") {
      beginShape();
      vertex(this.x, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y);
      vertex(this.x + this.w, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y + this.h);
      endShape(CLOSE);
      rect(this.x + this.w * 0.3, this.y + this.h * 0.3, this.w * 0.4, this.h * 0.4);
      fill(100);
      ellipse(this.x + this.w - 5, this.y + this.h / 2, 8, 20);
    } else { // TURRET
      rect(this.x, this.y + this.h * 0.5, this.w, this.h * 0.5, 3);
      ellipse(this.x + this.w / 2, this.y + this.h * 0.5, this.w * 0.8, this.h * 0.8);
      push();
      translate(this.x + this.w / 2, this.y + this.h * 0.5);
      if (player) { // Ensure player exists before calculating angle
        rotate(atan2((player.y + player.h / 2) - (this.y + this.h * 0.5), (player.x + player.w / 2) - (this.x + this.w / 2)));
      }
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); // Fixed: Access color levels
      rect(0, -5, 30, 10, 2);
      pop();
    }
    noStroke();
    if (this.health < this.maxHealth) {
      fill(C_BLOOD_RED);
      rect(this.x, this.y - 12, this.w, 6);
      fill(70, 120, 70);
      rect( this.x, this.y - 12, map(this.health, 0, this.maxHealth, 0, this.w), 6 );
    }
  }
takeDamage(amount) {
    this.health -= amount;
    Utils.createExplosion( this.x + this.w / 2, this.y + this.h / 2, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) ); // Use Utils.createExplosion

    if (this.health <= 0) {
      this.isDestroyed = true;
      score += this.maxHealth * 20 * scoreMultiplier;

      if (objectDestroySound && objectDestroySound.isLoaded()) {
        objectDestroySound.rate(random(0.9, 1.1));
        objectDestroySound.play();
      }
      Utils.createExplosion( this.x + this.w / 2, this.y + this.h / 2, 10 + floor(this.maxHealth * 2), this.color, 5 * (1000/60), 25 * (1000/60) ); // Use Utils.createExplosion

      if (random() < 0.5) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.COIN ) );
      } else if (random() < 0.15) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.FUEL_CELL ) );
      }
    }
  }
  offscreen() {
    return this.x < -this.w - 20;
  }
}

class Obstacle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = C_OBSTACLE;
    this.detailColor = lerpColor(this.color, color(0), 0.3);
  }
  update() {
    this.x -= gameSpeed * (deltaTime / (1000/60));
  }
  show() {
    fill(this.color);
    stroke(this.detailColor);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 2);
    noStroke();

    fill(this.detailColor.levels[0], this.detailColor.levels[1], this.detailColor.levels[2], 180); // Fixed: Access color levels

    stroke(this.detailColor);
    strokeWeight(1.5);
    line(this.x + random(this.w * 0.1, this.w * 0.9), this.y, this.x + random(this.w * 0.1, this.w * 0.9), this.y + this.h);
    line(this.x, this.y + random(this.h * 0.1, this.h * 0.9), this.x + this.w, this.y + random(this.h * 0.1, this.h * 0.9));
    noStroke();

    for (let i = 0; i < random(3, 7); i++) {
        rect(this.x + random(0, this.w - 5), this.y + random(0, this.h - 5), random(3, 8), random(3, 6), 1);
    }

    fill(this.color.levels[0] - 10, this.color.levels[1] - 10, this.color.levels[2] - 10); // Fixed: Access color levels
    triangle(this.x, this.y, this.x + random(5, 15), this.y, this.x, this.y + random(5, 15));
    triangle(this.x + this.w, this.y, this.x + this.w - random(5, 15), this.y, this.x + this.w, this.y + random(5, 15));
    triangle(this.x, this.y + this.h, this.x + random(5, 15), this.y + this.h, this.x, this.y + this.h - random(5, 15));
    triangle(this.x + this.w, this.y + this.h, this.x + this.w - random(5, 15), this.y + this.h, this.x + this.w, this.y + this.h - random(5, 15));
  }
  offscreen() {
    return this.x < -this.w;
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.s = type === Config.POWERUP_TYPE.COIN ? 20 : 30; // Use Config.POWERUP_TYPE
    this.initialY = y;
    this.bobOffset = random(TWO_PI);
    this.rotation = random(TWO_PI);
    this.type = type;
    switch (type) {
      case Config.POWERUP_TYPE.COIN: this.color = C_POWERUP_COIN; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.FUEL_CELL: this.color = C_POWERUP_FUEL; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.SHIELD: this.color = C_POWERUP_SHIELD; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.WEAPON_SYSTEM: this.color = C_POWERUP_WEAPON; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.SPREAD_SHOT: this.color = C_POWERUP_SPREAD; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.RAPID_FIRE: this.color = C_POWERUP_RAPID; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.SCORE_MULTIPLIER: this.color = C_POWERUP_MULTIPLIER; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.COIN_MAGNET: this.color = C_POWERUP_MAGNET; break; // Use Config.POWERUP_TYPE
      case Config.POWERUP_TYPE.SPEED_BURST: this.color = C_POWERUP_SPEED; break; // Use Config.POWERUP_TYPE
      default: this.color = color(150);
    }
  }
  update() {
    if (this.type === Config.POWERUP_TYPE.COIN && activePowerups[Config.POWERUP_TYPE.COIN_MAGNET] > 0 && player) { // Fixed: Check for specific powerup type
        let angleToPlayer = atan2(player.y - this.y, player.x - this.x);
        let distance = dist(player.x, player.y, this.x, this.y);
        let magnetForce = map(distance, 0, 200, 5, 0.5, true);
        this.x += cos(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
        this.y += sin(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
    } else {
        this.x -= gameSpeed * 0.85 * (deltaTime / (1000/60));
    }
    this.y = this.initialY + sin(frameCount * 0.08 + this.bobOffset) * 8;
    if ( this.type === Config.POWERUP_TYPE.COIN || this.type === Config.POWERUP_TYPE.SPREAD_SHOT ) this.rotation += 0.08 * (deltaTime / (1000/60)); // Fixed: Use || for logical OR
  }
  show() {
    push();
    translate(this.x + this.s / 2, this.y + this.s / 2);
    if ( this.type === Config.POWERUP_TYPE.COIN || this.type === Config.POWERUP_TYPE.SPREAD_SHOT ) rotate(this.rotation); // Fixed: Use || for logical OR

    textAlign(CENTER, CENTER);
    textSize(this.s * 0.5);

    strokeWeight(2);
    stroke(max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30));
    fill(this.color);

    switch (this.type) {
      case Config.POWERUP_TYPE.COIN: // Use Config.POWERUP_TYPE
        ellipse(0, 0, this.s, this.s);
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200);
        text("$", 0, 1);
        break;
      case Config.POWERUP_TYPE.FUEL_CELL: // Use Config.POWERUP_TYPE
        rect(-this.s * 0.3, -this.s * 0.4, this.s * 0.6, this.s * 0.8, 3);
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        rect(-this.s * 0.2, -this.s * 0.5, this.s * 0.4, this.s * 0.1, 2);
        fill(0, 0, 0, 200);
        text("F", 0, 1);
        break;
      case Config.POWERUP_TYPE.SHIELD: // Use Config.POWERUP_TYPE
        beginShape();
        vertex(0, -this.s / 2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, this.s * 0.2);
        vertex(0, this.s / 2); vertex(-this.s * 0.4, this.s * 0.2); vertex(-this.s * 0.4, -this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        text("S", 0, 1);
        break;
      case Config.POWERUP_TYPE.WEAPON_SYSTEM: // Use Config.POWERUP_TYPE
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2);
        noStroke();
        fill(lerpColor(this.color, color(0), 0.2));
        rect(-this.s * 0.3, -this.s * 0.3, this.s * 0.6, this.s * 0.6, 1);
        fill(0, 0, 0, 200);
        text("W", 0, 1);
        break;
      case Config.POWERUP_TYPE.SPREAD_SHOT: // Use Config.POWERUP_TYPE
        for (let i = -1; i <= 1; i++) rect(i * this.s * 0.25, -this.s * 0.1, this.s * 0.15, this.s * 0.4, 1);
        fill(0, 0, 0, 200);
        textSize(this.s * 0.25);
        text("SP", 0, 1);
        break;
      case Config.POWERUP_TYPE.RAPID_FIRE: // Use Config.POWERUP_TYPE
        ellipse(0, 0, this.s, this.s);
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200);
        text("RF", 0, 1);
        break;
      case Config.POWERUP_TYPE.SCORE_MULTIPLIER: // Use Config.POWERUP_TYPE
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2);
        noStroke();
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text("x" + (activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER] > 0 ? scoreMultiplier : "?"), 0, 1); // Fixed: Check for specific powerup type
        break;
      case Config.POWERUP_TYPE.COIN_MAGNET: // Use Config.POWERUP_TYPE
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.2, 2);
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2);
        rect(this.s * 0.2, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2);
        fill(0, 0, 0, 200);
        textSize(this.s * 0.4);
        text("M", 0, 1);
        break;
      case Config.POWERUP_TYPE.SPEED_BURST: // Use Config.POWERUP_TYPE
        beginShape();
        vertex(-this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.4);
        vertex(this.s * 0.6, 0); vertex(this.s * 0.4, this.s * 0.4); vertex(this.s * 0.4, this.s * 0.2);
        vertex(-this.s * 0.4, this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text(">>", 0, 1);
        break;
      default:
        ellipse(0, 0, this.s, this.s);
        fill(0, 0, 0, 200);
        text("?", 0, 1);
    }
    pop();
  }
  offscreen() {
    return this.x < -this.s - 20;
  }
  hits(playerRect) {
    return Utils.collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x + this.s / 2, this.y + this.s / 2, this.s ); // Use Utils.collideRectCircle
  }
}

class Boss {
  constructor(x, y, w, h, r, maxHealth, entrySpeed, targetX, colorVal) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.r = r;
    // Scale boss health and entry speed based on total bosses defeated
    this.maxHealth = maxHealth * (1 + bossCycleDefeats * 0.15); // Increased scaling
    this.health = this.maxHealth;
    this.entrySpeed = entrySpeed * (1 + bossCycleDefeats * 0.07); // Increased scaling
    this.targetX = targetX;
    this.color = colorVal;
    this.detailColor = lerpColor(this.color, color(0), 0.3);
    this.shootTimer = 1500;
    this.isActive = false;
    this.vy = 0;
    this.gravity = 0.3;
  }
  updateEntry() {
    if (this.x > this.targetX) {
      this.x -= this.entrySpeed * (deltaTime / (1000 / 60));
    }
  }
  hasEntered() {
    return this.x <= this.targetX;
  }
  updateActive() { throw new Error("UpdateActive method must be implemented by subclass"); }
  showActive() { throw new Error("ShowActive method must be implemented by subclass"); }

  update() {
    if (!this.isActive) return;
    this.updateActive();

    this.vy += this.gravity * (deltaTime / (1000/60));
    this.y += this.vy * (deltaTime / (1000/60));
    if (this.r) {
        this.y = constrain(this.y, this.r, height - Config.GROUND_Y_OFFSET - this.r);
    } else {
        this.y = constrain(this.y, 0, height - Config.GROUND_Y_OFFSET - this.h);
    }
  }
  show() {
    this.showActive();
    let barX = this.x - (this.r || this.w / 2);
    let barY = this.y - (this.r || this.h / 2) - 20;
    let barW = this.r ? this.r * 2 : this.w;
    let barH = 10;
    fill(C_BLOOD_RED);
    rect(barX, barY, barW, barH, 2);
    fill(70, 120, 70);
    rect(barX, barY, map(this.health, 0, this.maxHealth, 0, barW), barH, 2);
    fill(this.detailColor);
    rect(barX - 2, barY, 2, barH);
    rect(barX + barW, barY, 2, barH);
  }
  takeDamage(dmg) {
    if (!this.isActive) return;
    this.health -= dmg;
    let pLast = playerProjectiles[playerProjectiles.length -1];
    let explosionX = pLast ? pLast.x : this.x + random(-20, 20);
    let explosionY = pLast ? pLast.y : this.y + random(-20, 20);
    Utils.createExplosion( explosionX, explosionY, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) ); // Use Utils.createExplosion

    if (this.health <= 0) {
      this.health = 0;
      score += this.maxHealth * 25 * scoreMultiplier;
    }
  }
  hits(playerRect) {
    if (!this.isActive) return false;
    if (this.r) {
      return Utils.collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 ); // Use Utils.collideRectCircle
    } else {
      return Utils.collideRectRect( this.x, this.y, this.w, this.h, playerRect.x, playerRect.y, playerRect.w, playerRect.h ); // Use Utils.collideRectRect
    }
  }
}

class BossTank extends Boss {
  constructor() {
    super( width + 150, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - 90, 150, 100, null, 100, 2.0, width - 150 - 70, C_BOSS_TANK );
    this.turretAngle = PI;
  }
  updateActive() {
    if(player) {
        this.turretAngle = lerp( this.turretAngle, atan2( (player.y + player.h / 2) - (this.y + 25), (player.x + player.w / 2) - (this.x + this.w / 2 - 30) ), 0.03 * (deltaTime / (1000/60)) );
    }
    this.shootTimer -= deltaTime;
    if (this.shootTimer <= 0) {
      for (let i = -1; i <= 1; i++) {
        enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2 - 30 + cos(this.turretAngle) * 30, this.y + 25 + sin(this.turretAngle) * 30, this.turretAngle + i * 0.2 ) );
      }
      this.shootTimer = (2500 - bossCycleDefeats * 100) / (gameSpeed / Config.INITIAL_GAME_SPEED); // Scale with total defeats
      this.shootTimer = max(900, this.shootTimer);
      this.vy = -5;
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x, this.y, this.w, this.h, 5);
    fill(this.detailColor);
    rect(this.x, this.y + this.h - 30, this.w, 30, 3);
    for (let i = 0; i < this.w; i += 20) {
      rect(this.x + i + 2, this.y + this.h - 28, 15, 26, 2);
    }
    fill(this.color);
    ellipse(this.x + this.w / 2 - 30, this.y + 25, 60, 60);
    push();
    translate(this.x + this.w / 2 - 30, this.y + 25);
    if (player) { // Ensure player exists before calculating angle
        rotate(this.turretAngle);
    }
    fill(this.detailColor);
    rect(20, -10, 50, 20, 3);
    pop();
    noStroke();
  }
}

class BossShip extends Boss {
  constructor() {
    super( width + 120, 150, null, null, 55, 100, 1.8, width - 55 - 120, C_BOSS_SHIP );
    this.movePatternAngle = random(TWO_PI);
    this.attackMode = 0;
    this.modeTimer = 6000 - bossCycleDefeats * 500; // Scale with total defeats
  }
  updateActive() {
    this.y = Config.SCREEN_HEIGHT / 2.5 + sin(this.movePatternAngle) * (Config.SCREEN_HEIGHT / 3);
    this.movePatternAngle += 0.02 / (gameSpeed / Config.INITIAL_GAME_SPEED) * (deltaTime / (1000/60));

    this.shootTimer -= deltaTime;
    this.modeTimer -= deltaTime;
    if (this.modeTimer <= 0) {
      this.attackMode = (this.attackMode + 1) % 2;
      this.modeTimer = random(5000, 8000) - bossCycleDefeats * 500; // Scale with total defeats
    }
    if (this.shootTimer <= 0 && player) {
      if (this.attackMode === 0) {
        let angleToPlayer = atan2( (player.y + player.h / 2) - this.y, (player.x + player.w / 2) - this.x );
        for (let i = -1; i <= 1; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, angleToPlayer + i * 0.15) );
      } else {
        for (let i = -2; i <= 2; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, PI + i * 0.3) );
      }
      this.shootTimer = (this.attackMode === 0 ? 2000 : 2800 - bossCycleDefeats * 150) / (gameSpeed / Config.INITIAL_GAME_SPEED); // Scale with total defeats
      this.shootTimer = max(800, this.shootTimer);
      this.vy = -4;
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    ellipse(this.x, this.y, this.r * 2.2, this.r * 1.5);
    beginShape(); vertex(this.x - this.r * 1.2, this.y - this.r * 0.4); vertex(this.x - this.r * 2.0, this.y); vertex(this.x - this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    beginShape(); vertex(this.x + this.r * 1.2, this.y - this.r * 0.4); vertex(this.x + this.r * 2.0, this.y); vertex(this.x + this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    fill(this.detailColor);
    rect(this.x - this.r * 1.8, this.y - 8, 10, 16, 2);
    noStroke();
  }
}

class BossFinal extends Boss {
  constructor() {
    super( width + 150, height / 2, null, null, 65, 100, 1.2, width - 65 - 70, C_BOSS_FINAL );
    this.movePatternAngle = random(TWO_PI);
    this.phase = 0;
    this.phaseTimer = 18000 - bossCycleDefeats * 1000; // Scale with total defeats
  }
  updateActive() {
    this.x = this.targetX + cos(this.movePatternAngle) * (this.phase === 1 ? 90 : 70);
    this.y = height / 2 + sin(this.movePatternAngle * (this.phase === 2 ? 2.5 : 1.5)) * (height / 2 - this.r - 40);
    this.movePatternAngle += (0.015 + this.phase * 0.005) / (gameSpeed / Config.INITIAL_GAME_SPEED) * (deltaTime / (1000/60));

    this.shootTimer -= deltaTime;
    this.phaseTimer -= deltaTime;
    if (this.phaseTimer <= 0 && this.phase < 2) {
      this.phase++;
      this.phaseTimer = 15000 - this.phase * 2000 - bossCycleDefeats * 500; // Scale with total defeats
      Utils.createExplosion(this.x, this.y, 30, this.detailColor, 10 * (1000/60), 40 * (1000/60)); // Use Utils.createExplosion
    }
    if (this.shootTimer <= 0) {
      let numProj = 6 + this.phase * 2 + bossCycleDefeats; // Scale with total defeats
      let speedMult = 0.8 + this.phase * 0.1 + bossCycleDefeats * 0.05; // Scale with total defeats
      for (let a = 0; a < TWO_PI; a += TWO_PI / numProj) {
        let proj = new EnemyProjectile( this.x, this.y, a + frameCount * 0.01 * (this.phase % 2 === 0 ? 1 : -1) );
        proj.speed *= speedMult;
        enemyProjectiles.push(proj);
      }
      this.shootTimer = (3000 - this.phase * 500 - bossCycleDefeats * 100) / (gameSpeed / Config.INITIAL_GAME_SPEED); // Scale with total defeats
      this.shootTimer = max(1000 - this.phase * 100, this.shootTimer);
      this.vy = -6;
    }
  }
  showActive() {
    strokeWeight(4);
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2, 5);
    fill(this.detailColor);
    rect(this.x - this.r * 0.8, this.y - this.r * 1.2, this.r * 1.6, this.r * 0.4, 3);
    rect(this.x - this.r * 1.2, this.y - this.r * 0.8, this.r * 0.4, this.r * 1.6, 3);
    for (let i = 0; i < 4; i++) {
      push();
      translate(this.x, this.y);
      rotate(i * HALF_PI);
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); // Fixed: Access color levels
      rect(this.r * 0.8, -10, 20, 20, 4);
      pop();
    }
    noStroke();
  }
}

// Function to check if a rectangle (for enemy spawn) overlaps with any existing obstacles
// Moved to Utils.js
// function isClearForSpawn(newX, newY, newW, newH) { ... }

function updateGameLogic() {
  if (window.currentScreen !== "GAME" || gamePaused) return;

  gameElapsedTime = millis() - gameStartTime;

  let speedBurstFactor = activePowerups[Config.POWERUP_TYPE.SPEED_BURST] > 0 ? 1.5 : 1; // Use Config.POWERUP_TYPE

  // Adjust game speed and spawn intervals based on postWinModeActive
  if (postWinModeActive) {
      baseGameSpeed = min(Config.MAX_GAME_SPEED, baseGameSpeed + Config.GAME_SPEED_INCREMENT * 2 * (deltaTime / (1000 / 60))); // Faster speed increment
      obstacleInterval = max( Config.OBSTACLE_MIN_INTERVAL / 2, obstacleInterval * 0.98 ); // More aggressive decrement
      enemySpawnInterval = max( Config.ENEMY_MIN_INTERVAL / 2, enemySpawnInterval * 0.97 ); // More aggressive decrement
  } else {
      baseGameSpeed = min(Config.MAX_GAME_SPEED / speedBurstFactor, baseGameSpeed + Config.GAME_SPEED_INCREMENT * (deltaTime / (1000 / 60)));
      obstacleInterval = max( Config.OBSTACLE_MIN_INTERVAL, obstacleInterval * Config.OBSTACLE_INTERVAL_DECREMENT_FACTOR );
      enemySpawnInterval = max( Config.ENEMY_MIN_INTERVAL, enemySpawnInterval * Config.ENEMY_INTERVAL_DECREMENT_FACTOR );
  }
  gameSpeed = baseGameSpeed * speedBurstFactor;


  distanceTraveled += gameSpeed * scoreMultiplier * (deltaTime / (1000 / 60)); // Score multiplier also affects distance
  score = floor(distanceTraveled) + coinsCollectedThisRun * 10 * scoreMultiplier;

  if(player) player.update();

  if (!playerCanShoot) {
      playerShootCooldown -= deltaTime;
      if (playerShootCooldown <= 0) playerCanShoot = true;
  }

  // Updated Weapon System Auto-fire with deltaTime
  if (activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] > 0 && player) { // Use Config.POWERUP_TYPE
    weaponSystemActive = true;
    let fireIntervalMs = currentWeaponMode === "SPREAD" ? 200 : 133; // Approx 12 and 8 frames at 60fps -> ms
    if (activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]) { // Use Config.POWERUP_TYPE
        fireIntervalMs = currentWeaponMode === "SPREAD" ? 100 : 67; // Approx 6 and 4 frames at 60fps -> ms
    }

    weaponSystemShootTimer -= deltaTime;
    if (weaponSystemShootTimer <= 0) {
        if (currentWeaponMode === "SPREAD") {
            for (let i = -1; i <= 1; i++) playerProjectiles.push( new PlayerProjectile( player.x + player.w, player.y + player.h / 2, i * 0.2 ) );
        } else {
            playerProjectiles.push( new PlayerProjectile(player.x + player.w, player.y + player.h / 2) );
        }
        weaponSystemShootTimer = fireIntervalMs; // Reset timer
    }
  } else {
    weaponSystemActive = false;
    // weaponSystemShootTimer = 0; // Optional: reset timer when power-up ends
  }


  if ( millis() - lastObstacleTime > obstacleInterval && !boss && !bossApproaching ) {
    let oW = random(25, 60); let oH = random(40, 180); let oX = width;
    let oYT = random(1); let oY;
    if (oYT < 0.4) oY = 0;
    else if (oYT < 0.8) oY = height - Config.GROUND_Y_OFFSET - oH; // Use Config.GROUND_Y_OFFSET
    else oY = random(height * 0.15, height - Config.GROUND_Y_OFFSET - oH - 40); // Use Config.GROUND_Y_OFFSET
    obstacles.push(new Obstacle(oX, oY, oW, oH));
    lastObstacleTime = millis();
    // obstacleInterval is already updated at the top of the function
  }

  let currentPInterval = boss && boss.isActive ? Config.POWERUP_BOSS_INTERVAL : Config.POWERUP_REGULAR_INTERVAL; // Use Config.POWERUP_BOSS_INTERVAL, Config.POWERUP_REGULAR_INTERVAL
  let currentMinPInterval = boss && boss.isActive ? Config.POWERUP_BOSS_MIN_INTERVAL : Config.POWERUP_REGULAR_MIN_INTERVAL; // Use Config.POWERUP_BOSS_MIN_INTERVAL, Config.POWERUP_REGULAR_MIN_INTERVAL
  if (millis() - lastPowerupTime > powerupInterval) {
    let pType; let rand = random();
    if (boss && boss.isActive) {
      if (rand < 0.25) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.7) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.85) pType = POWERUP_TYPE.SPREAD_SHOT;
      else pType = POWERUP_TYPE.RAPID_FIRE;
    } else {
      if (rand < 0.2) pType = POWERUP_TYPE.COIN;
      else if (rand < 0.35) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.6) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.7) pType = POWERUP_TYPE.SPREAD_SHOT;
      else if (rand < 0.8) pType = POWERUP_TYPE.RAPID_FIRE;
      else if (rand < 0.87) pType = POWERUP_TYPE.SCORE_MULTIPLIER;
      else if (rand < 0.94) pType = POWERUP_TYPE.COIN_MAGNET;
      else pType = POWERUP_TYPE.SPEED_BURST;
    }
    powerups.push( new Powerup(width, random(60, height - Config.GROUND_Y_OFFSET - 90), pType) ); // Use Config.GROUND_Y_OFFSET
    lastPowerupTime = millis();
    powerupInterval = max( currentMinPInterval, currentPInterval * Config.POWERUP_INTERVAL_DECREMENT_FACTOR ); // Use Config.POWERUP_INTERVAL_DECREMENT_FACTOR
  }

  if ( millis() - lastEnemySpawnTime > enemySpawnInterval && !boss && !bossApproaching ) {
    let eTypeRand = random(); let type;
    if (eTypeRand < 0.6) type = "DRONE";
    else if (eTypeRand < 0.85) type = "INTERCEPTOR";
    else type = "TURRET";

    let spawnAttempts = 0;
    const maxSpawnAttempts = 10; // Try multiple times to find a clear spot
    let eX = width + 30; // Start off-screen
    let eY;
    let enemyW = (type === "DRONE" || type === "INTERCEPTOR") ? 50 : 45;
    let enemyH = (type === "DRONE" || type === "INTERCEPTOR") ? 40 : 45;

    let spawned = false;
    while (!spawned && spawnAttempts < maxSpawnAttempts) {
        if (type === "TURRET") {
            eY = random() < 0.5 ? 30 : Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - 40 - 30; // Use Config.SCREEN_HEIGHT, Config.GROUND_Y_OFFSET
        } else {
            eY = random(60, height - Config.GROUND_Y_OFFSET - 90); // Use Config.GROUND_Y_OFFSET
        }

        // Check for overlap with existing obstacles near the spawn edge
        // We'll check a small buffer area to the right of the screen
        let checkX = eX;
        let checkY = eY;
        let checkW = enemyW;
        let checkH = enemyH;

        if (Utils.isClearForSpawn(checkX, checkY, checkW, checkH, obstacles)) { // Fixed: Call Utils.isClearForSpawn and pass obstacles
            enemies.push(new Enemy(eX, eY, type));
            spawned = true;
        }
        spawnAttempts++;
    }
    if (!spawned) {
        console.warn("Failed to spawn enemy after multiple attempts due to obstacles.");
    }

    lastEnemySpawnTime = millis();
    // enemySpawnInterval is already updated at the top of the function
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    if (player && player.hits(obstacles[i])) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        Utils.createExplosion( obstacles[i].x + obstacles[i].w / 2, obstacles[i].y + obstacles[i].h / 2, 10, C_OBSTACLE, 5 * (1000/60), 20 * (1000/60) ); // Use Utils.createExplosion
        obstacles.splice(i, 1);
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) Utils.createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) ); // Use Utils.createExplosion
        break;
      }
    }
    if (obstacles[i].offscreen()) obstacles.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return;

  for (let i = powerups.length - 1; i >= 0; i--) {
    powerups[i].update();
    if (player && powerups[i].hits(player)) {
      activatePowerup(powerups[i].type);
      Utils.createExplosion( powerups[i].x + powerups[i].s / 2, powerups[i].y + powerups[i].s / 2, 10, powerups[i].color, 3 * (1000/60), 15 * (1000/60) ); // Use Utils.createExplosion
      powerups.splice(i, 1);
    } else if (powerups[i].offscreen()) powerups.splice(i, 1);
  }

  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    let pProj = playerProjectiles[i];
    pProj.update();
    let hitObj = false;
    for (let k = obstacles.length - 1; k >= 0; k--) {
      if (pProj.hits(obstacles[k])) {
        hitObj = true;
        Utils.createExplosion( pProj.x + pProj.w / 2, pProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60) ); // Use Utils.createExplosion
        break;
      }
    }
    if (!hitObj) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (!enemies[j].isDestroyed && pProj.hits(enemies[j])) {
          enemies[j].takeDamage(pProj.damage);
          hitObj = true;
          break;
        }
      }
    }
    if (!hitObj && boss && boss.isActive && boss.health > 0) {
      let bH = boss.r ? Utils.collideRectCircle(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.r * 2) // Use Utils.collideRectCircle
                       : Utils.collideRectRect(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.w, boss.h); // Use Utils.collideRectRect
      if (bH) {
        boss.takeDamage(pProj.damage);
        hitObj = true;
      }
    }
    if (hitObj || pProj.offscreen()) {
      if (hitObj && !pProj.offscreen()) Utils.createExplosion( pProj.x + pProj.w, pProj.y, 3, C_PLAYER_PROJECTILE, 2 * (1000/60), 8 * (1000/60) ); // Use Utils.createExplosion
      playerProjectiles.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    if (e.isDestroyed) { enemies.splice(i, 1); continue; }
    e.update();
    if (player && player.hits(e)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        e.takeDamage(100);
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) Utils.createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) ); // Use Utils.createExplosion
        break;
      }
    }
    if (e.offscreen() && !e.isDestroyed) enemies.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return;

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    let eProj = enemyProjectiles[i];
    eProj.update();
    let hitPlayerOrObstacle = false;
    if (player && eProj.hits(player)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        Utils.createExplosion(eProj.x, eProj.y, 8, eProj.color, 3 * (1000/60), 12 * (1000/60)); // Use Utils.createExplosion
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) Utils.createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) ); // Use Utils.createExplosion
      }
      hitPlayerOrObstacle = true;
    } else {
      for (let k = obstacles.length - 1; k >= 0; k--) {
        if (eProj.hitsObstacle(obstacles[k])) {
          hitPlayerOrObstacle = true;
          Utils.createExplosion(eProj.x, eProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60)); // Use Utils.createExplosion
          break;
        }
      }
    }
    if (hitPlayerOrObstacle) {
      enemyProjectiles.splice(i, 1);
      if (window.currentScreen !== "GAME") break; // Break if game over was triggered
    } else if (eProj.offscreen()) enemyProjectiles.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].finished()) particles.splice(i, 1);
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    smokeParticles[i].update();
    if (smokeParticles[i].finished()) {
        smokeParticles.splice(i, 1);
        if (random() < 0.3) {
             smokeParticles.push(new Particle(
                random(Config.SCREEN_WIDTH), random(Config.SCREEN_HEIGHT * 0.05, Config.SCREEN_HEIGHT * 0.4), // Spawn higher
                C_SMOKE_EFFECT, random(60, 120), random(8000, 15000),
                createVector(random(-0.05, 0.05) * gameSpeed * 0.1, random(-0.08, -0.18)),
                0.99, 'ellipse'
            ));
        }
    }
  }


  if (boss) {
    if (!boss.isActive) {
      boss.updateEntry();
      if (boss.hasEntered()) boss = pendingBoss; // Fixed: Assign pendingBoss once it has entered
    } else {
      boss.update();
      if (boss.health <= 0) {
        Utils.createExplosion( boss.x + (boss.r || boss.w / 2), boss.y + (boss.r || boss.h / 2), 50, boss.color, 10 * (1000/60), 60 * (1000/60) ); // Use Utils.createExplosion
        boss = null;
        bossApproaching = false;
        pendingBoss = null;
        bossCount++; // Increment count for unique bosses
        bossCycleDefeats++; // Increment total boss defeats

        // Check for win condition and activate post-win mode
        if (bossCount >= 3) {
            temporaryWinMessageActive = true;
            temporaryWinMessageTimer = TEMPORARY_WIN_MESSAGE_DURATION_MS;
            postWinModeActive = true; // Activate continuous play mode
            bossCount = 0; // Reset unique boss count to cycle again
            console.log("All 3 unique bosses defeated! Entering post-win mode.");
        }

        timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS; // Use Config.BOSS_SPAWN_INTERVAL_MS

        // --- Difficulty Adjustment after Boss Defeat ---
        // In post-win mode, game speed and spawn intervals are handled at the top
        // For pre-win mode, reset to initial difficulty
        if (!postWinModeActive) {
            gameSpeed = Config.INITIAL_GAME_SPEED; // Use Config.INITIAL_GAME_SPEED
            baseGameSpeed = Config.INITIAL_GAME_SPEED; // Use Config.INITIAL_GAME_SPEED
            obstacleInterval = Config.OBSTACLE_START_INTERVAL; // Use Config.OBSTACLE_START_INTERVAL
            enemySpawnInterval = Config.ENEMY_START_INTERVAL; // Use Config.ENEMY_START_INTERVAL
        }
      }
    }
  } else if (!bossApproaching && window.currentScreen === "GAME") { // Only spawn boss if game is active
    timeUntilNextBoss -= deltaTime;
    if (timeUntilNextBoss <= 0) {
        bossApproaching = true;
        let bossType = bossCycleDefeats % 3; // Cycle through the 3 unique bosses based on total defeats
        if (bossType === 0) pendingBoss = new BossTank();
        else if (bossType === 1) pendingBoss = new BossShip();
        else pendingBoss = new BossFinal();
    }
  } else if (bossApproaching && !boss && enemies.length === 0 && obstacles.length === 0) {
    // This block is for when boss is approaching but not yet active, and screen is clear
    // This logic was causing glitches. The boss should be set when it enters.
    // The `pendingBoss` is already set and updated in `updateBossLogic`'s first `if` block.
    // This `else if` block can be removed or simplified if it's causing issues.
    // For now, let's ensure it doesn't prematurely set `boss`.
    // The `pendingBoss.hasEntered()` check handles the transition to `boss = pendingBoss;`
  }

  // Update temporary win message timer
  if (temporaryWinMessageActive) {
      temporaryWinMessageTimer -= deltaTime;
      if (temporaryWinMessageTimer <= 0) {
          temporaryWinMessageActive = false;
      }
  }

  for (const type in activePowerups) {
    activePowerups[type] -= deltaTime;
    if (activePowerups[type] <= 0) {
      delete activePowerups[type];
      if (type === POWERUP_TYPE.WEAPON_SYSTEM && !(activePowerups[POWERUP_TYPE.SPREAD_SHOT] > 0 || activePowerups[POWERUP_TYPE.RAPID_FIRE] > 0) ) {
        weaponSystemActive = false;
        currentWeaponMode = "STANDARD";
      } else if (type === POWERUP_TYPE.SPREAD_SHOT && !(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0) ) {
         currentWeaponMode = "STANDARD";
      } else if (type === POWERUP_TYPE.SCORE_MULTIPLIER) {
        scoreMultiplier = 1;
      }
    }
  }
}

function activatePowerup(type) {
  console.log("Activating powerup:", type);
  switch (type) {
    case Config.POWERUP_TYPE.COIN: // Use Config.POWERUP_TYPE
      coinsCollectedThisRun++;
      break;
    case Config.POWERUP_TYPE.FUEL_CELL: // Use Config.POWERUP_TYPE
      jetpackFuel = Config.MAX_FUEL; // Use Config.MAX_FUEL
      break;
    case Config.POWERUP_TYPE.SHIELD: // Use Config.POWERUP_TYPE
      if(player) player.shieldCharges = min(3, player.shieldCharges + 1);
      break;
    case Config.POWERUP_TYPE.COIN_MAGNET: // Use Config.POWERUP_TYPE
      activePowerups[Config.POWERUP_TYPE.COIN_MAGNET] = (activePowerups[Config.POWERUP_TYPE.COIN_MAGNET] || 0) + Config.COIN_MAGNET_DURATION; // Use Config.COIN_MAGNET_DURATION
      break;
    case Config.POWERUP_TYPE.SPEED_BURST: // Use Config.POWERUP_TYPE
      activePowerups[Config.POWERUP_TYPE.SPEED_BURST] = (activePowerups[Config.POWERUP_TYPE.SPEED_BURST] || 0) + Config.SPEED_BURST_DURATION; // Use Config.SPEED_BURST_DURATION
      break;
    case Config.POWERUP_TYPE.WEAPON_SYSTEM: // Use Config.POWERUP_TYPE
      weaponSystemActive = true;
      if (currentWeaponMode !== "SPREAD" && currentWeaponMode !== "RAPID") currentWeaponMode = "STANDARD";
      activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] = (activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] || 0) + Config.WEAPON_SYSTEM_DURATION; // Use Config.WEAPON_SYSTEM_DURATION
      break;
    case Config.POWERUP_TYPE.SPREAD_SHOT: // Use Config.POWERUP_TYPE
      weaponSystemActive = true;
      currentWeaponMode = "SPREAD";
      activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] || 0, Config.SPREAD_SHOT_DURATION); // Use Config.SPREAD_SHOT_DURATION
      activePowerups[Config.POWERUP_TYPE.SPREAD_SHOT] = (activePowerups[Config.POWERUP_TYPE.SPREAD_SHOT] || 0) + Config.SPREAD_SHOT_DURATION; // Use Config.SPREAD_SHOT_DURATION
      break;
    case Config.POWERUP_TYPE.RAPID_FIRE: // Use Config.POWERUP_TYPE
      weaponSystemActive = true;
      activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] || 0, Config.RAPID_FIRE_DURATION); // Use Config.RAPID_FIRE_DURATION
      activePowerups[Config.POWERUP_TYPE.RAPID_FIRE] = (activePowerups[Config.POWERUP_TYPE.RAPID_FIRE] || 0) + Config.RAPID_FIRE_DURATION; // Use Config.RAPID_FIRE_DURATION
      break;
    case Config.POWERUP_TYPE.SCORE_MULTIPLIER: // Use Config.POWERUP_TYPE
      scoreMultiplier *= 2;
      activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER] = (activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER] || 0) + Config.SCORE_MULTIPLIER_DURATION; // Use Config.SCORE_MULTIPLIER_DURATION
      break;
  }
}

class Particle {
  constructor(x, y, color, size, lifetime, velocity, drag, shape = 'ellipse') {
    this.x = x; this.y = y; this.color = color; this.size = size; this.lifetime = lifetime;
    this.vel = velocity || createVector(random(-1, 1), random(-1, 1));
    this.acc = createVector(0, 0); this.drag = drag || 1; this.alpha = 255;
    this.startLifetime = lifetime; this.shape = shape;
    this.initialSize = size;
  }

  applyForce(force) { this.acc.add(force); }

  update() {
    this.vel.add(this.acc);
    this.vel.mult(this.drag);
    this.x += this.vel.x * (deltaTime / (1000/60));
    this.y += this.vel.y * (deltaTime / (1000/60));
    this.acc.mult(0);

    this.lifetime -= deltaTime;
    this.alpha = map(this.lifetime, 0, this.startLifetime, 0, 255);
    this.size = map(this.lifetime, 0, this.startLifetime, 0, this.initialSize);
    if (this.size < 0) this.size = 0;
  }

  show() {
    noStroke();
    let displayColor = this.color;
    if (Array.isArray(this.color)) displayColor = this.color[floor(random(this.color.length))];

    if (displayColor && displayColor.levels) {
        fill( displayColor.levels[0], displayColor.levels[1], displayColor.levels[2], this.alpha ); // Fixed: Access color levels
        if (this.shape === 'ellipse') ellipse(this.x, this.y, this.size);
        else if (this.shape === 'rect') rect(this.x - this.size/2, this.y - this.size/2, this.size, this.size * random(0.5, 1.5), 1);
    }
  }
  finished() { return this.lifetime < 0; }
}

// Moved to Utils.js
// function createExplosion(x, y, count, baseColor, minLifetimeMs, maxLifetimeMs) { ... }

function drawHUD() {
  fill(C_HUD_BG); noStroke();
  rect(0, 0, width, 50);

  let fuelBarWidth = map(jetpackFuel, 0, Config.MAX_FUEL, 0, 150); // Use Config.MAX_FUEL
  fill(C_POWERUP_FUEL); rect(10, 10, fuelBarWidth, 20);
  noFill(); stroke(C_TEXT_MAIN); strokeWeight(2); rect(10, 10, 150, 20);
  noStroke(); fill(C_TEXT_MAIN); textSize(14); textAlign(LEFT, CENTER); text("FUEL", 15, 20);

  fill(C_TEXT_SCORE); textSize(24); textAlign(RIGHT, CENTER); text("SCORE: " + floor(score), width - 20, 25);
  fill(C_TEXT_ACCENT); textSize(18); text("HIGH: " + highScore, width - 20, 40);
  fill(C_TEXT_MAIN); textSize(18); textAlign(LEFT, CENTER); text("PILOT: " + window.playerName, 180, 25);
  let minutes = floor(gameElapsedTime / 60000); let seconds = floor((gameElapsedTime % 60000) / 1000);
  let timerString = nf(minutes, 2) + ':' + nf(seconds, 2);
  fill(C_TEXT_MAIN); textSize(20); textAlign(CENTER, CENTER); text("TIME: " + timerString, width / 2, 25);

  let pX = width / 2 + 80; let pY = 40; let iconSize = 15;

  if(player && player.shieldCharges > 0) {
    fill(C_POWERUP_SHIELD); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("S x" + player.shieldCharges, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] > 0) { // Use Config.POWERUP_TYPE
    fill(C_POWERUP_WEAPON); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER);
    let wsText = "W";
    if (currentWeaponMode === "SPREAD") wsText = "W(S)";
    if (activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]) wsText += "(R)"; // Use Config.POWERUP_TYPE
    text(wsText, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER] > 0) { // Use Config.POWERUP_TYPE
    fill(C_POWERUP_MULTIPLIER); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("x" + scoreMultiplier, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[Config.POWERUP_TYPE.COIN_MAGNET] > 0) { // Use Config.POWERUP_TYPE
    fill(C_POWERUP_MAGNET); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("M", pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[Config.POWERUP_TYPE.SPEED_BURST] > 0) { // Use Config.POWERUP_TYPE
    fill(C_POWERUP_SPEED); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text(">>", pX + iconSize / 2, pY + iconSize / 2 + 1);
  }
}

function drawBackground() {
  background(C_SKY_OVERCAST);

  let horizonY = Config.SCREEN_HEIGHT * 0.6; // Use Config.SCREEN_HEIGHT
  let fireGlowHeight = Config.SCREEN_HEIGHT * 0.15; // Use Config.SCREEN_HEIGHT
  for (let y = 0; y < fireGlowHeight; y++) {
    let inter = map(y, 0, fireGlowHeight, 0, 1);
    let c = lerpColor(C_FIRE_GLOW_STRONG, C_SKY_HORIZON, inter);
    fill(c);
    rect(0, horizonY + y, Config.SCREEN_WIDTH, 1); // Use Config.SCREEN_WIDTH
  }
  fill(C_SKY_HORIZON);
  rect(0, horizonY + fireGlowHeight, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT * 0.4 - Config.GROUND_Y_OFFSET - fireGlowHeight); // Use Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT, Config.GROUND_Y_OFFSET


  fill(C_GROUND_DETAIL);
  rect(0, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET, Config.SCREEN_WIDTH, Config.GROUND_Y_OFFSET); // Use Config.SCREEN_HEIGHT, Config.GROUND_Y_OFFSET, Config.SCREEN_WIDTH
  fill(C_GROUND_DETAIL.levels[0] + 10, C_GROUND_DETAIL.levels[1] + 10, C_GROUND_DETAIL.levels[2] + 10); // Fixed: Access color levels
  for(let i = 0; i < Config.SCREEN_WIDTH; i += 20) { // Use Config.SCREEN_WIDTH
    rect(i + (frameCount * gameSpeed * 0.5 * (deltaTime / (1000/60))) % 20, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET + 5, 8, 3); // Use Config.SCREEN_HEIGHT, Config.GROUND_Y_OFFSET
  }

  for (let bgEl of backgroundElements) {
      bgEl.update();
      bgEl.show();
  }

  for (let sp of smokeParticles) { sp.show(); }

  fill(C_SMOKE_EFFECT.levels[0], C_SMOKE_EFFECT.levels[1], C_SMOKE_EFFECT.levels[2], 25 + sin(frameCount * 0.01 + bgOffset1*0.1) * 10); // Fixed: Access color levels
  rect(0, Config.SCREEN_HEIGHT * 0.15, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT * 0.55); // Use Config.SCREEN_HEIGHT, Config.SCREEN_WIDTH
  bgOffset1 += gameSpeed * 0.02 * (deltaTime / (1000/60));
  if (bgOffset1 > TWO_PI) bgOffset1 -= TWO_PI;
}


window.draw = function() {
  drawBackground();

  if (window.currentScreen === "START") {
    drawStartScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(true);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  } else if (window.currentScreen === "GAME") {
    updateGameLogic();
    if(player) player.show();
    for (let o of obstacles) o.show();
    for (let e of enemies) e.show();
    for (let pp of playerProjectiles) pp.show();
    for (let ep of enemyProjectiles) ep.show();
    for (let pu of powerups) pu.show();
    for (let p of particles) p.show();
    if (boss) boss.show();
    drawHUD();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(true);

    // Draw temporary win message if active
    if (temporaryWinMessageActive) {
        drawTemporaryWinMessage();
    }

  } else if (window.currentScreen === "GAME_OVER") {
    drawGameOverScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(true);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);

    if (!scoreboardDisplayedAfterGameOver) {
      if(typeof window.saveHighScore === 'function') window.saveHighScore(score);
      scoreboardDisplayedAfterGameOver = true;
    }
  } else if (window.currentScreen === "SCOREBOARD") {
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  }
}

function drawStartScreen() {
  fill(C_TEXT_MAIN); textAlign(CENTER, CENTER);
  textSize(48); text("FLAPPY ADOLF", width / 2, height / 2 - 120);
  textSize(20); text("Based on true events when Fuhrer had to poop.", width / 2, height / 2 - 70);

  textSize(18); fill(C_TEXT_ACCENT);
  text("PILOT: " + window.playerName, width / 2, height / 2 + 20);

  fill(C_TEXT_MAIN); textSize(16);
  text("Use [SPACE] or JUMP button for ass thrust", width / 2, height / 2 + 70);
  text("Use [LEFT MOUSE] or SHOOT button to fire", width / 2, height / 2 + 95);
  text("Survive the nasty enemies of the Reich. Get to poop.", width / 2, height / 2 + 120);
}

function drawGameOverScreen() {
  fill(C_BLOOD_RED); textAlign(CENTER, CENTER);
  textSize(64); text("MISSION FAILED", width / 2, height / 2 - 100);
  fill(C_TEXT_MAIN); textSize(36);
  text("SCORE: " + score, width / 2, height / 2 - 30);
  text("HIGH SCORE: " + highScore, width / 2, height / 2 + 20);
}

// New: Temporary win message
function drawTemporaryWinMessage() {
    if (temporaryWinMessageActive) {
        push();
        textAlign(CENTER, CENTER);
        // Fade in/out effect
        let alpha = map(temporaryWinMessageTimer, 0, TEMPORARY_WIN_MESSAGE_DURATION_MS, 0, 255, true);
        if (temporaryWinMessageTimer < 1000) { // Fade out in last second
            alpha = map(temporaryWinMessageTimer, 0, 1000, 0, 255, true);
        } else if (temporaryWinMessageTimer > TEMPORARY_WIN_MESSAGE_DURATION_MS - 1000) { // Fade in in first second
            alpha = map(temporaryWinMessageTimer, TEMPORARY_WIN_MESSAGE_DURATION_MS - 1000, TEMPORARY_WIN_MESSAGE_DURATION_MS, 255, 0, true);
        }

        fill(Config.C_VICTORY_MAIN_TEXT.levels[0], Config.C_VICTORY_MAIN_TEXT.levels[1], Config.C_VICTORY_MAIN_TEXT.levels[2], alpha); // Fixed: Access color levels, use Config
        textSize(58);
        text("VICTORY!", width / 2, height / 2 - 50);
        fill(Config.C_VICTORY_SUBTEXT.levels[0], Config.C_VICTORY_SUBTEXT.levels[1], Config.C_VICTORY_SUBTEXT.levels[2], alpha); // Fixed: Access color levels, use Config
        textSize(32);
        text("The Reich is proud!", width / 2, height / 2);
        pop();
    }
}

window.keyPressed = function() {
  // --- Handle Spacebar (starts game AND jumps) ---
  if (key === " ") {
    // If the game is not started, spacebar starts it
    if (window.currentScreen === "START") {
      window.currentScreen = "GAME";
      resetGameValues(); // Reset everything for a fresh start (this will hide name input)
      // Call the global function from main.js to set flying state
      setPlayerFlyingState(true);
      // Call the global function to trigger jump sound
      triggerJumpSound();
    }
    // If game is already running, and player wants to jump
    else if (window.currentScreen === "GAME") {
      // Call the global function from main.js to set player flying state
      setPlayerFlyingState(true);
      // Call the global function to trigger jump sound
      triggerJumpSound();
    }
  }

  // --- Handle 'R' Key (resets game if game over or win screen) ---
  if (window.currentScreen === "GAME_OVER") { // Only reset on game over, no dedicated win screen
    if (key === "r" || key === "R") {
      resetGameValues(); // This will also reset scoreboardDisplayedAfterGameOver and gameWin
      window.currentScreen = "GAME"; // Ensure game is marked as started for the new run
      // Hide scoreboard if it's open
      if (window.showScoreboard) {
          window.showScoreboard(false);
      }
    }
  }
}
// Assign keyReleased to the window object for p5.js to find it
window.keyReleased = function() {
  // Only stop flying if game is active and spacebar was released
  if (window.currentScreen === "GAME" && key === " ") {
    // Call the centralized function to stop player flying
    stopPlayerFlying();
  }
}
window.mousePressed = function() {
  if (window.currentScreen === "GAME" && mouseButton === LEFT &&
      mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    if(typeof window.triggerPlayerShoot === 'function') window.triggerPlayerShoot();
  }
}
// Collision functions are now in Utils.js
/*
function collideRectRect(x, y, w, h, x2, y2, w2, h2) {
  return x + w >= x2 && x <= x2 + w2 && y + h >= y2 && y <= y2 + h2;
}
function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter) {
  let tX = cx;
  let tY = cy;
  if (cx < rx) tX = rx;
  else if (cx > rx + rw) tX = rx + rw;
  if (cy < ry) tY = ry;
  else if (cy > ry + rh) tY = ry + rh;
  return dist(cx, cy, tX, tY) <= diameter / 2;
}
*/
