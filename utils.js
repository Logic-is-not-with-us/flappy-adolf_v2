// utils.js

// Import necessary constants from config.js
import * as Config from './config.js';

// These functions need access to p5's drawing context (e.g., for fill, rect, ellipse, PI, translate, rotate)
// We will pass the p5 instance (often referred to as 'p' or 'sketch') to them when they are called from main.js

export function drawFauxBanner(x, y, w, h) { // Removed p5Instance parameter, assuming global p5 context
  fill(Config.C_BANNER_BG_RED); // Use Config.C_BANNER_BG_RED
  rect(x, y, w, h, 2);

  fill(Config.C_BANNER_CIRCLE_WHITE); // Use Config.C_BANNER_CIRCLE_WHITE
  ellipse(x + w / 2, y + h / 2, w * 0.55);

  let cx = x + w / 2;
  let cy = y + h / 2;
  let s = w * 0.07;

  fill(Config.C_BANNER_SYMBOL_BLACK); // Use Config.C_BANNER_SYMBOL_BLACK
  noStroke();

  push();
  translate(cx, cy);
  rotate(PI / 4); // Use p5's global PI

  rect(-s / 2, -s / 2, s, s); // Central element

  let armLength = s * 1.2;
  let armWidth = s * 0.8;

  rect(-armLength - armWidth / 2 + s/2 , -armWidth / 2, armLength, armWidth); // Left
  rect(armWidth / 2 - s/2, -armLength - armWidth / 2, armWidth, armLength);    // Top
  rect(armWidth/2 - s/2, s/2 , armWidth, armLength);                           // Bottom
  rect(s/2, -armWidth/2, armLength, armWidth);                                 // Right

  pop();
}

// Export collision functions
export function collideRectRect(x, y, w, h, x2, y2, w2, h2) {
  return x + w >= x2 && x <= x2 + w2 && y + h >= y2 && y <= y2 + h2;
}

export function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter) {
  // Find the closest point on the rectangle to the center of the circle
  let testX = cx;
  let testY = cy;

  if (cx < rx) testX = rx;
  else if (cx > rx + rw) testX = rx + rw;
  if (cy < ry) testY = ry;
  else if (cy > ry + rh) testY = ry + rh;

  // Calculate the distance between the closest point and the circle's center
  let distX = cx - testX;
  let distY = cy - testY;
  let distance = sqrt((distX * distX) + (distY * distY));

  return distance <= diameter / 2;
}

// Export isClearForSpawn function
export function isClearForSpawn(newX, newY, newW, newH, obstacles) {
    for (let obs of obstacles) {
        // Check for overlap using collideRectRect
        if (collideRectRect(newX, newY, newW, newH, obs.x, obs.y, obs.w, obs.h)) {
            return false; // Overlaps with an obstacle
        }
    }
    return true; // No overlap
}

// Export createExplosion function
export function createExplosion(x, y, count, baseColor, minLifetimeMs, maxLifetimeMs) {
  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(1, 6);
    let vel = createVector(cos(angle) * speed, sin(angle) * speed);
    let particleType = random();
    let pColor = Array.isArray(baseColor) ? baseColor[floor(random(baseColor.length))] : baseColor;
    let lifetime = random(minLifetimeMs, maxLifetimeMs);
    let size = random(3,10);

    if (particleType < 0.7) {
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), pColor, size, lifetime, vel, 0.9 ) );
    } else {
        let shrapnelColor = lerpColor(pColor || color(100), color(80,80,80), random(0.2,0.6));
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), shrapnelColor, size * random(0.5, 0.8), lifetime * 0.8, vel.mult(random(1.2, 1.8)), 0.98, 'rect' ) );
    }
  }
}

// Note: The Particle class is defined in main.js, so `particles.push` and `new Particle`
// will work if this file is imported into main.js.
// If Particle class or `particles` array were to be moved here, they would need to be passed as arguments
// or imported/exported appropriately. For now, assuming they are globally accessible from main.js context
// where these utility functions are called.
